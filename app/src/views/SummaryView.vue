<template>
  <div class="animate-fade-in max-w-7xl mx-auto space-y-6">
    <!-- Header Summary Card -->
    <div class="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl border border-emerald-200/50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileBarChart class="w-6 h-6 text-emerald-600 animate-bounce" /> AI 数据摘要 system
        </h2>
        <p class="text-xs text-slate-500 mt-1">
          快速扫描整张 Excel 数据表，自动生成业务数据特征、列重要统计度及高维商业洞察分析报告。
        </p>
      </div>
      <button v-if="!hasData" @click="loadDemo" 
        class="px-4 py-2 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0">
        <FileBarChart class="w-3.5 h-3.5" /> 加载分析样本数据
      </button>
    </div>

    <!-- 全局活跃 Excel 关联状态横幅 -->
    <div v-if="hasData && dataShare.hasData" 
      class="bg-emerald-500/10 rounded-xl border border-emerald-500/20 px-4 py-3 flex justify-between items-center text-xs animate-fade-in">
      <div class="flex items-center gap-2 text-emerald-800">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>当前已成功关联全局活跃工作表：<strong class="font-semibold">{{ dataShare.sourceName }}</strong> (全表 {{ rows.length }} 行)</span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 hover:text-rose-600 font-bold hover:underline">
        断开全局关联
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Panel: Config / Column Stats -->
      <div class="lg:col-span-4 space-y-6">
        <FileUploader v-if="!hasData" label="上传数据文件" :icon="FileBarChart" iconBg="bg-emerald-50" iconColor="text-emerald-600" @file="handleFile" />

        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-fade-in">
          <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
              <SlidersHorizontal class="w-4.5 h-4.5 text-slate-500" /> 数据属性概览
            </h3>
            <button @click="reset" class="text-xs text-red-500 hover:underline">重置</button>
          </div>
          
          <div class="space-y-2 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200/50">
            <div class="flex justify-between"><span>列数</span><span class="font-mono font-bold text-slate-800">{{ headers.length }}</span></div>
            <div class="flex justify-between"><span>行数</span><span class="font-mono font-bold text-slate-800">{{ rows.length }}</span></div>
          </div>
          
          <!-- Column Info Table -->
          <div class="overflow-hidden border border-slate-200 rounded-lg mb-4">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
                <tr><th class="p-2.5">列名</th><th class="p-2.5 text-right">非空行</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-slate-600">
                <tr v-for="(h, i) in headers" :key="i" class="hover:bg-slate-50/50">
                  <td class="p-2.5 font-medium truncate max-w-[140px]">{{ h }}</td>
                  <td class="p-2.5 text-right font-mono font-bold text-slate-700">{{ nonNullCount(i) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <button @click="generateSummary" :disabled="isSummarizing"
            class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            <Sparkles class="w-4 h-4" /> {{ isSummarizing ? '分析中...' : '开始生成数据摘要' }}
          </button>
        </div>
      </div>

      <!-- Right Panel: Report Dashboard & Content -->
      <div class="lg:col-span-8 space-y-6">
        <!-- Dashboard Statistics -->
        <div v-if="hasData" class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-slate-400 uppercase">原始数据量</div>
            <div class="text-2xl font-black text-slate-800 mt-1 font-mono">{{ rows.length }}</div>
            <div class="text-[9px] text-slate-400 mt-0.5">全表 100% 数据</div>
          </div>

          <div class="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-emerald-600 uppercase">表头总列数</div>
            <div class="text-2xl font-black text-emerald-800 mt-1 font-mono">{{ headers.length }}</div>
            <div class="text-[9px] text-emerald-600/80 mt-0.5">多维特征属性</div>
          </div>

          <div class="bg-teal-50 rounded-xl border border-teal-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-teal-600 uppercase">数据平均非空率</div>
            <div class="text-2xl font-black text-teal-800 mt-1 font-mono">{{ averageFillRate }}%</div>
            <div class="text-[9px] text-teal-600/80 mt-0.5">衡量数据集质量</div>
          </div>

          <div class="bg-slate-50 rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-slate-500 uppercase">分析报告状态</div>
            <div class="text-xs font-black text-slate-700 mt-2 truncate">{{ summaryText ? '✅ 已生成' : '⏳ 待分析' }}</div>
            <div class="text-[9px] text-slate-400 mt-1">AI 深度学习洞察</div>
          </div>
        </div>

        <!-- Report Content Card -->
        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px] overflow-hidden animate-fade-in">
          <div class="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <span class="text-xs font-bold text-slate-700 flex items-center gap-2">
              <FileBarChart class="w-4 h-4 text-emerald-500" /> AI 数据分析报告
            </span>
          </div>
          
          <div class="flex-1 overflow-auto p-6 relative">
            <div v-if="!summaryText && !isSummarizing" class="flex flex-col items-center justify-center h-full text-slate-300">
              <FileBarChart class="w-16 h-16 mb-4 opacity-50 text-slate-300" />
              <p class="text-sm">点击左侧"开始生成数据摘要"以生成分析报告</p>
            </div>
            
            <div v-if="isSummarizing" class="flex flex-col items-center justify-center h-full">
              <Loader2 class="w-10 h-10 text-emerald-600 animate-spin mb-4" />
              <p class="text-sm text-emerald-600 font-bold animate-pulse">AI 正在深度扫描并撰写您的报告...</p>
            </div>
            
            <div v-if="summaryText" class="prose prose-sm prose-slate max-w-none" v-html="renderedSummary"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { FileBarChart, SlidersHorizontal, Sparkles, Loader2, Check } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import FileUploader from '../components/common/FileUploader.vue'
import { readFile, DEMO_DATA } from '../services/excel'
import { callStreamingAI } from '../services/ai'

const dataShare = useDataShareStore()

const headers = ref([])
const rows = ref([])
const isSummarizing = ref(false)
const summaryText = ref('')

const hasData = computed(() => rows.value.length > 0)
const renderedSummary = computed(() => summaryText.value.replace(/\n/g, '<br>'))

// 数据平均非空率计算
const averageFillRate = computed(() => {
  if (rows.value.length === 0 || headers.value.length === 0) return 0
  let totalCells = rows.value.length * headers.value.length
  let nonNullCells = 0
  for (let i = 0; i < headers.value.length; i++) {
    nonNullCells += nonNullCount(i)
  }
  return Math.round((nonNullCells / totalCells) * 100)
})

function nonNullCount(colIdx) {
  return rows.value.filter(r => r[colIdx] != null && r[colIdx] !== '').length
}

onMounted(() => {
  if (dataShare.hasData && rows.value.length === 0) {
    importGlobalExcel()
  }
})

function importGlobalExcel() {
  headers.value = [...dataShare.headers]
  rows.value = dataShare.rows.map(r => [...r])
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
    summaryText.value = ''
    
    // 同步到全局
    dataShare.setSharedData(headers.value, rows.value, file.name)
  } catch (err) { alert(err.message) }
}

function reset() { 
  headers.value = []
  rows.value = []
  summaryText.value = '' 
}

async function generateSummary() {
  if (isSummarizing.value) return
  isSummarizing.value = true
  summaryText.value = ''

  const sample = rows.value.slice(0, 10).map(r =>
    headers.value.map((h, i) => `${h}: ${r[i] ?? ''}`).join(', ')
  ).join('\n')

  const systemPrompt = '你是一个数据分析专家。请用中文分析以下数据集，给出详细的数据概述、统计特征和业务洞察。使用 Markdown 格式输出，包含标题、列表和关键数据的加粗。'
  const userPrompt = `数据集包含 ${rows.value.length} 行、${headers.value.length} 列。\n列名：${headers.value.join(', ')}\n\n前10行样本数据：\n${sample}`

  try {
    await callStreamingAI(systemPrompt, userPrompt, (chunk) => { summaryText.value += chunk })
  } catch (e) {
    summaryText.value += `\n\n[错误] ${e.message}`
  }
  isSummarizing.value = false
}

// 加载 Demo 样本数据
function loadDemo() {
  const demo = DEMO_DATA.comments
  headers.value = [...demo.headers]
  rows.value = demo.rows.map(r => [...r])
  summaryText.value = ''
  
  // 同步到全局
  dataShare.setSharedData(headers.value, rows.value, '数据摘要示例数据.xlsx')
}
</script>
