<template>
  <div v-if="intent.showModal"
    class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
    @click.self="intent.close()">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in flex flex-col max-h-[90vh]">
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
        <!-- ① 数据概览（可折叠，含 chart 可视化） -->
        <DataOverview
          v-if="snapshot"
          :profiles="snapshot.profiles"
          :row-count="snapshot.rowCount"
          :col-count="snapshot.colCount"
        />
        <div v-if="intent.pendingFileMeta?.name" class="text-[10px] text-slate-400 -mt-2 truncate">
          📄 {{ intent.pendingFileMeta.name }}
        </div>

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
              @click="selectSuggestion(s, i)"
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
                <span class="text-[9px] text-slate-400">{{ ['清洗','加工','对比','摘要'].filter((_, idx) => [s.tasks.clean, s.tasks.process, s.tasks.aggregate, s.tasks.summary][idx]).join('+') }}</span>
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
          <div class="grid grid-cols-2 gap-2">
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

        <!-- ⑥ AI 三步方案预览（用户确认目标后自动生成，展示三步基础配置） -->
        <section v-if="hasAnyTask && (pipelinePlan || planningPipeline)">
          <h4 class="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
            <span class="w-1 h-3.5 bg-blue-500 rounded-full"></span>
            AI 帮你规划的三步方案
          </h4>

          <!-- 规划中 -->
          <div v-if="planningPipeline" class="p-3 rounded-lg bg-blue-50/50 border border-blue-100 flex items-center gap-2">
            <Loader2 class="w-3.5 h-3.5 text-blue-500 animate-spin" />
            <span class="text-xs text-blue-600">AI 正在规划三步方案...</span>
          </div>

          <!-- 三步方案预览 -->
          <div v-else-if="pipelinePlan" class="space-y-1.5">
            <!-- 清洗 -->
            <div v-if="pipelinePlan.clean" class="p-2.5 rounded-lg border border-orange-200/60 bg-orange-50/30">
              <div class="flex items-center gap-1.5 mb-1">
                <Sparkles class="w-3 h-3 text-orange-600" />
                <span class="text-[11px] font-bold text-orange-800">清洗</span>
              </div>
              <p class="text-[10px] text-slate-600 leading-relaxed">
                主列：{{ headers[pipelinePlan.clean.sourceCol] }}
                <span v-if="cleanRuleCount"> · {{ cleanRuleCount }} 条规则</span>
              </p>
            </div>
            <div v-else-if="form.tasks.clean" class="p-2 rounded-lg border border-slate-200 bg-slate-50">
              <span class="text-[10px] text-slate-400">🧹 清洗：AI 未能规划，进页面手动配</span>
            </div>

            <!-- 加工 -->
            <div v-if="pipelinePlan.process" class="p-2.5 rounded-lg border border-violet-200/60 bg-violet-50/30">
              <div class="flex items-center gap-1.5 mb-1">
                <Repeat class="w-3 h-3 text-violet-600" />
                <span class="text-[11px] font-bold text-violet-800">智能加工</span>
              </div>
              <p class="text-[10px] text-slate-600 leading-relaxed">
                产出：{{ pipelinePlan.process.outputColumns.map(c => c.name + '(' + c.type + ')').join('、') }}
              </p>
            </div>
            <div v-else-if="form.tasks.process" class="p-2 rounded-lg border border-slate-200 bg-slate-50">
              <span class="text-[10px] text-slate-400">🏷️ 加工：AI 未能规划，进页面手动配</span>
            </div>

            <!-- 对比（聚合） -->
            <div v-if="pipelinePlan.aggregate" class="p-2.5 rounded-lg border border-blue-200/60 bg-blue-50/30">
              <div class="flex items-center gap-1.5 mb-1">
                <BarChart3 class="w-3 h-3 text-blue-600" />
                <span class="text-[11px] font-bold text-blue-800">分组对比</span>
              </div>
              <p class="text-[10px] text-slate-600 leading-relaxed">
                按「{{ headers[pipelinePlan.aggregate.groupColIdx] }}」分组，
                对「{{ pipelinePlan.aggregate.valueColIdx != null ? headers[pipelinePlan.aggregate.valueColIdx] : '行数' }}」做 {{ (pipelinePlan.aggregate.op || 'sum').toUpperCase() }}
              </p>
            </div>
            <div v-else-if="form.tasks.aggregate" class="p-2 rounded-lg border border-slate-200 bg-slate-50">
              <span class="text-[10px] text-slate-400">📊 对比：AI 未能规划，进页面手动配</span>
            </div>

            <!-- 摘要 -->
            <div v-if="pipelinePlan.summary" class="p-2.5 rounded-lg border border-emerald-200/60 bg-emerald-50/30">
              <div class="flex items-center gap-1.5 mb-1">
                <AlignJustify class="w-3 h-3 text-emerald-600" />
                <span class="text-[11px] font-bold text-emerald-800">摘要</span>
              </div>
              <p class="text-[10px] text-slate-600 leading-relaxed">
                主题：{{ pipelinePlan.summary.theme }}
                <span v-if="pipelinePlan.summary.focusColumns.length"> · 关注 {{ pipelinePlan.summary.focusColumns.length }} 列</span>
              </p>
            </div>
            <div v-else-if="form.tasks.summary" class="p-2 rounded-lg border border-slate-200 bg-slate-50">
              <span class="text-[10px] text-slate-400">📊 摘要：AI 未能规划，进页面手动配</span>
            </div>

            <button @click="runPipelinePlan" :disabled="planningPipeline"
              class="w-full text-center text-[10px] text-slate-400 hover:text-blue-600 py-1 flex items-center justify-center gap-1 disabled:opacity-50">
              <RefreshCw class="w-3 h-3" /> 重新规划
            </button>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
        <button @click="intent.close()"
          class="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md">
          取消
        </button>
        <button @click="onSubmit" :disabled="form.coreColumnIdx == null || planningPipeline"
          class="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
          <Loader2 v-if="planningPipeline" class="w-3.5 h-3.5 animate-spin" />
          <Check v-else class="w-3.5 h-3.5" />
          {{ planningPipeline ? '方案生成中...' : '确认' }}
        </button>
        <button v-if="planningPipeline" @click="onSubmitSkipPlan"
          class="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-md">
          跳过方案
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { X, Check, Sparkles, Repeat, AlignJustify, RefreshCw, Loader2, BarChart3 } from 'lucide-vue-next'
import { useImportIntentStore } from '../stores/importIntent'
import { useDataShareStore } from '../stores/dataShare'
import { useSettingsStore } from '../stores/settings'
import { useToast } from '../services/toast'
import { buildTableSnapshot, analyzeTableIntent } from '../services/intentAnalysis'
import { planPipeline } from '../services/pipelinePlanner'
import DataOverview from '../components/common/DataOverview.vue'

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

// 三步方案预演状态
const pipelinePlan = ref(null)
const planningPipeline = ref(false)

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
  { key: 'clean',     label: '清洗',     desc: '去噪去重',     icon: Sparkles,
    tooltip: '自动过滤空文本、纯表情、纯符号、重复行、广告、乱码等噪声数据，让后续分析更干净。' },
  { key: 'process',   label: '智能加工', desc: '翻译+打标',    icon: Repeat,
    tooltip: '把核心列翻译成目标语言，或用 AI 给每行打上情感、主题、分类等标签，生成结构化新列。' },
  { key: 'aggregate', label: '分组对比', desc: '按组聚合',     icon: BarChart3,
    tooltip: '按某列分组对另一列做求和/均值/计数，生成对比图表。适合"按地区看销售额""按站点比互动量"等场景。' },
  { key: 'summary',   label: '摘要',     desc: '一键洞察',     icon: AlignJustify,
    tooltip: 'AI 通读全表，生成数据概况、关键发现、分布统计的总结报告，快速把握数据全貌。' }
]

const form = reactive({
  coreColumnIdx: null,
  tasks: { clean: true, process: true, summary: true, aggregate: false },
  goal: ''  // 主输入：你想做什么（合并了原 note）
})

// 是否至少选了一个任务（控制三步方案区显隐）
const hasAnyTask = computed(() => form.tasks.clean || form.tasks.process || form.tasks.summary || form.tasks.aggregate)
// 清洗规则条数（用于预览展示）
const cleanRuleCount = computed(() => {
  if (!pipelinePlan.value?.clean?.aiRulesConfig) return 0
  const cfg = pipelinePlan.value.clean.aiRulesConfig
  let n = 0
  for (const k of Object.keys(cfg)) {
    if (cfg[k]?.enable) n++
  }
  return n + (cfg.customFilters?.length || 0)
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
    clean:     hasSaved ? !!intent.tasks.clean   : true,
    process:   hasSaved ? !!(intent.tasks.process || intent.tasks.translate || intent.tasks.analyze) : true,
    summary:   hasSaved ? !!intent.tasks.summary : true,
    aggregate: hasSaved ? !!intent.tasks.aggregate : false
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
  // 三步方案：读缓存（不重跑），用户主动点「重新规划」才重新生成
  pipelinePlan.value = intent.pipelinePlan || null
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
      // 注意：不在这里触发 runPipelinePlan——等用户主动点选候选确认目标后再规划
      // （adoptSuggestion 只是预填，用户可能换成其他候选或编辑目标）
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
// adoptSuggestion 只填充表单（不触发规划），分两种调用场景：
// - 首次自动预填（runAnalysis 里）：只填入，用户还没确认目标
// - 用户主动点选（模板 @click）：填入 + 触发三步规划（用户确认了这个目标）
function adoptSuggestion(s, idx) {
  form.goal = s.goal
  form.coreColumnIdx = s.coreColumnIdx
  form.tasks = { ...s.tasks }
  adoptedIdx.value = typeof idx === 'number' ? idx : suggestions.value.indexOf(s)
}

// 用户主动点选候选 → 确认目标 → 触发三步规划
function selectSuggestion(s, idx) {
  adoptSuggestion(s, idx)
  pipelinePlan.value = null  // 换了目标，旧方案作废
  runPipelinePlan()
}
async function runPipelinePlan() {
  const goal = form.goal.trim()
  if (!goal || !hasAnyTask.value) return
  if (!settings.isConfigured || !headers.value.length || !dataShare.rows?.length) return

  planningPipeline.value = true
  pipelinePlan.value = null
  try {
    const result = await planPipeline({
      goal,
      headers: headers.value,
      rows: dataShare.rows,
      tasks: { ...form.tasks },
      coreColumnIdx: form.coreColumnIdx ?? 0,
      workModel: settings.workModel
    })
    pipelinePlan.value = result
    console.log('[三步方案] 规划完成:', result)
  } catch (err) {
    console.error('[三步方案] 规划失败:', err)
  } finally {
    planningPipeline.value = false
  }
}

// 跳过三步方案直接确认（用户不想等 AI 规划，各模块回退到自己生成）
function onSubmitSkipPlan() {
  pipelinePlan.value = null
  planningPipeline.value = false
  onSubmit()
}

function onSubmit() {
  if (form.coreColumnIdx == null) return
  const trimmedGoal = form.goal.slice(0, 500)
  intent.submit({
    coreColumnIdx: form.coreColumnIdx,
    tasks: { ...form.tasks },
    note: trimmedGoal,            // goal 存入 note 字段（兼容下游 intentNote）
    suggestions: suggestions.value, // 缓存候选，下次不重跑
    pipelinePlan: pipelinePlan.value // 缓存三步方案，各模块进入时消费
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
function typeLabel(t) { return TYPE_LABELS[t] || t }
</script>
