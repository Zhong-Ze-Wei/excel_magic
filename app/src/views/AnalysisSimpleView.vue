<template>
  <div :class="isMobile ? 'px-3 pb-6 pt-3' : 'max-w-3xl mx-auto pb-10 pt-6 space-y-5'">
    <!-- 无数据：上传引导 -->
    <div v-if="!hasData" class="bg-white rounded-2xl border border-slate-200/60 p-8 text-center">
      <Sparkles class="w-8 h-8 text-violet-500 mx-auto mb-3" />
      <p class="text-sm font-bold text-slate-700 mb-1">AI 智能加工</p>
      <p class="text-xs text-slate-400 mb-4">翻译、打标、分类——选个模板一键开始</p>
      <button @click="triggerUpload" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700">
        <UploadCloud class="w-3.5 h-3.5 inline mr-1" /> 上传表格
      </button>
      <button @click="loadDemo" class="ml-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50">
        试试示例
      </button>
      <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="onFileChange" />
    </div>

    <!-- 有数据 -->
    <div v-else class="space-y-4">
      <!-- 全局关联横幅（带折叠表格预览） -->
      <GlobalDataBanner
        :visible="hasData && dataShare.hasData"
        :source-name="dataShare.sourceName"
        :headers="headers"
        :rows="rows"
        :mobile="isMobile"
        @disconnect="disconnectGlobalExcel"
      />

      <!-- 任务目标 -->
      <section class="bg-white rounded-2xl border border-slate-200/60 p-4">
        <label class="block text-[10px] font-bold text-slate-500 mb-1.5">任务目标</label>
        <textarea v-model="userGoal" rows="2" placeholder="例：把评论翻译成英文，并打上情感标签"
          class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500 resize-none"></textarea>
        <button @click="generatePlanWithAI" :disabled="isGeneratingPlan"
          class="mt-2 w-full py-2 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-100 disabled:opacity-50 flex items-center justify-center gap-1">
          <Sparkles class="w-3.5 h-3.5" /> {{ isGeneratingPlan ? 'AI 生成中...' : 'AI 根据数据生成方案' }}
        </button>
      </section>

      <!-- 模板快选 -->
      <section class="bg-white rounded-2xl border border-slate-200/60 p-4">
        <p class="text-[10px] font-bold text-slate-500 mb-2">或选预设模板</p>
        <div class="grid grid-cols-2 gap-2">
          <button v-for="tpl in PRESET_TEMPLATES" :key="tpl.id" @click="applyTemplate(tpl.id)"
            :class="['p-2.5 rounded-lg border-2 text-left transition-all',
              labelingPlan.outputColumns.length && labelingPlan.taskName === tpl.label
                ? 'border-violet-500 bg-violet-50/50'
                : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30']">
            <component :is="templateIcon(tpl.icon)" class="w-3.5 h-3.5 mb-1" :class="templateColor(tpl.color)" />
            <p class="text-xs font-bold text-slate-700">{{ tpl.label }}</p>
          </button>
        </div>
      </section>

      <!-- 当前方案预览 -->
      <section v-if="labelingPlan.outputColumns.length" class="bg-violet-50/30 rounded-2xl border border-violet-200/50 p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-slate-500">当前方案</span>
          <span class="text-[10px] text-violet-600">{{ labelingPlan.outputColumns.length }} 个输出列</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="col in labelingPlan.outputColumns" :key="col.key"
            class="px-2 py-1 rounded-md text-[10px] bg-white border border-violet-200 text-slate-600">
            {{ col.name }} <span class="text-slate-400">({{ col.type }})</span>
          </span>
        </div>
      </section>

      <!-- 进度 -->
      <div v-if="isLabeling" class="bg-white rounded-2xl border border-slate-200/60 p-4">
        <div class="flex items-center justify-between text-xs mb-2">
          <span class="font-bold text-slate-700">打标中</span>
          <span class="text-slate-500">{{ processed }}/{{ totalToProcess }} ({{ percentFinished }}%)</span>
        </div>
        <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full bg-violet-500 transition-all" :style="{ width: percentFinished + '%' }"></div>
        </div>
      </div>

      <!-- 开始打标 -->
      <button @click="runLabelingBatch" :disabled="isLabeling || !labelingPlan.outputColumns.length"
        class="w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed">
        {{ isLabeling ? '处理中...' : '开始打标' }}
      </button>

      <!-- 结果统计 -->
      <div v-if="stats.done > 0" class="grid grid-cols-3 gap-2">
        <div class="bg-white rounded-xl border border-slate-200/60 p-3 text-center">
          <p class="text-lg font-bold text-emerald-600">{{ stats.done }}</p>
          <p class="text-[10px] text-slate-400">已分析</p>
        </div>
        <div class="bg-white rounded-xl border border-slate-200/60 p-3 text-center">
          <p class="text-lg font-bold text-rose-500">{{ stats.error }}</p>
          <p class="text-[10px] text-slate-400">错误</p>
        </div>
        <div class="bg-white rounded-xl border border-slate-200/60 p-3 text-center">
          <p class="text-lg font-bold text-slate-400">{{ Math.max(0, rows.length - stats.done - stats.error) }}</p>
          <p class="text-[10px] text-slate-400">待处理</p>
        </div>
      </div>

      <!-- 导出 -->
      <button v-if="stats.done > 0" @click="exportResults"
        class="w-full py-2.5 bg-white border border-violet-200 text-violet-700 rounded-xl text-xs font-bold hover:bg-violet-50 flex items-center justify-center gap-1.5">
        <Download class="w-3.5 h-3.5" /> 导出打标结果
      </button>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AnalysisSimpleView' })
import { ref, computed } from 'vue'
import { Sparkles, UploadCloud, Languages, Heart, Tag, Download } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import { useSettingsStore } from '../stores/settings'
import { useDevice } from '../composables/useDevice'
import { useGlobalDataSync } from '../composables/useGlobalDataSync'
import { useFileUpload } from '../composables/useFileUpload'
import { useLabeling } from '../composables/useLabeling'
import { useExport } from '../composables/useExport'
import GlobalDataBanner from '../components/common/GlobalDataBanner.vue'
import { useToast } from '../services/toast'
import { callAI } from '../services/ai'
import { getLabelingPlanGenerationPrompt, getPresetPlan, PRESET_TEMPLATES, formatIntentContext } from '../services/prompts'
import { normalizeLabelingPlan } from '../services/labelingPlan'
import { parseRobustJSON } from '../services/jsonParser'
import { DEMO_DATA } from '../services/excel'

const dataShare = useDataShareStore()
const settings = useSettingsStore()
const { isMobile } = useDevice()
const toast = useToast()

// 数据加载后重置分析范围（修复原 onInit 空回调导致 rangeEnd 不随上传更新）
const { headers, rows, hasData, disconnectGlobalExcel } = useGlobalDataSync({
  onInit: (h, r) => {
    rangeStart.value = 1
    rangeEnd.value = r.length
  }
})

// 文件上传
const fileInput = ref(null)
function triggerUpload() { fileInput.value?.click() }
function onFileChange(e) { handleFile(e.target.files[0]) }  // handleFile 只接受单参（内部已写全局），修复原死参数 {useGlobal:true}
const { handleFile } = useFileUpload({
  onFileLoaded: (data) => {
    rangeStart.value = 1
    rangeEnd.value = data.rows.length
    analysisMap.value = {}
  }
})
function loadDemo() {
  const d = DEMO_DATA.comments
  dataShare.setSharedData(d.headers, d.rows)
  rangeStart.value = 1
  rangeEnd.value = d.rows.length
}

// 打标方案（共享 dataShare.labelingPlan 单一真源）
const labelingPlan = computed(() => dataShare.labelingPlan)
const userGoal = ref('')

// 打标编排（复用 composable）
const analysisMap = ref({})
const rangeStart = ref(1)
const rangeEnd = ref(0)
const selectedInputColumns = computed(() => dataShare.coreColumn != null ? [Number(dataShare.coreColumn)] : [])
const {
  isLabeling, processed, totalToProcess, percentFinished, stats, runLabelingBatch
} = useLabeling({ headers, rows, labelingPlan, rangeStart, rangeEnd, selectedInputColumns, analysisMap })

// 导出（补齐简易模式缺失的导出能力）
const { exportData } = useExport({ rows, headers })
function exportResults() {
  const plan = labelingPlan.value
  exportData(() => rows.value.map((row, ri) => {
    const res = analysisMap.value[ri]
    const padded = [...row]
    while (padded.length < headers.value.length) padded.push('')
    plan.outputColumns.forEach(c => {
      const val = res?.values?.[c.key]
      if (val == null) padded.push('')
      else if (Array.isArray(val)) padded.push(val.join(', '))
      else padded.push(String(val))
    })
    return padded
  }), 'AI打标结果.xlsx', () => [...headers.value, ...plan.outputColumns.map(c => `${c.name} (AI)`)])
}

// AI 生成方案
const isGeneratingPlan = ref(false)
async function generatePlanWithAI() {
  if (!rows.value.length) { toast.warning('请先上传数据'); return }
  if (!settings.isConfigured) { settings.showSettings = true; toast.warning('请先配置 API 密钥'); return }
  isGeneratingPlan.value = true
  try {
    const idx = Number(dataShare.coreColumn) || 0
    const sampleRows = rows.value.slice(0, 6)
    const inputCols = [idx]
    const prompt = getLabelingPlanGenerationPrompt(userGoal.value, headers.value, sampleRows, inputCols)
    const sysPrompt = '你是一个数据分析配置专家。' + formatIntentContext(dataShare.intentNote, '为表格新增列')
    const res = await callAI(prompt, sysPrompt, settings.getApiConfig().workModel)
    const parsed = parseRobustJSON(res)
    const plan = normalizeLabelingPlan(parsed)
    if (!plan) { toast.warning('AI 未能生成有效方案，请尝试模板或专家模式'); return }
    dataShare.labelingPlan = { ...plan, compiledPrompt: '', promptDirty: false }
    if (!userGoal.value) userGoal.value = plan.goal
    toast.success('AI 方案已生成')
  } catch (err) {
    toast.error('AI 生成失败：' + err.message)
  } finally {
    isGeneratingPlan.value = false
  }
}

// 应用预设模板
function applyTemplate(templateId) {
  if (!rows.value.length) { toast.warning('请先上传数据'); return }
  const idx = Number(dataShare.coreColumn) || 0
  const plan = getPresetPlan(templateId, idx)
  if (!plan) return
  dataShare.labelingPlan = plan
  if (!userGoal.value) userGoal.value = plan.goal
  toast.success(`已应用「${plan.taskName}」模板`)
}

// 模板图标/颜色
const ICON_MAP = { Languages, Heart, Tag }
const COLOR_MAP = { blue: 'text-blue-500', rose: 'text-rose-500', green: 'text-emerald-500', violet: 'text-violet-500', amber: 'text-amber-500' }
function templateIcon(name) { return ICON_MAP[name] || Tag }
function templateColor(c) { return COLOR_MAP[c] || 'text-slate-500' }
</script>
