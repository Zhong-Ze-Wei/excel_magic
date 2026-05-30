<template>
  <div class="animate-fade-in max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl border border-emerald-200/50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileBarChart class="w-6 h-6 text-emerald-600" /> AI 数据摘要
        </h2>
        <p class="text-xs text-slate-500 mt-1">
          自动分析全表列级统计画像，生成高维数据洞察报告。
        </p>
      </div>
      <button v-if="!hasData" @click="loadDemo"
        class="px-4 py-2 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0">
        <FileBarChart class="w-3.5 h-3.5" /> 加载示例数据
      </button>
    </div>

    <!-- 全局关联横幅 -->
    <div v-if="hasData && dataShare.hasData"
      class="bg-emerald-500/10 rounded-xl border border-emerald-500/20 px-4 py-3 flex justify-between items-center text-xs animate-fade-in">
      <div class="flex items-center gap-2 text-emerald-800">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>已关联：<strong>{{ dataShare.sourceName }}</strong> ({{ rows.length }} 行)</span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 hover:text-rose-600 font-bold hover:underline">断开</button>
    </div>

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

            <!-- 交叉分析维度（暂隐藏，AI 可自动发现交叉关系） -->
            <div v-if="false && selectedCols.length >= 2">
              <label class="block text-xs font-bold text-slate-600 mb-1.5">交叉分析维度 (最多 2 个)</label>
              <div class="max-h-28 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1 custom-scrollbar">
                <label v-for="i in selectedCols" :key="'dim-'+i" class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-100 px-1 py-0.5 rounded">
                  <input type="checkbox" :value="i" v-model="crossDimCols" :disabled="crossDimCols.length >= 2 && !crossDimCols.includes(i)"
                    class="rounded text-emerald-600 focus:ring-emerald-500" />
                  {{ headers[i] }}
                </label>
              </div>
              <p class="text-[9px] text-slate-400 mt-1">选择分组维度，系统将按维度做交叉统计</p>
            </div>

            <!-- 数据概况 -->
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs text-slate-600">
              <div class="flex justify-between"><span>行数</span><span class="font-mono font-bold text-slate-800">{{ rows.length }}</span></div>
              <div class="flex justify-between"><span>选中列</span><span class="font-mono font-bold text-slate-800">{{ selectedCols.length }} / {{ headers.length }}</span></div>
              <div class="flex justify-between"><span>平均非空率</span><span class="font-mono font-bold text-slate-800">{{ averageFillRate }}%</span></div>
            </div>

            <!-- AI 打标结果提示 -->
            <div v-if="dataShare.labelingResults" class="bg-violet-50 p-3 rounded-lg border border-violet-200 text-xs text-violet-700">
              <span class="font-bold">AI 打标结果已就绪</span> ({{ dataShare.labelingResults.outputColumns.length }} 列)
              <br>分析时将自动纳入打标列作为额外维度
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
import { ref, computed, watch, onMounted } from 'vue'
import { marked } from 'marked'
import { FileBarChart, SlidersHorizontal, Sparkles, Loader2 } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import FileUploader from '../components/common/FileUploader.vue'
import { readFile, DEMO_DATA } from '../services/excel'
import { callStreamingAI } from '../services/ai'
import { getDataSummaryPrompt } from '../services/prompts'
import { computeAllProfiles, computeCrossTabs, formatProfilesForAI, stratifiedSample, formatSampleRows, detectColumnType } from '../services/dataProfiler'
import { useToast } from '../services/toast'

const toast = useToast()
const dataShare = useDataShareStore()

const headers = ref([])
const rows = ref([])
const isSummarizing = ref(false)
const summaryText = ref('')
const selectedCols = ref([])
const crossDimCols = ref([])

const hasData = computed(() => rows.value.length > 0)
const renderedSummary = computed(() => {
  if (!summaryText.value) return ''
  try { return marked(summaryText.value) } catch { return summaryText.value.replace(/\n/g, '<br>') }
})

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
watch(hasData, (v) => {
  if (v) selectedCols.value = headers.value.map((_, i) => i)
})

watch(() => headers.value.length, () => {
  if (headers.value.length > 0) selectedCols.value = headers.value.map((_, i) => i)
})

onMounted(() => {
  if (dataShare.hasData && rows.value.length === 0) importGlobalExcel()
})

function importGlobalExcel() {
  headers.value = [...dataShare.headers]
  rows.value = dataShare.rows.map(r => [...r])
  selectedCols.value = headers.value.map((_, i) => i)
  crossDimCols.value = []
  summaryText.value = ''
}

function disconnectGlobalExcel() {
  dataShare.clearSharedData()
  reset()
}

async function handleFile(file) {
  try {
    const data = await readFile(file)
    headers.value = data.headers.map(String)
    rows.value = data.rows
    selectedCols.value = headers.value.map((_, i) => i)
    crossDimCols.value = []
    summaryText.value = ''
    dataShare.setSharedData(headers.value, rows.value, file.name)
  } catch (err) { toast.error(err.message) }
}

function reset() {
  headers.value = []
  rows.value = []
  summaryText.value = ''
  selectedCols.value = []
  crossDimCols.value = []
}

async function generateSummary() {
  if (isSummarizing.value || selectedCols.value.length === 0) return
  isSummarizing.value = true
  summaryText.value = ''

  try {
    // 1. 列画像
    const profiles = computeAllProfiles(headers.value, rows.value, selectedCols.value)

    // 2. AI 打标结果作为虚拟列
    const labelingProfiles = []
    if (dataShare.labelingResults?.analysisMap) {
      const lr = dataShare.labelingResults
      const doneRows = Object.values(lr.analysisMap).filter(r => r.status === 'done')
      for (const col of lr.outputColumns) {
        const values = doneRows.map(r => r.values?.[col.key] ?? null)
        labelingProfiles.push({
          ...computeColumnProfile(col.name + ' (AI)', values),
          isAILabel: true
        })
      }
    }
    const allProfiles = [...profiles, ...labelingProfiles]

    // 3. 交叉统计
    const valueColIndexes = selectedCols.value.filter(i => !crossDimCols.value.includes(i))
    const crossTabs = crossDimCols.value.length > 0 && valueColIndexes.length > 0
      ? computeCrossTabs(headers.value, rows.value, crossDimCols.value, valueColIndexes)
      : []

    // 4. 格式化
    const profilesText = formatProfilesForAI(allProfiles, crossTabs)
    const crossTabsText = crossTabs.length > 0 ? '' : '' // 已内嵌在 profilesText 中
    const datasetMeta = `${rows.value.length} 行 x ${allProfiles.length} 列 (原始 ${headers.value.length} 列${labelingProfiles.length > 0 ? ` + ${labelingProfiles.length} AI打标列` : ''})`

    // 5. 分层样本
    const sample = stratifiedSample(headers.value, rows.value, 6)
    const sampleText = formatSampleRows(sample)

    // 6. 调用 AI
    const { systemPrompt, userPrompt } = getDataSummaryPrompt(profilesText, datasetMeta, crossTabsText, sampleText)
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
  crossDimCols.value = []
  summaryText.value = ''
  dataShare.setSharedData(headers.value, rows.value, '数据摘要示例.xlsx')
}
</script>
