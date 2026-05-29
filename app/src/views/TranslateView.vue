<template>
  <div class="animate-fade-in max-w-7xl mx-auto space-y-6">
    <!-- Header Summary Card -->
    <div class="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-2xl border border-blue-200/50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Languages class="w-6 h-6 text-blue-600 animate-bounce" /> AI 批量翻译系统
        </h2>
        <p class="text-xs text-slate-500 mt-1">
          基于大语言模型构建的多场景批量翻译套件，支持电商参数、多语种评论的高容错整列翻译。
        </p>
      </div>
      <button v-if="!hasData" @click="loadDemo" 
        class="px-4 py-2 bg-white hover:bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0">
        <Globe class="w-3.5 h-3.5" /> 加载产品参数示例
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
      <!-- Left Panel: Config Panel -->
      <div class="lg:col-span-4 space-y-6">
        <FileUploader v-if="!hasData" label="上传翻译文件" :icon="Languages" iconBg="bg-blue-50" iconColor="text-blue-600" @file="handleFile" />

        <!-- Config -->
        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-fade-in">
          <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
              <SlidersHorizontal class="w-4.5 h-4.5 text-slate-500" /> 翻译配置
            </h3>
            <button @click="reset" class="text-xs text-red-500 hover:underline">重置</button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5">源列 (翻译目标列)</label>
              <select v-if="headers.length > 0" :value="dataShare.coreColumn" @change="e => dataShare.setCoreColumn(e.target.value)" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500">
                <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5">翻译场景类型</label>
              <select v-model="scenario" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500">
                <option v-for="s in TRANSLATE_SCENARIOS" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5">语言翻译方向</label>
              <select v-model="direction" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500">
                <option v-for="d in LANGUAGE_DIRECTIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
            </div>
            <button @click="startTranslate" :disabled="isTranslating"
              class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Play class="w-4 h-4" /> {{ isTranslating ? '翻译中...' : '开始批量翻译' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Right Panel: Data Table & Dashboard -->
      <div class="lg:col-span-8 space-y-6">
        <!-- Dashboard Statistics -->
        <div v-if="hasData" class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-slate-400 uppercase">原始数据量</div>
            <div class="text-2xl font-black text-slate-800 mt-1 font-mono">{{ rows.length }}</div>
            <div class="text-[9px] text-slate-400 mt-0.5">全表 100% 数据</div>
          </div>

          <div class="bg-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-blue-600 uppercase">已处理行数</div>
            <div class="text-2xl font-black text-blue-800 mt-1 font-mono">{{ processed }}</div>
            <div class="text-[9px] text-blue-600/80 mt-0.5">翻译进度 {{ rows.length ? Math.round(processed/rows.length*100) : 0 }}%</div>
          </div>

          <div class="bg-indigo-50 rounded-xl border border-indigo-200 p-4 shadow-sm min-w-0">
            <div class="text-[10px] font-bold text-indigo-600 uppercase">翻译场景</div>
            <div class="text-xs font-black text-indigo-800 mt-2.5 truncate" :title="scenarioLabel">{{ scenarioLabel }}</div>
            <div class="text-[9px] text-indigo-600/80 mt-1">自动识别列特性</div>
          </div>

          <div class="bg-slate-50 rounded-xl border border-slate-200 p-4 shadow-sm min-w-0">
            <div class="text-[10px] font-bold text-slate-500 uppercase">语言方向</div>
            <div class="text-xs font-black text-slate-700 mt-2.5 truncate" :title="directionLabel">{{ directionLabel }}</div>
            <div class="text-[9px] text-slate-400 mt-1">AI 自动判定源语言</div>
          </div>
        </div>

        <!-- DataTable Container -->
        <div class="relative">
          <DataTable title="翻译预览与结果" :headers="displayHeaders" :rows="displayRows" :rowCount="rows.length" heightClass="h-[520px]">
            <template #actions>
              <button v-if="translated" @click="exportResult" class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-blue-600 hover:border-blue-400 transition-all flex items-center gap-1 shadow-sm">
                <Download class="w-3 h-3" /> 导出结果
              </button>
            </template>
            <template #overlay>
              <ProgressOverlay :visible="isTranslating" :current="processed" :total="rows.length" text="AI 批量翻译中..." />
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Languages, Globe, SlidersHorizontal, Play, Download, Check } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import FileUploader from '../components/common/FileUploader.vue'
import DataTable from '../components/common/DataTable.vue'
import ProgressOverlay from '../components/common/ProgressOverlay.vue'
import { readFile, exportToXlsx, DEMO_DATA } from '../services/excel'
import { callAI, callAIBatch } from '../services/ai'
import { TRANSLATE_SCENARIOS, LANGUAGE_DIRECTIONS, getTranslatePrompt } from '../services/prompts'
import { useToast } from '../services/toast'

const toast = useToast()
const dataShare = useDataShareStore()

const headers = ref([])
const rows = ref([])
const sourceCol = computed(() => dataShare.coreColumn)
const scenario = ref('ecommerce_spec')
const direction = ref('auto_to_zh')
const isTranslating = ref(false)
const processed = ref(0)
const translated = ref(false)
const resultCol = ref(-1)

const hasData = computed(() => rows.value.length > 0)

const displayHeaders = computed(() => {
  if (resultCol.value >= 0 && headers.value[resultCol.value]) {
    return [...headers.value]
  }
  return headers.value
})

const displayRows = computed(() => rows.value)

const scenarioLabel = computed(() => {
  const s = TRANSLATE_SCENARIOS.find(x => x.value === scenario.value)
  return s ? s.label : scenario.value
})

const directionLabel = computed(() => {
  const d = LANGUAGE_DIRECTIONS.find(x => x.value === direction.value)
  return d ? d.label : direction.value
})

onMounted(() => {
  if (dataShare.hasData && rows.value.length === 0) {
    importGlobalExcel()
  }
})

function importGlobalExcel() {
  headers.value = [...dataShare.headers]
  rows.value = dataShare.rows.map(r => [...r])
  translated.value = false
  resultCol.value = -1
}

function disconnectGlobalExcel() {
  dataShare.clearSharedData()
  reset()
}

function detectBestColumn() {
  // 已废弃，完全由全局 store 自动启发式推荐
}

async function handleFile(file) {
  try {
    const data = await readFile(file)
    headers.value = data.headers.map(String)
    rows.value = data.rows
    translated.value = false
    resultCol.value = -1
    
    // 同步至全局，全局会自动启发式计算核心列 (传递 true 开启首次推荐)
    dataShare.setSharedData(headers.value, rows.value, file.name, true)
  } catch (err) {
    toast.error(err.message)
  }
}

function loadDemo() {
  const demo = DEMO_DATA.specs
  dataShare.setSharedData(demo.headers, demo.rows, '产品参数示例.csv', true)
  headers.value = [...demo.headers]
  rows.value = demo.rows.map(r => [...r])
  translated.value = false
  resultCol.value = -1
}

function reset() {
  headers.value = []
  rows.value = []
  translated.value = false
  resultCol.value = -1
}

async function startTranslate() {
  if (isTranslating.value || !rows.value.length) return
  isTranslating.value = true
  processed.value = 0

  // Add result column
  const newColName = '翻译结果'
  if (!headers.value.includes(newColName)) {
    headers.value.push(newColName)
  }
  resultCol.value = headers.value.indexOf(newColName)

  const systemPrompt = getTranslatePrompt(scenario.value, direction.value)

  // 构建任务列表，空行直接设为空字符串
  const tasks = []
  for (let i = 0; i < rows.value.length; i++) {
    const text = rows.value[i][sourceCol.value]
    if (!text) {
      rows.value[i][resultCol.value] = ''
      processed.value++
    } else {
      tasks.push({ content: String(text), systemPrompt, index: i })
    }
  }

  // 并发调用 AI，每完成一行实时回写
  await callAIBatch(
    tasks.map(t => ({ content: t.content, systemPrompt: t.systemPrompt })),
    (batchIdx, result, error) => {
      const rowIdx = tasks[batchIdx].index
      rows.value[rowIdx][resultCol.value] = error ? `[Error] ${error.message}` : result
      processed.value++
      dataShare.setSharedData(headers.value, rows.value, dataShare.sourceName || '翻译中数据.xlsx')
    },
    3
  )

  isTranslating.value = false
  translated.value = true
}

function exportResult() {
  const exportRows = rows.value.map(r => [...r])
  exportToXlsx(headers.value, exportRows, '翻译结果.xlsx')
}
</script>
