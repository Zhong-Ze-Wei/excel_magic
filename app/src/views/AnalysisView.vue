<template>
  <div class="animate-fade-in max-w-7xl mx-auto space-y-6">
    <!-- Header Summary Card -->
    <div class="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-2xl border border-violet-200/50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Brain class="w-6 h-6 text-violet-600 animate-bounce" /> 智能数据分析系统
        </h2>
        <p class="text-xs text-slate-500 mt-1">
          整合大模型自然语言处理，对社交、电商等各类数据进行情感判定与双层树状标签自动分类。
        </p>
      </div>
      <button v-if="!hasData" @click="loadDemo" 
        class="px-4 py-2 bg-white hover:bg-violet-50 border border-violet-200 text-violet-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0">
        <Brain class="w-3.5 h-3.5" /> 加载用户评论示例
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
        <FileUploader v-if="!hasData" label="上传评论文件" :icon="UploadCloud" iconBg="bg-violet-50" iconColor="text-violet-600" @file="handleFile" />

        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 animate-fade-in">
          <div class="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
              <SlidersHorizontal class="w-4.5 h-4.5 text-slate-500" /> 分析配置
            </h3>
            <button @click="reset" class="text-xs text-red-500 hover:underline">重置</button>
          </div>

          <div class="space-y-4">
            <!-- 评论列选择 -->
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5 flex justify-between items-center">
                <span>评论内容列</span>
                <button @click="detectColumnWithAI" :disabled="isDetectingColumn"
                  class="text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-0.5 font-bold disabled:opacity-50 transition-colors">
                  <Sparkles class="w-3 h-3 text-violet-500" :class="{ 'animate-spin': isDetectingColumn }" />
                  {{ isDetectingColumn ? '识别中...' : 'AI推荐列' }}
                </button>
              </label>
              <select v-if="headers.length > 0" :value="dataShare.coreColumn" @change="e => dataShare.setCoreColumn(e.target.value)" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500">
                <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
              </select>
            </div>

            <!-- 分析范围设置 -->
            <div class="bg-slate-50/50 p-3 rounded-lg border border-slate-200/60 space-y-2">
              <label class="block text-xs font-bold text-slate-700">分析数据范围</label>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <div class="text-[9px] text-slate-400 mb-0.5">开始行 (第1行起)</div>
                  <input type="number" v-model.number="rangeStart" min="1" :max="rows.length"
                    class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500 font-mono" />
                </div>
                <div>
                  <div class="text-[9px] text-slate-400 mb-0.5">结束行 (共 {{ rows.length }} 行)</div>
                  <input type="number" v-model.number="rangeEnd" min="1" :max="rows.length"
                    class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500 font-mono" />
                </div>
              </div>
            </div>

            <!-- 二级树状分类标签管理 -->
            <div class="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div class="flex justify-between items-center">
                <label class="block text-xs font-bold text-slate-700">分类体系 (双层树)</label>
                <button @click="generateTagsWithAI" :disabled="isGeneratingTags"
                  class="text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-0.5 font-bold disabled:opacity-50 transition-colors">
                  <Sparkles class="w-3 h-3 text-violet-500" :class="{ 'animate-pulse': isGeneratingTags }" />
                  {{ isGeneratingTags ? '分析中...' : 'AI智能生成' }}
                </button>
              </div>

              <!-- 模糊分类意图输入 -->
              <div class="relative">
                <input v-model="taxonomyGoal" type="text" placeholder="模糊生成目标，如: 侧重售后与包装 (可选)"
                  class="w-full px-2.5 py-1.5 text-[10px] border border-slate-200 rounded-lg focus:border-violet-500 outline-none bg-white placeholder-slate-400 shadow-sm" />
              </div>

              <div class="flex gap-2">
                <input v-model="newParentTag" type="text" placeholder="新增一级分类 (如: 质量)" @keydown="e => { if (e.key === 'Enter') { e.preventDefault(); addParentTag(); } }"
                  class="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:border-violet-500 outline-none bg-white" />
                <button @click="addParentTag" type="button" class="bg-violet-600 text-white px-2 py-1.5 rounded-lg hover:bg-violet-700 transition-colors text-xs font-bold flex items-center gap-0.5">
                  <Plus class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- 树状大类与子类列表 -->
              <div class="space-y-3.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                <div v-if="Object.keys(categories).length === 0" class="text-[10px] text-slate-400 italic text-center py-4">
                  暂无分类标签，请手动添加或点击AI智能生成。
                </div>
                
                <div v-for="(subTags, parent) in categories" :key="parent"
                  class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2 relative group/parent">
                  <div class="flex justify-between items-center">
                    <span class="text-xs font-bold text-violet-800 bg-violet-50 px-2 py-0.5 rounded">{{ parent }}</span>
                    <button @click="removeParentTag(parent)" type="button" class="text-slate-400 hover:text-red-500 opacity-0 group-hover/parent:opacity-100 transition-opacity">
                      <X class="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <!-- 二级子标签气泡 -->
                  <div class="flex flex-wrap gap-1">
                    <span v-for="(sub, subIdx) in subTags" :key="subIdx"
                      class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded hover:bg-slate-200 transition-colors">
                      {{ sub }}
                      <button @click="removeSubTag(parent, subIdx)" type="button" class="text-slate-400 hover:text-slate-600">
                        <X class="w-2.5 h-2.5" />
                      </button>
                    </span>
                    <span v-if="subTags.length === 0" class="text-[9px] text-slate-400 italic">暂无子标签</span>
                  </div>

                  <div class="flex gap-1.5 pt-1">
                    <input v-model="newSubTag[parent]" type="text" placeholder="添加子标签 (按回车)" @keydown="e => { if (e.key === 'Enter') { e.preventDefault(); addSubTag(parent); } }"
                      class="flex-1 px-2 py-1 text-[10px] border border-slate-200 rounded focus:border-violet-400 outline-none bg-slate-50/50 focus:bg-white" />
                    <button @click="addSubTag(parent)" type="button" class="bg-slate-800 text-white px-2 py-1 rounded text-[10px] hover:bg-slate-900 transition-colors">
                      添加
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 高级设置 (提示词定制 & 分析目标) -->
            <div class="border border-slate-200 rounded-lg overflow-hidden">
              <button @click="showAdvanced = !showAdvanced" type="button"
                class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/80 transition-colors flex justify-between items-center text-xs font-bold text-slate-700 outline-none">
                <span class="flex items-center gap-1.5">
                  <Sliders class="w-3.5 h-3.5 text-slate-500" /> 高级设置 (提示词定制)
                </span>
                <ChevronDown class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" :class="{ 'rotate-180': showAdvanced }" />
              </button>
              
              <div v-show="showAdvanced" class="p-3 bg-white border-t border-slate-100 space-y-3.5 animate-fade-in">
                <!-- 分析目标 -->
                <div class="space-y-1.5">
                  <div class="flex justify-between items-center">
                    <label class="text-[10px] font-bold text-slate-500">我的模糊分析目标</label>
                    <button @click="generatePromptWithAI" :disabled="isGeneratingPrompt"
                      class="text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-0.5 font-bold disabled:opacity-50 transition-colors">
                      <Sparkles class="w-3 h-3 text-violet-500" :class="{ 'animate-pulse': isGeneratingPrompt }" />
                      {{ isGeneratingPrompt ? '智能生成中...' : '智能优化' }}
                    </button>
                  </div>
                  <textarea v-model="analysisGoal" rows="2"
                    class="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-violet-500 outline-none resize-none bg-slate-50/30"
                    placeholder="输入大白话：如“帮我找出用户对包装破损的差评，并重点提取出退换货意愿”"></textarea>
                </div>

                <div>
                  <div class="flex justify-between items-center mb-1">
                    <label class="text-[10px] font-bold text-slate-500">System Prompt</label>
                    <button @click="resetPromptToDefault" class="text-[10px] text-violet-600 hover:underline">恢复默认</button>
                  </div>
                  <textarea v-model="customSystemPrompt" @input="handlePromptInput" rows="5"
                    class="w-full p-2 border border-slate-200 rounded text-xs font-mono bg-slate-50/50 focus:bg-white focus:border-violet-500 outline-none resize-y"
                    placeholder="自定义 AI 分析系统角色和匹配规则..."></textarea>
                  <p class="text-[9px] text-slate-400 leading-tight">
                    * 默认根据分类标签联动生成。修改后将锁定自定义内容，直到点击恢复默认。
                  </p>
                </div>
              </div>
            </div>

            <button @click="startAnalysis" :disabled="isAnalyzing"
              class="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-bold shadow-md shadow-violet-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Brain class="w-4 h-4" /> {{ isAnalyzing ? '分析中...' : '开始评论分析' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Right Panel: Table Preview & Dashboard -->
      <div class="lg:col-span-8 space-y-6">
        <!-- Dashboard Statistics Cards -->
        <div v-if="hasData" class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-slate-400 uppercase">总评论数</div>
            <div class="text-2xl font-black text-slate-800 mt-1 font-mono">{{ rows.length }}</div>
            <div class="text-[9px] text-slate-400 mt-0.5">全表 100% 数据</div>
          </div>

          <div class="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-emerald-600 uppercase">正面情感占比</div>
            <div class="text-2xl font-black text-emerald-800 mt-1 font-mono">{{ sentimentStats.positive }}</div>
            <div class="text-[9px] text-emerald-600/80 mt-0.5">正面率 {{ Math.round(sentimentStats.positive/sentimentStats.total*100) || 0 }}%</div>
          </div>

          <div class="bg-rose-50 rounded-xl border border-rose-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-rose-600 uppercase">负面情感占比</div>
            <div class="text-2xl font-black text-rose-800 mt-1 font-mono">{{ sentimentStats.negative }}</div>
            <div class="text-[9px] text-rose-600/80 mt-0.5">负面率 {{ Math.round(sentimentStats.negative/sentimentStats.total*100) || 0 }}%</div>
          </div>

          <div class="bg-slate-50 rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-slate-500 uppercase">中性 / 未分析</div>
            <div class="text-2xl font-black text-slate-700 mt-1 font-mono">{{ sentimentStats.neutral }}</div>
            <div class="text-[9px] text-slate-400 mt-0.5">包含未标注与 Neutral</div>
          </div>
        </div>

        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px] overflow-hidden relative animate-fade-in">
          <!-- Thin progress bar at top edge -->
          <div v-if="isAnalyzing" class="w-full h-1 bg-slate-100 overflow-hidden relative">
            <div class="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300" :style="{ width: percentFinished + '%' }"></div>
          </div>

          <div class="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <BarChart2 class="w-4 h-4 text-slate-400" />
              <span class="text-xs font-bold text-slate-700">预览与分析结果</span>
              <span class="text-[10px] text-slate-400">(仅列表预览前 20 行)</span>
              <span v-if="isAnalyzing" class="text-xs text-violet-600 font-bold ml-3 animate-pulse">
                已分析 {{ processed }}/{{ totalToProcess }} 行 ({{ percentFinished }}%)
              </span>
            </div>
            <button v-if="Object.keys(analysisMap).length > 0" @click="exportResults"
              class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-violet-600 hover:border-violet-400 transition-all flex items-center gap-1 shadow-sm">
              <Download class="w-3 h-3" /> 导出结果.xlsx
            </button>
          </div>

          <div class="flex-1 overflow-auto relative">
            <!-- Live Table -->
            <table class="w-full text-left border-collapse min-w-[800px]">
              <thead class="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                <tr>
                  <th class="px-3 py-3 w-12 text-center bg-slate-50">操作</th>
                  <th v-for="h in headers" :key="h" class="px-4 py-3 bg-slate-50 whitespace-nowrap">{{ h }}</th>
                  <th class="px-4 py-3 bg-slate-50 whitespace-nowrap text-violet-700">情感倾向 (AI)</th>
                  <th class="px-4 py-3 bg-slate-50 whitespace-nowrap text-violet-700">分类结果 (AI)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-[11px] text-slate-600">
                <tr v-for="(row, ri) in displayRows" :key="ri" 
                  class="hover:bg-slate-50/50 transition-colors"
                  :class="{ 
                    'opacity-40 bg-slate-50/30 select-none': isAnalyzing && (ri < (rangeStart - 1) || ri > (rangeEnd - 1)),
                    'bg-violet-50/20': isAnalyzing && ri === currentProcessingRowIdx
                  }">
                  <!-- 删除操作 -->
                  <td class="px-3 py-2 text-center">
                    <button @click="deleteRow(ri)" type="button" :disabled="isAnalyzing"
                      class="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all disabled:opacity-30">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </td>
                  
                  <!-- 原始数据列 -->
                  <td v-for="(_, ci) in headers.length" :key="ci" class="px-4 py-2 truncate max-w-[180px]" :title="row[ci]">
                    {{ row[ci] ?? '' }}
                  </td>

                  <!-- 情感倾向列 -->
                  <td class="px-4 py-2 whitespace-nowrap">
                    <span v-if="analysisMap[ri]?.status === 'processing'" class="inline-flex items-center gap-1 text-violet-600 font-bold animate-pulse">
                      <span class="w-1.5 h-1.5 rounded-full bg-violet-600 animate-ping"></span>
                      ⚡ 分析中...
                    </span>
                    <span v-else-if="analysisMap[ri]?.status === 'done'" 
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      :class="sentimentClass(analysisMap[ri]?.sentiment)">
                      {{ analysisMap[ri]?.sentiment }}
                    </span>
                    <span v-else-if="analysisMap[ri]?.status === 'error'" class="text-red-500 font-semibold" :title="analysisMap[ri]?.errorMessage">
                      ⚠️ Error
                    </span>
                    <span v-else class="text-slate-400 font-medium">-</span>
                  </td>

                  <!-- 分类标签列 -->
                  <td class="px-4 py-2 max-w-[200px] truncate" :title="analysisMap[ri]?.category">
                    <span v-if="analysisMap[ri]?.status === 'processing'" class="text-slate-400 italic">等待分类...</span>
                    <span v-else-if="analysisMap[ri]?.status === 'done'" class="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                      {{ analysisMap[ri]?.category }}
                    </span>
                    <span v-else-if="analysisMap[ri]?.status === 'error'" class="text-slate-400">-</span>
                    <span v-else class="text-slate-400">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { UploadCloud, Globe, SlidersHorizontal, Plus, X, Brain, BarChart2, Download, Sparkles, ChevronDown, Sliders, Trash2, Check } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import FileUploader from '../components/common/FileUploader.vue'
import { readFile, exportToXlsx, DEMO_DATA } from '../services/excel'
import { callAI } from '../services/ai'
import { getAnalysisSystemPrompt, getColumnDetectionPrompt, getTagGenerationPrompt, getPromptOptimizerPrompt } from '../services/prompts'
import { useSettingsStore } from '../stores/settings'

const dataShare = useDataShareStore()

const headers = ref([])
const rows = ref([])
const sourceCol = computed(() => dataShare.coreColumn)

// 定制分析行区间
const rangeStart = ref(1)
const rangeEnd = ref(0)
const currentProcessingRowIdx = ref(-1)

// 双层树状分类体系存储
const categories = ref({
  '质量': ['好', '一般', '差'],
  '物流': ['快', '慢'],
  '服务': ['态度好', '态度差'],
  '价格': ['性价比高', '偏贵']
})
const newParentTag = ref('')
const newSubTag = ref({})
const taxonomyGoal = ref('')

// 控制与设置变量
const isAnalyzing = ref(false)
const processed = ref(0)
const totalToProcess = ref(0)
const isDetectingColumn = ref(false)
const isGeneratingTags = ref(false)
const showAdvanced = ref(false)
const customSystemPrompt = ref('')
const isPromptDirty = ref(false)
const analysisGoal = ref('')
const isGeneratingPrompt = ref(false)

// 响应式逐行分析结果映射表
const analysisMap = ref({}) // { [rowIdx]: { sentiment, category, status, errorMessage } }

const hasData = computed(() => rows.value.length > 0)
const displayRows = computed(() => rows.value.slice(0, 20))
const percentFinished = computed(() => {
  if (totalToProcess.value <= 0) return 0
  return Math.round((processed.value / totalToProcess.value) * 100)
})

// 情感极性统计
const sentimentStats = computed(() => {
  let positive = 0
  let negative = 0
  let neutral = 0
  let total = 0
  
  for (let i = 0; i < rows.value.length; i++) {
    const res = analysisMap.value[i]
    if (res && res.status === 'done') {
      total++
      if (res.sentiment === 'Positive') positive++
      else if (res.sentiment === 'Negative') negative++
      else neutral++
    } else {
      neutral++
    }
  }
  return {
    positive,
    negative,
    neutral,
    total: total || 1
  }
})

onMounted(() => {
  if (dataShare.hasData && rows.value.length === 0) {
    importGlobalExcel()
  }
})

function importGlobalExcel() {
  headers.value = [...dataShare.headers]
  rows.value = dataShare.rows.map(r => [...r])
  
  rangeStart.value = 1
  rangeEnd.value = rows.value.length
  
  analysisMap.value = {}
  resetPromptToDefault()
}

// 监听全局核心列变动，重新运行分析前清空历史
watch(() => dataShare.coreColumn, () => {
  analysisMap.value = {}
})

function disconnectGlobalExcel() {
  dataShare.clearSharedData()
  reset()
}

// 自动联动 System Prompt 到高级折叠输入框
watch(() => categories.value, () => {
  if (!isPromptDirty.value) {
    customSystemPrompt.value = getAnalysisSystemPrompt(categories.value)
  }
}, { deep: true, immediate: true })

function resetPromptToDefault() {
  customSystemPrompt.value = getAnalysisSystemPrompt(categories.value)
  isPromptDirty.value = false
  analysisGoal.value = ''
}

function handlePromptInput() {
  isPromptDirty.value = true
}

// 树状标签修改交互
function addParentTag() {
  const p = newParentTag.value.trim()
  if (p && !categories.value[p]) {
    categories.value[p] = []
  }
  newParentTag.value = ''
}

function removeParentTag(parent) {
  delete categories.value[parent]
  categories.value = { ...categories.value }
}

function addSubTag(parent) {
  const sub = (newSubTag.value[parent] || '').trim()
  if (sub && categories.value[parent] && !categories.value[parent].includes(sub)) {
    categories.value[parent].push(sub)
  }
  newSubTag.value[parent] = ''
}

function removeSubTag(parent, index) {
  if (categories.value[parent]) {
    categories.value[parent].splice(index, 1)
  }
}

// 简单的 Excel 操作：移除预览行并偏移 analysisMap
function deleteRow(ri) {
  rows.value.splice(ri, 1)
  if (rangeEnd.value > rows.value.length) {
    rangeEnd.value = rows.value.length
  }
  
  // 维护分析结果的索引连贯性
  const newMap = {}
  Object.keys(analysisMap.value).forEach(k => {
    const keyInt = parseInt(k)
    if (keyInt < ri) {
      newMap[keyInt] = analysisMap.value[keyInt]
    } else if (keyInt > ri) {
      newMap[keyInt - 1] = analysisMap.value[keyInt]
    }
  })
  analysisMap.value = newMap
  
  // 同步写回全局
  dataShare.setSharedData(headers.value, rows.value, dataShare.sourceName || '修改后数据.xlsx')
}

function sentimentClass(s) {
  if (s === 'Positive') return 'bg-green-100 text-green-700'
  if (s === 'Negative') return 'bg-red-100 text-red-700'
  if (s === 'Neutral') return 'bg-slate-100 text-slate-600'
  return 'bg-red-50 text-red-600'
}

// 强健的 JSON 解析容错引擎
function parseRobustJSON(text) {
  if (!text) return null
  let cleaned = text.trim()
  
  // 1. 过滤 markdown 语法标记
  cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '')
  cleaned = cleaned.trim()
  
  // 2. 剥离并截取最外层对齐的大括号或中括号
  const startBrace = cleaned.indexOf('{')
  const startBracket = cleaned.indexOf('[')
  let startIdx = -1
  let endIdx = -1
  
  if (startBrace !== -1 && (startBracket === -1 || startBrace < startBracket)) {
    startIdx = startBrace
    endIdx = cleaned.lastIndexOf('}')
  } else if (startBracket !== -1) {
    startIdx = startBracket
    endIdx = cleaned.lastIndexOf(']')
  }
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1)
  }
  
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    console.warn('JSON 强健性解析失败，切换正则过滤提取。正文：', cleaned)
    
    const colMatch = cleaned.match(/"recommendedColumn"\s*:\s*"([^"]+)"/)
    const reasonMatch = cleaned.match(/"reason"\s*:\s*"([^"]+)"/)
    if (colMatch) {
      return {
        recommendedColumn: colMatch[1],
        reason: reasonMatch ? reasonMatch[1] : ''
      }
    }
    
    const sentimentMatch = cleaned.match(/"sentiment"\s*:\s*"(Positive|Negative|Neutral)"/i)
    const categoryMatch = cleaned.match(/"category"\s*:\s*"([^"]+)"/)
    if (sentimentMatch || categoryMatch) {
      let sentimentVal = 'Neutral'
      if (sentimentMatch) {
        const rawS = sentimentMatch[1].toLowerCase()
        if (rawS === 'positive') sentimentVal = 'Positive'
        if (rawS === 'negative') sentimentVal = 'Negative'
      }
      return {
        sentiment: sentimentVal,
        category: categoryMatch ? categoryMatch[1] : '-'
      }
    }
    return null
  }
}

// 启发式列推荐 (平均字数最长判定)
function runHeuristicDetection(headersList, rowsList) {
  if (!rowsList || rowsList.length === 0) return 0
  let bestColIdx = 0
  let maxAvgLength = 0
  const colCount = headersList.length
  const sampleRows = rowsList.slice(0, 20)
  
  for (let c = 0; c < colCount; c++) {
    let totalLen = 0
    let nonNullCount = 0
    sampleRows.forEach(row => {
      const val = row[c]
      if (val != null && val !== '') {
        totalLen += String(val).trim().length
        nonNullCount++
      }
    })
    const avgLen = nonNullCount > 0 ? (totalLen / nonNullCount) : 0
    if (avgLen > maxAvgLength) {
      maxAvgLength = avgLen
      bestColIdx = c
    }
  }
  return maxAvgLength > 10 ? bestColIdx : (headersList.length > 2 ? 2 : 0)
}

async function handleFile(file) {
  try {
    const data = await readFile(file)
    headers.value = data.headers.map(String)
    rows.value = data.rows
    
    // 动态初始化行切片范围
    rangeStart.value = 1
    rangeEnd.value = data.rows.length
    analysisMap.value = {}
    
    // 同步到全局，全局会自动判断并设定推荐核心列 (传递 true 开启首次推荐)
    dataShare.setSharedData(headers.value, rows.value, file.name, true)
  } catch (err) { alert(err.message) }
}

// ✨ AI 智能推荐评论列
async function detectColumnWithAI() {
  const settings = useSettingsStore()
  if (!settings.isConfigured) {
    settings.showSettings = true
    alert('请先配置 API 密钥')
    return
  }
  if (!rows.value.length) return
  
  isDetectingColumn.value = true
  try {
    const sampleRows = rows.value.slice(0, 5).map(row => 
      headers.value.reduce((acc, h, idx) => {
        acc[h] = row[idx] ?? ''
        return acc
      }, {})
    )
    const prompt = getColumnDetectionPrompt(headers.value, sampleRows)
    const res = await callAI(prompt, '你是一个数据分析专家。', settings.getApiConfig().workModel)
    const parsed = parseRobustJSON(res)
    
    if (parsed && parsed.recommendedColumn) {
      const idx = headers.value.indexOf(parsed.recommendedColumn)
      if (idx >= 0) {
        sourceCol.value = idx
        alert(`AI 推荐选择【${parsed.recommendedColumn}】列\n推荐理由：${parsed.reason || '该列包含最丰富的评论文本。'}`)
      } else {
        alert(`AI 推荐了【${parsed.recommendedColumn}】列，但该列名与表头不一致。`)
      }
    } else {
      throw new Error('AI 返回数据解析失败。')
    }
  } catch (e) {
    alert('AI 识别列失败: ' + e.message)
  } finally {
    isDetectingColumn.value = false
  }
}

// ✨ AI 一键智能生成嵌套二级分类标签
async function generateTagsWithAI() {
  const settings = useSettingsStore()
  if (!settings.isConfigured) {
    settings.showSettings = true
    alert('请先配置 API 密钥')
    return
  }
  if (!rows.value.length) {
    alert('请先上传文件或加载示例数据')
    return
  }
  
  isGeneratingTags.value = true
  try {
    const samples = []
    for (let i = 0; i < rows.value.length; i++) {
      const val = rows.value[i][sourceCol.value]
      if (val != null && String(val).trim() !== '') {
        samples.push(String(val).trim())
      }
      if (samples.length >= 8) break
    }
    
    if (samples.length === 0) {
      alert('未能在所选列找到有效文本样本。')
      return
    }
    
    const prompt = getTagGenerationPrompt(samples, taxonomyGoal.value)
    const res = await callAI(prompt, '你是一个分类标签设计专家。', settings.getApiConfig().workModel)
    const parsed = parseRobustJSON(res)
    
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      categories.value = parsed
      resetPromptToDefault()
      alert('AI 树状二级分类标签生成成功！已更新标签卡片。')
    } else {
      throw new Error('返回的二级嵌套体系不是合法的 JSON 对象。')
    }
  } catch (e) {
    alert('AI 生成标签失败: ' + e.message)
  } finally {
    isGeneratingTags.value = false
  }
}

// ✨ AI 模糊目标智能优化 Prompt 按钮
async function generatePromptWithAI() {
  const settings = useSettingsStore()
  if (!settings.isConfigured) {
    settings.showSettings = true
    alert('请先配置 API 密钥')
    return
  }
  const goalText = analysisGoal.value.trim()
  if (!goalText) {
    alert('请先填入您的分析目标描述。')
    return
  }

  isGeneratingPrompt.value = true
  try {
    const prompt = getPromptOptimizerPrompt(goalText, categories.value)
    const res = await callAI(prompt, '你是一个大模型 Prompt 优化专家。', settings.getApiConfig().workModel)
    
    let cleanedPrompt = res.trim()
    cleanedPrompt = cleanedPrompt.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '')
    
    customSystemPrompt.value = cleanedPrompt
    isPromptDirty.value = true
    alert('System Prompt 智能优化成功，已回填！')
  } catch (e) {
    alert('Prompt 生成优化失败: ' + e.message)
  } finally {
    isGeneratingPrompt.value = false
  }
}

function loadDemo() {
  const demo = DEMO_DATA.comments
  dataShare.setSharedData(demo.headers, demo.rows, '用户评论示例.csv', true)
  headers.value = [...demo.headers]
  rows.value = demo.rows.map(r => [...r])
  
  rangeStart.value = 1
  rangeEnd.value = demo.rows.length
  
  analysisMap.value = {}
  resetPromptToDefault()
}

function reset() {
  headers.value = []; rows.value = []; analysisMap.value = {}
  resetPromptToDefault()
}

// ✨ AI 行级实时回写分类处理大逻辑
async function startAnalysis() {
  if (isAnalyzing.value || !rows.value.length) return
  const settings = useSettingsStore()
  const config = settings.getApiConfig()

  if (!config.key) {
    settings.showSettings = true
    alert('请先配置 API 密钥')
    return
  }

  let start = parseInt(rangeStart.value) || 1
  let end = parseInt(rangeEnd.value) || rows.value.length
  if (start < 1) start = 1
  if (end > rows.value.length) end = rows.value.length
  if (start > end) {
    alert('开始行不能大于结束行')
    return
  }

  isAnalyzing.value = true
  processed.value = 0
  totalToProcess.value = end - start + 1
  currentProcessingRowIdx.value = -1

  for (let k = start - 1; k < end; k++) {
    analysisMap.value[k] = { status: 'pending', sentiment: '', category: '' }
  }

  let systemPrompt = (customSystemPrompt.value || '').trim()
  if (!systemPrompt) {
    systemPrompt = getAnalysisSystemPrompt(categories.value)
  }
  const jsonConstraint = '\n\n【重要输出格式规范】你必须只返回纯 JSON 格式的数据，形如：{"sentiment": "Positive/Negative/Neutral", "category": "一级分类 > 二级分类"}。禁止包裹 markdown \`\`\` 标记，禁止包含多余话术。'
  if (!systemPrompt.includes('JSON')) {
    systemPrompt += jsonConstraint
  }

  for (let i = start - 1; i < end; i++) {
    currentProcessingRowIdx.value = i
    const text = rows.value[i][sourceCol.value]
    if (!text || String(text).trim().length < 2) {
      analysisMap.value[i] = { status: 'done', sentiment: 'Neutral', category: '-' }
      processed.value++
      continue
    }

    analysisMap.value[i].status = 'processing'
    try {
      const result = await callAI(String(text), systemPrompt, config.workModel)
      const parsed = parseRobustJSON(result)
      if (parsed) {
        analysisMap.value[i] = {
          status: 'done',
          sentiment: parsed.sentiment || 'Neutral',
          category: parsed.category || '-'
        }
      } else {
        throw new Error('返回 JSON 格式不规范')
      }
    } catch (e) {
      analysisMap.value[i] = {
        status: 'error',
        sentiment: 'Error',
        category: '-',
        errorMessage: e.message
      }
    }
    processed.value++
  }
  
  isAnalyzing.value = false
  currentProcessingRowIdx.value = -1
  alert('所选范围分析处理完毕！')
}

// 导出过滤后并追加新分析列的 xlsx 结果
function exportResults() {
  const expHeaders = [...headers.value, '情感倾向 (AI)', '分类标签结果 (AI)']
  const expRows = rows.value.map((row, ri) => {
    const analysis = analysisMap.value[ri] || { sentiment: '-', category: '-' }
    // 补齐行长度到 headers 长度，防止尾部空列导致新增列错位
    const padded = [...row]
    while (padded.length < headers.value.length) padded.push('')
    padded.push(analysis.sentiment, analysis.category)
    return padded
  })
  exportToXlsx(expHeaders, expRows, '评论分析结果.xlsx')
}
</script>
