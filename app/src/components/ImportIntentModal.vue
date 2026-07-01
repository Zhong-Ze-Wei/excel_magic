<template>
  <div v-if="intent.showModal"
    class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
    @click.self="intent.close()">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
        <h3 class="font-bold text-sm text-slate-800 flex items-center gap-1.5">
          <Sparkles class="w-4 h-4 text-blue-600" /> 数据集意图
        </h3>
        <button @click="intent.close()" class="text-slate-400 hover:text-slate-600">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-4 overflow-y-auto">
        <!-- ① 数据快照 -->
        <section v-if="snapshot" class="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">表格快照</span>
            <span class="text-[10px] text-slate-400">{{ intent.pendingFileMeta?.name }}</span>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-600 mb-2">
            <span class="font-bold text-slate-800">{{ snapshot.rowCount }}</span> 行
            <span class="text-slate-300">×</span>
            <span class="font-bold text-slate-800">{{ snapshot.colCount }}</span> 列
            <span v-if="snapshot.dominantType" class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">
              {{ snapshot.dominantType }}
            </span>
          </div>
          <div class="flex flex-wrap gap-1">
            <span v-for="(p, i) in snapshot.profiles.slice(0, 8)" :key="i"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-white border border-slate-200 text-slate-500"
              :title="p.header + '：' + typeLabel(p.type)">
              <span class="font-mono">{{ typeIcon(p.type) }}</span>
              <span class="truncate max-w-[60px]">{{ p.header }}</span>
            </span>
            <span v-if="snapshot.profiles.length > 8" class="text-[9px] text-slate-400 self-center">
              +{{ snapshot.profiles.length - 8 }}
            </span>
          </div>
        </section>

        <!-- ② 主输入：你想做什么（合并了原任务说明，AI 候选填入它，用户可自由编辑） -->
        <section>
          <h4 class="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
            <span class="w-1 h-3.5 bg-blue-500 rounded-full"></span>
            你想用这份数据做什么？
          </h4>
          <textarea v-model="form.goal" rows="2"
            placeholder="例：清洗掉水军评论，把剩余的翻译成英文并做情感分析"
            class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 resize-none"></textarea>
          <p class="text-[10px] text-slate-400 mt-1">作为 AI 模块的上下文。点下方候选可快速填入，也可自由编辑。</p>
        </section>

        <!-- ③ AI 候选（点选填入主输入 + 同步列/任务，可组合） -->
        <section>
          <div class="flex items-center justify-between mb-2">
            <h4 class="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span class="w-1 h-3.5 bg-blue-500 rounded-full"></span>
              AI 候选目标
            </h4>
          </div>

          <!-- 分析中（分阶段脉动展示） -->
          <div v-if="analyzing" class="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-200/60">
            <div class="flex items-center gap-2 mb-3">
              <Sparkles class="w-4 h-4 text-blue-600 animate-pulse" />
              <span class="text-xs font-bold text-blue-700">AI 正在理解你的表格</span>
            </div>
            <div class="space-y-2">
              <div v-for="(step, i) in analysisSteps" :key="i"
                class="flex items-center gap-2 text-[11px]"
                :class="step.active ? 'text-blue-700' : step.done ? 'text-slate-400' : 'text-slate-300'">
                <Check v-if="step.done" class="w-3 h-3 text-emerald-500 shrink-0" />
                <Loader2 v-else-if="step.active" class="w-3 h-3 text-blue-500 animate-spin shrink-0" />
                <span v-else class="w-3 h-3 shrink-0">·</span>
                <span :class="step.active ? 'font-medium' : ''">{{ step.label }}</span>
              </div>
            </div>
          </div>

          <!-- 候选 radio 列表（可组合：点选填入主输入 + 同步列/任务） -->
          <div v-else-if="suggestions.length" class="space-y-1.5">
            <button v-for="(s, i) in suggestions" :key="i" type="button"
              @click="adoptSuggestion(s, i)"
              :class="[
                'w-full text-left p-2.5 rounded-lg border transition-all',
                adoptedIdx === i
                  ? 'border-blue-500 bg-blue-50/60'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
              ]">
              <div class="flex items-start justify-between gap-2">
                <span class="text-xs font-medium text-slate-700 leading-snug">{{ s.goal }}</span>
                <span v-if="i === 0" class="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-600 text-white">推荐</span>
                <Check v-else-if="adoptedIdx === i" class="shrink-0 w-3.5 h-3.5 text-blue-600" />
              </div>
              <div class="flex items-center gap-1.5 mt-1">
                <span class="text-[9px] text-slate-400">{{ ['清洗','加工','摘要'].filter((_, idx) => [s.tasks.clean, s.tasks.process, s.tasks.summary][idx]).join('+') }}</span>
                <span class="text-slate-200">·</span>
                <span class="text-[9px] text-slate-400">核心列：{{ headers[s.coreColumnIdx] }}</span>
              </div>
            </button>
            <button @click="runAnalysis" class="w-full text-center text-[10px] text-slate-400 hover:text-blue-600 py-1 flex items-center justify-center gap-1">
              <RefreshCw class="w-3 h-3" /> 都不合适？换一批
            </button>
          </div>

          <!-- 未分析（手动模式或自动分析关闭） -->
          <div v-else class="p-3 rounded-lg bg-slate-50 border border-slate-200/60 text-center">
            <p class="text-[10px] text-slate-400 mb-1.5">让 AI 读完表格，推测你可能想做什么</p>
            <button @click="runAnalysis" class="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto">
              <Sparkles class="w-3.5 h-3.5" /> AI 分析表格
            </button>
          </div>
        </section>

        <!-- ④ 核心列选择 -->
        <section>
          <h4 class="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
            <span class="w-1 h-3.5 bg-blue-500 rounded-full"></span>
            核心处理列 <span class="text-red-500">*</span>
          </h4>
          <select v-model.number="form.coreColumnIdx"
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500">
            <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
          </select>
          <p class="text-[10px] text-slate-400 mt-1">数据清洗、翻译、分析默认作用的列</p>
        </section>

        <!-- ⑤ 任务卡片选择（带 tooltip） -->
        <section>
          <h4 class="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
            <span class="w-1 h-3.5 bg-blue-500 rounded-full"></span>
            打算做什么
          </h4>
          <div class="grid grid-cols-3 gap-2">
            <div v-for="t in taskOptions" :key="t.key" class="relative group">
              <button type="button"
                @click="form.tasks[t.key] = !form.tasks[t.key]"
                :class="[
                  'relative w-full flex flex-col items-center text-center p-3 rounded-xl border-2 transition-all',
                  form.tasks[t.key]
                    ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                ]">
                <span v-if="form.tasks[t.key]"
                  class="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check class="w-2.5 h-2.5 text-white" />
                </span>
                <span :class="[
                  'flex items-center justify-center w-9 h-9 rounded-lg mb-1.5 transition-colors',
                  form.tasks[t.key] ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                ]">
                  <component :is="t.icon" class="w-4.5 h-4.5" />
                </span>
                <span class="text-xs font-bold text-slate-700">{{ t.label }}</span>
                <span class="text-[10px] text-slate-400 leading-tight mt-0.5">{{ t.desc }}</span>
              </button>
              <div class="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-1.5
                hidden group-hover:block w-44 p-2 rounded-lg bg-slate-800 text-white text-[10px] leading-relaxed shadow-xl">
                {{ t.tooltip }}
                <span class="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-800"></span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
        <button @click="intent.close()"
          class="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md">
          取消
        </button>
        <button @click="onSubmit" :disabled="form.coreColumnIdx == null"
          class="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
          <Check class="w-3.5 h-3.5" /> 确认
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { X, Check, Sparkles, Repeat, AlignJustify, RefreshCw, Loader2 } from 'lucide-vue-next'
import { useImportIntentStore } from '../stores/importIntent'
import { useDataShareStore } from '../stores/dataShare'
import { useSettingsStore } from '../stores/settings'
import { useToast } from '../services/toast'
import { buildTableSnapshot, analyzeTableIntent } from '../services/intentAnalysis'

const intent = useImportIntentStore()
const dataShare = useDataShareStore()
const settings = useSettingsStore()
const toast = useToast()

const headers = computed(() => intent.pendingFileMeta?.headers || dataShare.headers || [])

// 数据快照（纯前端，弹窗打开时立即算）
const snapshot = ref(null)
// AI 候选列表（本地副本，从 intent.suggestions 缓存读取或新跑）
const suggestions = ref([])
const analyzing = ref(false)
const adoptedIdx = ref(null)

// 分析阶段（视觉化进度）
const analysisSteps = ref([
  { label: '读取列结构与类型', done: false, active: false },
  { label: '抽取样本数据', done: false, active: false },
  { label: '推断可能的任务目标', done: false, active: false }
])
let stepTimer = null
function startStepAnimation() {
  analysisSteps.value.forEach(s => { s.done = false; s.active = false })
  analysisSteps.value[0].active = true
  let i = 0
  stepTimer = setInterval(() => {
    if (i < analysisSteps.value.length - 1) {
      analysisSteps.value[i].done = true
      analysisSteps.value[i].active = false
      i++
      analysisSteps.value[i].active = true
    }
  }, 1200)
}
function finishStepAnimation() {
  if (stepTimer) { clearInterval(stepTimer); stepTimer = null }
  analysisSteps.value.forEach(s => { s.done = true; s.active = false })
}

const taskOptions = [
  { key: 'clean',   label: '清洗',     desc: '去噪去重',     icon: Sparkles,
    tooltip: '自动过滤空文本、纯表情、纯符号、重复行、广告、乱码等噪声数据，让后续分析更干净。' },
  { key: 'process', label: '智能加工', desc: '翻译+打标',    icon: Repeat,
    tooltip: '把核心列翻译成目标语言，或用 AI 给每行打上情感、主题、分类等标签，生成结构化新列。' },
  { key: 'summary', label: '摘要',     desc: '一键洞察',     icon: AlignJustify,
    tooltip: 'AI 通读全表，生成数据概况、关键发现、分布统计的总结报告，快速把握数据全貌。' }
]

const form = reactive({
  coreColumnIdx: null,
  tasks: { clean: true, process: true, summary: true },
  goal: ''  // 主输入：你想做什么（合并了原 note）
})

// 弹窗打开时的初始化
watch(() => intent.showModal, async (v) => {
  if (!v) return
  analyzing.value = false
  adoptedIdx.value = null
  // 立即算快照（纯前端，秒级）
  snapshot.value = buildLocalSnapshot()
  // 初始化表单
  const hasSaved = !!intent.confirmedAt
  form.coreColumnIdx = intent.coreColumnIdx ?? dataShare.coreColumn ?? 0
  form.tasks = {
    clean:   hasSaved ? !!intent.tasks.clean   : true,
    process: hasSaved ? !!(intent.tasks.process || intent.tasks.translate || intent.tasks.analyze) : true,
    summary: hasSaved ? !!intent.tasks.summary : true
  }
  form.goal = intent.note || ''
  // 候选：优先读缓存（已生成过就不重跑），无缓存且开启自动分析才跑
  if (intent.suggestions && intent.suggestions.length) {
    suggestions.value = intent.suggestions
    // 默认选中第一个（推荐项）的高亮，但不覆盖用户已编辑的 goal
    adoptedIdx.value = 0
  } else {
    suggestions.value = []
    if (settings.autoIntentAnalysis && settings.isConfigured && headers.value.length) {
      await runAnalysis()
    }
  }
})

function buildLocalSnapshot() {
  if (!headers.value.length) return null
  const { profiles } = buildTableSnapshot(headers.value, dataShare.rows || [])
  const typeCount = {}
  profiles.forEach(p => { typeCount[p.type] = (typeCount[p.type] || 0) + 1 })
  const dominantType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0]
  return {
    rowCount: intent.pendingFileMeta?.rowCount ?? dataShare.rows?.length ?? 0,
    colCount: intent.pendingFileMeta?.colCount ?? headers.value.length,
    profiles,
    dominantType: dominantType ? typeLabel(dominantType) + '为主' : null
  }
}

async function runAnalysis() {
  if (!headers.value.length || !dataShare.rows?.length) {
    toast.warning('暂无数据可分析')
    return
  }
  if (!settings.isConfigured) {
    toast.warning('请先在设置中配置 API Key')
    return
  }
  analyzing.value = true
  suggestions.value = []
  adoptedIdx.value = null
  startStepAnimation()
  try {
    const result = await analyzeTableIntent(headers.value, dataShare.rows, settings.workModel)
    finishStepAnimation()
    suggestions.value = result.suggestions || []
    if (suggestions.value.length) {
      // 首次分析：默认采纳推荐项（填入主输入），用户可改
      adoptSuggestion(suggestions.value[0], 0)
    } else {
      toast.info('AI 暂无候选，请手动填写目标')
    }
  } catch (err) {
    toast.error('AI 分析失败：' + (err.message || '未知错误'))
  } finally {
    if (stepTimer) { clearInterval(stepTimer); stepTimer = null }
    analyzing.value = false
  }
}

// 采纳候选：goal 填入主输入 + 同步列/任务（用户可在主输入继续编辑文字）
function adoptSuggestion(s, idx) {
  form.goal = s.goal          // ← 修复：原代码丢弃了 goal，现在填入主输入
  form.coreColumnIdx = s.coreColumnIdx
  form.tasks = { ...s.tasks }
  adoptedIdx.value = typeof idx === 'number' ? idx : suggestions.value.indexOf(s)
}

function onSubmit() {
  if (form.coreColumnIdx == null) return
  const trimmedGoal = form.goal.slice(0, 500)
  intent.submit({
    coreColumnIdx: form.coreColumnIdx,
    tasks: { ...form.tasks },
    note: trimmedGoal,            // goal 存入 note 字段（兼容下游 intentNote）
    suggestions: suggestions.value // 缓存候选，下次不重跑
  })
  if (form.coreColumnIdx !== dataShare.coreColumn) {
    dataShare.setCoreColumn(form.coreColumnIdx)
  }
  // 目标写入共享上下文，供智能加工/清洗的 AI 调用使用
  dataShare.setIntentNote(trimmedGoal)
  const count = Object.values(form.tasks).filter(Boolean).length
  toast.success(`意图已保存：${count} 项任务`)
}

const TYPE_LABELS = { number: '数值', text: '文本', enum: '枚举', boolean: '布尔', date: '日期', identifier: '标识', empty: '空' }
const TYPE_ICONS = { number: '#', text: 'T', enum: 'E', boolean: 'B', date: 'D', identifier: 'ID', empty: '·' }
function typeLabel(t) { return TYPE_LABELS[t] || t }
function typeIcon(t) { return TYPE_ICONS[t] || '?' }
</script>
