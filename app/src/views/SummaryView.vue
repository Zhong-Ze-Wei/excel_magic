<template>
  <!-- ===== 移动端模板 ===== -->
  <div v-if="isMobile" :class="PAGE.mobile + ' animate-fade-in'">
    <PageHeader :icon="FileBarChart" theme="summary" title="数据摘要" subtitle="AI 分析列级统计画像，生成数据报告。" />

    <GlobalDataBanner :visible="hasData && dataShare.hasData" :source-name="dataShare.sourceName"
      :headers="headers" :rows="rows" :mobile="true"
      @disconnect="disconnectGlobalExcel" />

    <!-- 文件上传 -->
    <MobileCollapsible title="数据文件" :default-open="!hasData">
      <FileUploader v-if="!hasData" label="上传数据文件" :icon="FileBarChart" iconBg="bg-emerald-50" iconColor="text-emerald-600" @file="handleFile" />
      <div v-else class="text-xs text-slate-600">
        <span class="font-bold">{{ rows.length }} 行 × {{ headers.length }} 列</span>
        <span class="text-slate-400 ml-2">非空率 {{ averageFillRate }}%</span>
      </div>
      <button v-if="!hasData" @click="loadDemo"
        class="w-full mt-2 py-2 bg-white border border-emerald-200 text-emerald-600 rounded-lg text-xs font-bold active:bg-emerald-50">
        加载示例数据
      </button>
    </MobileCollapsible>

    <!-- 分析配置 -->
    <MobileCollapsible v-if="hasData" title="分析配置" :default-open="true">
      <div class="space-y-3">
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">分析主题</label>
          <input v-model="analysisTheme" type="text" placeholder="如：客户满意度..."
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
          <button @click="recommendColumns" :disabled="isRecommending || !analysisTheme.trim()"
            class="w-full mt-1.5 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg text-[10px] font-bold disabled:opacity-40">
            {{ isRecommending ? '推荐中...' : 'AI 推荐分析列' }}
          </button>
          <div v-if="recommendedAngles.length > 0" class="mt-1.5 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
            <p v-for="(a, i) in recommendedAngles" :key="i" class="text-[9px] text-emerald-600">· {{ a }}</p>
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">分析列</label>
          <div class="max-h-20 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1">
            <label v-for="(h, i) in headers" :key="i" class="flex items-center gap-1.5 text-[10px] text-slate-700">
              <input type="checkbox" :value="i" v-model="selectedCols" class="rounded text-emerald-600" />
              {{ h }}
            </label>
          </div>
        </div>
        <div v-if="dataShare.labelingResults?.outputColumns?.length">
          <label class="block text-[10px] font-bold text-violet-700 mb-1 flex items-center gap-1">
            <Tag class="w-3 h-3" /> AI 打标列 ({{ dataShare.labelingResults.outputColumns.length }})
          </label>
          <div class="max-h-20 overflow-y-auto bg-violet-50 border border-violet-200 rounded-lg p-2 space-y-1">
            <label v-for="col in dataShare.labelingResults.outputColumns" :key="col.key"
              class="flex items-center gap-1.5 text-[10px] text-violet-800">
              <input type="checkbox" :value="col.key" v-model="selectedLabelingCols" class="rounded text-violet-600" />
              <span class="truncate">{{ col.name }}</span>
            </label>
          </div>
        </div>
      </div>
    </MobileCollapsible>

    <!-- 固定操作按钮 -->
    <button v-if="hasData" @click="generateSummary" :disabled="isSummarizing || selectedCols.length === 0"
      class="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold active:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-200">
      {{ isSummarizing ? '分析中...' : '开始生成摘要' }}
    </button>

    <!-- 列类型分布 -->
    <MobileCollapsible v-if="hasData && columnTypeDistribution.length > 0" title="列类型分布" :default-open="false">
      <div class="flex flex-wrap gap-1.5">
        <span v-for="ct in columnTypeDistribution" :key="ct.type"
          class="inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-bold"
          :class="typeChipClass(ct.type)">
          {{ ct.typeLabel }} {{ ct.count }}
        </span>
      </div>
    </MobileCollapsible>

    <!-- 摘要报告 -->
    <MobileCollapsible v-if="hasData" title="分析报告" :default-open="true">
      <div class="relative">
        <div v-if="!summaryText && !isSummarizing" class="text-center py-8 text-slate-300">
          <FileBarChart class="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p class="text-xs">选择列后点击"开始生成"</p>
        </div>
        <div v-if="isSummarizing && !summaryText" class="text-center py-8">
          <Loader2 class="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
          <p class="text-xs text-emerald-600 font-bold animate-pulse">AI 分析中...</p>
        </div>
        <div v-if="summaryText" class="prose prose-sm prose-slate max-w-none text-xs">
          <div v-html="renderedSummary"></div>
        </div>
      </div>
      <button v-if="summaryText" @click="summaryText = ''"
        class="w-full mt-2 py-2 bg-white border border-slate-200 text-slate-500 rounded-lg text-[10px] font-bold active:bg-slate-50">
        清除报告
      </button>
    </MobileCollapsible>
  </div>

  <!-- ===== 桌面端模板（原样保留）===== -->
  <div v-else :class="PAGE.desktop">
    <!-- Header -->
    <PageHeader :icon="FileBarChart" theme="summary" title="数据摘要"
      subtitle="自动分析全表列级统计画像，生成数据报告。" />
    <div v-if="!hasData">
      <button @click="loadDemo"
        class="px-4 py-2 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5">
        <FileBarChart class="w-3.5 h-3.5" /> 加载示例数据
      </button>
    </div>

    <!-- 全局数据条 -->
    <GlobalDataBanner :visible="hasData && dataShare.hasData" :source-name="dataShare.sourceName"
      :headers="headers" :rows="rows"
      @disconnect="disconnectGlobalExcel" />

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- 左侧配置 -->
      <div class="lg:col-span-4 space-y-6">
        <FileUploader v-if="!hasData" label="上传数据文件" :icon="FileBarChart" iconBg="bg-emerald-50" iconColor="text-emerald-600" @file="handleFile" />

        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 animate-fade-in">
          <div class="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
              <SlidersHorizontal class="w-4 h-4 text-slate-500" /> 分析配置
            </h3>
            <button @click="reset" class="text-xs text-red-500 hover:underline">重置</button>
          </div>

          <div class="space-y-4">
            <!-- 分析主题 -->
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5">分析主题 (可选)</label>
              <input v-model="analysisTheme" type="text" placeholder="如：客户满意度、产品质量、销售趋势..."
                class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500" />
              <button @click="recommendColumns" :disabled="isRecommending || !analysisTheme.trim()"
                class="mt-2 w-full py-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                <Wand2 class="w-3 h-3" :class="{ 'animate-spin': isRecommending }" />
                {{ isRecommending ? 'AI 推荐中...' : 'AI 推荐分析列' }}
              </button>
              <div v-if="recommendedAngles.length > 0" class="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2 space-y-1">
                <p class="text-[10px] font-bold text-emerald-700">AI 推荐分析角度：</p>
                <p v-for="(a, i) in recommendedAngles" :key="i" class="text-[10px] text-emerald-600">· {{ a }}</p>
              </div>
            </div>

            <!-- 分析列选择 -->
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5">分析列 (多选)</label>
              <div class="max-h-36 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1 custom-scrollbar">
                <label v-for="(h, i) in headers" :key="i" class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-100 px-1 py-0.5 rounded">
                  <input type="checkbox" :value="i" v-model="selectedCols"
                    class="rounded text-emerald-600 focus:ring-emerald-500" />
                  {{ h }}
                </label>
              </div>
              <p class="text-[9px] text-slate-400 mt-1">选择要纳入统计分析的列，默认全选</p>
            </div>

            <!-- AI 打标列选择 -->
            <div v-if="dataShare.labelingResults?.outputColumns?.length">
              <label class="block text-xs font-bold text-violet-700 mb-1.5 flex items-center gap-1.5">
                <Tag class="w-3.5 h-3.5" /> AI 打标列
                <span class="text-[10px] font-normal text-violet-500">({{ selectedLabelingCols.length }} / {{ dataShare.labelingResults.outputColumns.length }})</span>
              </label>
              <div class="max-h-36 overflow-y-auto bg-violet-50 border border-violet-200 rounded-lg p-2 space-y-1 custom-scrollbar">
                <label v-for="col in dataShare.labelingResults.outputColumns" :key="col.key"
                  class="flex items-center gap-2 text-xs text-violet-800 cursor-pointer hover:bg-violet-100 px-1 py-0.5 rounded">
                  <input type="checkbox" :value="col.key" v-model="selectedLabelingCols"
                    class="rounded text-violet-600 focus:ring-violet-500" />
                  <Tag class="w-3 h-3 text-violet-500 shrink-0" />
                  <span class="truncate">{{ col.name }}</span>
                </label>
              </div>
              <p class="text-[9px] text-violet-400 mt-1">智能加工产出的列，默认全部纳入；可取消勾选以排除</p>
            </div>

            <!-- 数据概况 -->
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs text-slate-600">
              <div class="flex justify-between"><span>行数</span><span class="font-mono font-bold text-slate-800">{{ rows.length }}</span></div>
              <div class="flex justify-between"><span>选中原始列</span><span class="font-mono font-bold text-slate-800">{{ selectedCols.length }} / {{ headers.length }}</span></div>
              <div v-if="dataShare.labelingResults?.outputColumns?.length" class="flex justify-between">
                <span>选中 AI 打标列</span>
                <span class="font-mono font-bold text-violet-700">{{ selectedLabelingCols.length }} / {{ dataShare.labelingResults.outputColumns.length }}</span>
              </div>
              <div class="flex justify-between"><span>平均非空率</span><span class="font-mono font-bold text-slate-800">{{ averageFillRate }}%</span></div>
            </div>

            <button @click="generateSummary" :disabled="isSummarizing || selectedCols.length === 0"
              class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <Sparkles class="w-4 h-4" :class="{ 'animate-spin': isSummarizing }" />
              {{ isSummarizing ? 'AI 分析中...' : '开始生成数据摘要' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：统计 + 报告 -->
      <div class="lg:col-span-8 space-y-6">
        <!-- 统计卡片 -->
        <div v-if="hasData" class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-slate-400 uppercase">总行数</div>
            <div class="text-2xl font-black text-slate-800 mt-1 font-mono">{{ rows.length }}</div>
          </div>
          <div class="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-emerald-600 uppercase">分析列</div>
            <div class="text-2xl font-black text-emerald-800 mt-1 font-mono">{{ selectedCols.length }}</div>
          </div>
          <div class="bg-teal-50 rounded-xl border border-teal-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-teal-600 uppercase">平均非空率</div>
            <div class="text-2xl font-black text-teal-800 mt-1 font-mono">{{ averageFillRate }}%</div>
          </div>
          <div class="bg-slate-50 rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-slate-500 uppercase">报告状态</div>
            <div class="text-xs font-black text-slate-700 mt-2">{{ summaryText ? '已生成' : '待分析' }}</div>
          </div>
        </div>

        <!-- 列类型分布 -->
        <div v-if="hasData && columnTypeDistribution.length > 0" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-fade-in">
          <div class="text-xs font-bold text-slate-700 mb-2">列类型分布</div>
          <div class="flex flex-wrap gap-2">
            <span v-for="ct in columnTypeDistribution" :key="ct.type"
              class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
              :class="typeChipClass(ct.type)">
              {{ ct.typeLabel }} {{ ct.count }}
            </span>
          </div>
        </div>

        <!-- 报告 -->
        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px] overflow-hidden animate-fade-in">
          <div class="px-5 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <span class="text-xs font-bold text-slate-700 flex items-center gap-2">
              <FileBarChart class="w-4 h-4 text-emerald-500" /> AI 数据分析报告
            </span>
            <button v-if="summaryText" @click="summaryText = ''"
              class="text-[10px] text-slate-400 hover:text-slate-600">清除报告</button>
          </div>

          <div class="flex-1 overflow-auto p-6 relative">
            <div v-if="!summaryText && !isSummarizing" class="flex flex-col items-center justify-center h-full text-slate-300">
              <FileBarChart class="w-16 h-16 mb-4 opacity-50" />
              <p class="text-sm">选择分析列，点击"开始生成数据摘要"</p>
            </div>

            <div v-if="isSummarizing && !summaryText" class="flex flex-col items-center justify-center h-full">
              <Loader2 class="w-10 h-10 text-emerald-600 animate-spin mb-4" />
              <p class="text-sm text-emerald-600 font-bold animate-pulse">AI 正在深度扫描并撰写报告...</p>
            </div>

            <div v-if="summaryText" class="prose prose-sm prose-slate max-w-none" v-html="renderedSummary"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { renderMarkdown } from '../services/markdown'
import { FileBarChart, SlidersHorizontal, Sparkles, Loader2, Lightbulb, Wand2, Tag } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import { useImportIntentStore } from '../stores/importIntent'
import FileUploader from '../components/common/FileUploader.vue'
import MobileCollapsible from '../components/common/MobileCollapsible.vue'
import { DEMO_DATA } from '../services/excel'
import { callStreamingAI, callAI } from '../services/ai'
import { getDataSummaryPrompt, getAnalysisThemePrompt, formatIntentContext } from '../services/prompts'
import { parseRobustJSON } from '../services/jsonParser'
import { useSettingsStore } from '../stores/settings'
import { useDevice } from '../composables/useDevice'
import { useGlobalDataSync } from '../composables/useGlobalDataSync'
import { useFileUpload } from '../composables/useFileUpload'
import { computeAllProfiles, computeColumnProfile, formatProfilesForAI, stratifiedSample, formatSampleRows, detectColumnType } from '../services/dataProfiler'
import { useToast } from '../services/toast'
import { PAGE } from '../styles/tokens'
import PageHeader from '../components/common/PageHeader.vue'
import GlobalDataBanner from '../components/common/GlobalDataBanner.vue'

const toast = useToast()
const dataShare = useDataShareStore()
const intent = useImportIntentStore()
const settings = useSettingsStore()
const { isMobile } = useDevice()

const { headers, rows, hasData, disconnectGlobalExcel } = useGlobalDataSync({
  onInit: (h) => {
    // 消费 AI 预演的摘要方案：关注列 + 主题（来自意图弹窗三步规划）
    const plan = intent.pipelinePlan?.summary
    if (plan?.focusColumns?.length) {
      selectedCols.value = plan.focusColumns
    } else {
      selectedCols.value = h.map((_, i) => i)
    }
    if (plan?.theme && !analysisTheme.value) {
      analysisTheme.value = plan.theme
    }
    summaryText.value = ''
  }
})

const { handleFile } = useFileUpload({
  onFileLoaded: (data) => {
    selectedCols.value = data.headers.map((_, i) => i)
    summaryText.value = ''
  }
})

const isSummarizing = ref(false)
const summaryText = ref('')
const selectedCols = ref([])
const selectedLabelingCols = ref([])
const analysisTheme = ref('')
const isRecommending = ref(false)
const recommendedAngles = ref([])
const renderedSummary = computed(() => renderMarkdown(summaryText.value))

const averageFillRate = computed(() => {
  if (!rows.value.length || !headers.value.length) return 0
  let total = 0, nonNull = 0
  for (const ci of selectedCols.value.length > 0 ? selectedCols.value : headers.value.map((_, i) => i)) {
    for (const row of rows.value) {
      total++
      if (row[ci] != null && row[ci] !== '') nonNull++
    }
  }
  return total > 0 ? Math.round(nonNull / total * 100) : 0
})

// 列类型分布
const columnTypeDistribution = computed(() => {
  if (!rows.value.length) return []
  const counts = {}
  const cols = selectedCols.value.length > 0 ? selectedCols.value : headers.value.map((_, i) => i)
  for (const ci of cols) {
    const values = rows.value.map(r => r[ci])
    const type = detectColumnType(values)
    counts[type] = (counts[type] || 0) + 1
  }
  const labels = { number: '数值', text: '文本', enum: '枚举', boolean: '布尔', date: '日期', identifier: '标识符' }
  return Object.entries(counts).map(([type, count]) => ({ type, count, typeLabel: labels[type] || type }))
})

function typeChipClass(type) {
  const map = {
    number: 'bg-blue-100 text-blue-700',
    text: 'bg-violet-100 text-violet-700',
    enum: 'bg-amber-100 text-amber-700',
    boolean: 'bg-green-100 text-green-700',
    date: 'bg-teal-100 text-teal-700',
    identifier: 'bg-slate-100 text-slate-700'
  }
  return map[type] || 'bg-slate-100 text-slate-600'
}

// 全选/取消联动
watch(() => headers.value.length, () => {
  if (headers.value.length > 0) selectedCols.value = headers.value.map((_, i) => i)
})

// AI 打标列就绪时默认全选（保留原"自动纳入"语义，但用户可手动取消）
watch(() => dataShare.labelingResults?.outputColumns, (cols) => {
  if (cols?.length) selectedLabelingCols.value = cols.map(c => c.key)
}, { immediate: true, deep: true })

function reset() {
  headers.value = []
  rows.value = []
  summaryText.value = ''
  selectedCols.value = []
  selectedLabelingCols.value = []
  analysisTheme.value = ''
  recommendedAngles.value = []
}

async function recommendColumns() {
  if (!analysisTheme.value.trim() || isRecommending.value) return
  if (!settings.isConfigured) { settings.showSettings = true; toast.warn('请先配置 API 密钥'); return }
  isRecommending.value = true
  recommendedAngles.value = []

  try {
    const allColIndexes = headers.value.map((_, i) => i)
    const profiles = computeAllProfiles(headers.value, rows.value, allColIndexes)
    const profilesText = formatProfilesForAI(profiles)

    let labelingInfo = ''
    if (dataShare.labelingResults?.outputColumns?.length) {
      labelingInfo = dataShare.labelingResults.outputColumns.map(c =>
        `- ${c.name} (key: ${c.key}, type: ${c.type})`
      ).join('\n')
    }

    const prompt = getAnalysisThemePrompt(analysisTheme.value.trim(), profilesText, labelingInfo)
    const res = await callAI(prompt, '你是一个数据分析策略专家。', settings.getApiConfig().workModel)
    const parsed = parseRobustJSON(res)

    if (parsed.focusColumns?.length) {
      const validIndexes = parsed.focusColumns
        .map(c => c.columnIndex)
        .filter(i => i >= 0 && i < headers.value.length)
      if (validIndexes.length > 0) {
        selectedCols.value = [...new Set(validIndexes)]
      }
    }
    if (parsed.analysisAngles?.length) {
      recommendedAngles.value = parsed.analysisAngles
    }
    if (parsed.theme) {
      analysisTheme.value = parsed.theme
    }
    toast.success(`AI 推荐了 ${selectedCols.value.length} 个分析列`)
  } catch (e) {
    toast.error('AI 推荐失败: ' + e.message)
  } finally {
    isRecommending.value = false
  }
}

async function generateSummary() {
  if (isSummarizing.value || selectedCols.value.length === 0) return
  isSummarizing.value = true
  summaryText.value = ''

  try {
    // 1. 列画像
    const profiles = computeAllProfiles(headers.value, rows.value, selectedCols.value)

    // 2. AI 打标结果作为虚拟列（仅纳入用户勾选的）
    const labelingProfiles = []
    if (dataShare.labelingResults?.analysisMap) {
      const lr = dataShare.labelingResults
      const doneRows = Object.values(lr.analysisMap).filter(r => r.status === 'done')
      for (const col of lr.outputColumns) {
        if (!selectedLabelingCols.value.includes(col.key)) continue
        const values = doneRows.map(r => r.values?.[col.key] ?? null)
        labelingProfiles.push({
          ...computeColumnProfile(col.name + ' (AI)', values),
          isAILabel: true
        })
      }
    }
    const allProfiles = [...profiles, ...labelingProfiles]

    // 3. 格式化
    const profilesText = formatProfilesForAI(allProfiles)
    const datasetMeta = `${rows.value.length} 行 x ${allProfiles.length} 列 (原始 ${headers.value.length} 列${labelingProfiles.length > 0 ? ` + ${labelingProfiles.length} AI打标列` : ''})`

    // 4. 分层样本
    const sample = stratifiedSample(headers.value, rows.value, 6)
    const sampleText = formatSampleRows(sample)

    // 5. 调用 AI
    const { systemPrompt: rawSys, userPrompt } = getDataSummaryPrompt(
      profilesText, datasetMeta, sampleText,
      analysisTheme.value.trim() || null,
      recommendedAngles.value.length > 0 ? recommendedAngles.value : null
    )
    // 意图上下文作为参考段追加（不覆盖摘要自己的 theme）
    const systemPrompt = rawSys + formatIntentContext(dataShare.intentNote, '数据摘要与洞察')
    await callStreamingAI(systemPrompt, userPrompt, (chunk) => { summaryText.value += chunk })
  } catch (e) {
    summaryText.value += `\n\n[错误] ${e.message}`
  }
  isSummarizing.value = false
}

function loadDemo() {
  const demo = DEMO_DATA.comments
  headers.value = [...demo.headers]
  rows.value = demo.rows.map(r => [...r])
  selectedCols.value = headers.value.map((_, i) => i)
  summaryText.value = ''
  dataShare.setSharedData(headers.value, rows.value, '数据摘要示例.xlsx')
}
</script>
