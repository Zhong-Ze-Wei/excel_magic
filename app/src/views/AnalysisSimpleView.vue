<template>
  <!-- ===== 移动端模板 ===== -->
  <div v-if="isMobile" :class="PAGE.mobile + ' animate-fade-in'">
    <PageHeader :icon="Sparkles" theme="process" title="智能加工（简易）" subtitle="选模板或让 AI 生成方案，一键批量打标、翻译、分类。" />

    <!-- 无数据 -->
    <div v-if="!hasData" class="space-y-3">
      <FileUploader label="上传表格" :icon="Sparkles" iconBg="bg-violet-50" iconColor="text-violet-600" @file="handleFile" />
      <button @click="loadDemo"
        class="w-full py-2.5 bg-white border border-violet-200 text-violet-600 rounded-xl text-xs font-bold active:bg-violet-50 flex items-center justify-center gap-1.5">
        <Sparkles class="w-3.5 h-3.5" /> 试试示例数据
      </button>
    </div>

    <!-- 有数据 -->
    <template v-else>
      <AiPlanBanner :visible="hasProcessPlan" :summary="processPlanSummary" @run="runLabelingBatch" />
      <GlobalDataBanner :visible="hasData && dataShare.hasData" :source-name="dataShare.sourceName"
        :headers="headers" :rows="rows" :mobile="true" @disconnect="disconnectGlobalExcel" />
      <AnalysisSimpleBody
        :plan-source="planSource" :user-goal="userGoal" :is-generating-plan="isGeneratingPlan"
        :labeling-plan="labelingPlan" :active-input-columns="activeInputColumns" :headers="headers"
        :is-labeling="isLabeling" :processed="processed" :total-to-process="totalToProcess"
        :percent-finished="percentFinished" :stats="stats" :rows="rows"
        @update:plan-source="v => planSource = v" @update:user-goal="v => userGoal = v"
        @generate="generatePlanWithAI" @apply-template="applyTemplate" @run="runLabelingBatch" @apply="applyToGlobal"
      />
    </template>
  </div>

  <!-- ===== 桌面端模板 ===== -->
  <div v-else :class="PAGE.desktop">
    <PageHeader :icon="Sparkles" theme="process" title="智能加工（简易）"
      subtitle="选模板或让 AI 根据数据生成方案，一键批量打标、翻译、分类。" />

    <!-- 无数据 -->
    <div v-if="!hasData" class="space-y-3">
      <FileUploader label="上传 Excel/CSV 表格" :icon="Sparkles" iconBg="bg-violet-50" iconColor="text-violet-600" @file="handleFile" />
      <div class="flex justify-center">
        <button @click="loadDemo"
          class="px-5 py-2.5 bg-white hover:bg-violet-50 border border-violet-200 text-violet-600 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2">
          <Sparkles class="w-3.5 h-3.5" /> 试试示例数据
        </button>
      </div>
    </div>

    <!-- 有数据 -->
    <template v-else>
      <AiPlanBanner :visible="hasProcessPlan" :summary="processPlanSummary" @run="runLabelingBatch" />
      <GlobalDataBanner :visible="hasData && dataShare.hasData" :source-name="dataShare.sourceName"
        :headers="headers" :rows="rows" @disconnect="disconnectGlobalExcel" />
      <AnalysisSimpleBody
        :plan-source="planSource" :user-goal="userGoal" :is-generating-plan="isGeneratingPlan"
        :labeling-plan="labelingPlan" :active-input-columns="activeInputColumns" :headers="headers"
        :is-labeling="isLabeling" :processed="processed" :total-to-process="totalToProcess"
        :percent-finished="percentFinished" :stats="stats" :rows="rows"
        @update:plan-source="v => planSource = v" @update:user-goal="v => userGoal = v"
        @generate="generatePlanWithAI" @apply-template="applyTemplate" @run="runLabelingBatch" @apply="applyToGlobal"
      />
    </template>
  </div>
</template>

<script setup>
defineOptions({ name: 'AnalysisSimpleView' })
import { ref, computed } from 'vue'
import { Sparkles, Languages, Heart, Tag, Download, LayoutGrid } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import { useSettingsStore } from '../stores/settings'
import { useImportIntentStore } from '../stores/importIntent'
import { useDevice } from '../composables/useDevice'
import { useGlobalDataSync } from '../composables/useGlobalDataSync'
import { useFileUpload } from '../composables/useFileUpload'
import { useLabeling } from '../composables/useLabeling'
import { useExport } from '../composables/useExport'
import { useShare } from '../composables/useShare'
import GlobalDataBanner from '../components/common/GlobalDataBanner.vue'
import FileUploader from '../components/common/FileUploader.vue'
import PageHeader from '../components/common/PageHeader.vue'
import AiPlanBanner from '../components/common/AiPlanBanner.vue'
import AnalysisSimpleBody from '../components/analysis/AnalysisSimpleBody.vue'
import { useToast } from '../services/toast'
import { PAGE, CARD } from '../styles/tokens'
import { callAI } from '../services/ai'
import { getLabelingPlanGenerationPrompt, getPresetPlan, PRESET_TEMPLATES, formatIntentContext } from '../services/prompts'
import { normalizeLabelingPlan } from '../services/labelingPlan'
import { parseRobustJSON } from '../services/jsonParser'
import { DEMO_DATA } from '../services/excel'

const dataShare = useDataShareStore()
const settings = useSettingsStore()
const intent = useImportIntentStore()
const { isMobile } = useDevice()
const toast = useToast()

// 数据加载后重置分析范围（修复原 onInit 空回调导致 rangeEnd 不随上传更新）
const { headers, rows, hasData, disconnectGlobalExcel } = useGlobalDataSync({
  onInit: (h, r) => {
    rangeStart.value = 1
    rangeEnd.value = r.length
    // 消费 AI 预演的加工方案（来自意图弹窗三步规划）
    if (intent.pipelinePlan?.process?.outputColumns?.length && !labelingPlan.value.outputColumns.length) {
      const pp = intent.pipelinePlan.process
      dataShare.labelingPlan = {
        taskName: pp.taskName || '',
        goal: pp.goal || '',
        inputColumns: pp.inputColumns || [],
        outputColumns: pp.outputColumns,
        compiledPrompt: '',
        promptDirty: false
      }
      if (!userGoal.value) userGoal.value = pp.goal || ''
      toast.info('已应用 AI 预规划的加工方案，可调整')
    }
  }
})

// 文件上传
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
// 方案来源：AI 生成 / 模板快选（二选一）
const planSource = ref('ai')

// 参考列：优先用 AI 预演的多列方案，否则回退核心列
const activeInputColumns = computed(() => {
  const pp = intent.pipelinePlan?.process
  if (pp?.inputColumns?.length) return pp.inputColumns
  return dataShare.coreColumn != null ? [Number(dataShare.coreColumn)] : []
})

// AI 方案引导条派生：存在预规划加工方案且尚未应用时显示
const hasProcessPlan = computed(() =>
  !!intent.pipelinePlan?.process?.outputColumns?.length && !labelingPlan.value.outputColumns.length && hasData.value
)
const processPlanSummary = computed(() => {
  const pp = intent.pipelinePlan?.process
  if (!pp) return ''
  const cols = pp.outputColumns.map(c => c.name).join(' + ')
  return `AI 已规划输出列：${cols}，点击执行即可应用`
})

// 打标编排（复用 composable）
const analysisMap = ref({})
const rangeStart = ref(1)
const rangeEnd = ref(0)
const selectedInputColumns = activeInputColumns
const {
  isLabeling, processed, totalToProcess, percentFinished, stats, runLabelingBatch
} = useLabeling({ headers, rows, labelingPlan, rangeStart, rangeEnd, selectedInputColumns, analysisMap })

// 导出（补齐简易模式缺失的导出能力）
const { exportData } = useExport({ rows, headers })
const { applyToGlobal: applyGlobal } = useShare({ rows, headers })
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

// ── 应用到全局：把 AI 新增列物理合并进全局工作表 ──
function applyToGlobal() {
  const plan = labelingPlan.value
  if (!plan.outputColumns.length || !Object.keys(analysisMap.value).length) return
  const newHeaders = [...headers.value, ...plan.outputColumns.map(c => `${c.name} (AI)`)]
  const newRows = rows.value.map((row, ri) => {
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
  })
  applyGlobal(() => ({ headers: newHeaders, rows: newRows }), '已加工数据.xlsx')
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
