<template>
  <div class="animate-fade-in max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-2xl border border-violet-200/50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Brain class="w-6 h-6 text-violet-600" /> AI 表格打标
        </h2>
        <p class="text-xs text-slate-500 mt-1">
          用自然语言描述分析目标，自动生成新增列方案，批量打标、分类、摘要与判断。
        </p>
      </div>
      <button v-if="!hasData" @click="loadDemo"
        class="px-4 py-2 bg-white hover:bg-violet-50 border border-violet-200 text-violet-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0">
        <Brain class="w-3.5 h-3.5" /> 加载示例数据
      </button>
    </div>

    <!-- 全局 Excel 关联横幅 -->
    <div v-if="hasData && dataShare.hasData"
      class="bg-emerald-500/10 rounded-xl border border-emerald-500/20 px-4 py-3 flex justify-between items-center text-xs animate-fade-in">
      <div class="flex items-center gap-2 text-emerald-800">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>当前已关联：<strong>{{ dataShare.sourceName }}</strong> ({{ rows.length }} 行)</span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 hover:text-rose-600 font-bold hover:underline">
        断开关联
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- 左侧配置面板 -->
      <div class="lg:col-span-4 space-y-6">
        <FileUploader v-if="!hasData" label="上传数据文件" :icon="UploadCloud" iconBg="bg-violet-50" iconColor="text-violet-600" @file="handleFile" />

        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 animate-fade-in">
          <div class="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
              <SlidersHorizontal class="w-4 h-4 text-slate-500" /> 打标配置
            </h3>
            <button @click="reset" class="text-xs text-red-500 hover:underline">重置</button>
          </div>

          <div class="space-y-4">

            <!-- 1. AI 参考列（多选） -->
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5">AI 参考列</label>
              <div class="max-h-32 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1 custom-scrollbar">
                <label v-for="(h, i) in headers" :key="i" class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-100 px-1 py-0.5 rounded">
                  <input type="checkbox" :value="i" v-model="selectedInputColumns"
                    class="rounded text-violet-600 focus:ring-violet-500" />
                  {{ h }}
                </label>
              </div>
              <p class="text-[9px] text-slate-400 mt-1">选择 AI 分析时需要参考的列</p>
            </div>

            <!-- 2. 分析范围 -->
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
              <label class="block text-xs font-bold text-slate-700">分析数据范围</label>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <div class="text-[9px] text-slate-400 mb-0.5">开始行</div>
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

            <!-- 3. 自然语言目标 + AI 生成打标方案 -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-700">我想让 AI 新增什么列</label>
              <textarea v-model="userGoal" rows="3"
                class="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-violet-500 outline-none resize-none bg-slate-50"
                placeholder="描述需求，如：帮我新增4列：情感倾向、主要问题类型、是否有退换货意愿、证据短句"></textarea>
              <button @click="generateLabelingPlanWithAI" :disabled="isGeneratingPlan"
                class="w-full py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-lg text-xs font-bold shadow-md shadow-violet-200 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Sparkles class="w-3.5 h-3.5" :class="{ 'animate-spin': isGeneratingPlan }" />
                {{ isGeneratingPlan ? 'AI 生成方案中...' : 'AI 生成打标方案' }}
              </button>
            </div>

            <!-- 4. 新增列方案（outputColumns 卡片列表） -->
            <div v-if="labelingPlan.outputColumns.length > 0" class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="text-xs font-bold text-slate-700">新增列方案 ({{ labelingPlan.outputColumns.length }})</label>
                <button @click="addOutputColumn" class="text-[10px] text-violet-600 hover:text-violet-700 font-bold flex items-center gap-0.5">
                  <Plus class="w-3 h-3" /> 添加列
                </button>
              </div>

              <div v-for="(col, idx) in labelingPlan.outputColumns" :key="col.key"
                class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5 relative group">
                <div class="flex justify-between items-center">
                  <span class="text-[11px] font-bold text-slate-700">{{ col.name }}</span>
                  <div class="flex items-center gap-1">
                    <button @click="editOutputColumn(idx)" class="text-slate-400 hover:text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil class="w-3 h-3" />
                    </button>
                    <button @click="removeOutputColumn(idx)" class="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">{{ col.type }}</span>
                  <span class="text-[9px] text-slate-500">{{ col.description }}</span>
                </div>
                <div v-if="col.type === 'enum' && col.options?.length" class="flex flex-wrap gap-1 mt-0.5">
                  <span v-for="opt in col.options" :key="opt" class="text-[9px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600">{{ opt }}</span>
                </div>
                <div v-if="col.type === 'hierarchical_enum' && col.options && typeof col.options === 'object'" class="space-y-0.5 mt-0.5">
                  <div v-for="(children, parent) in col.options" :key="parent" class="text-[9px] text-slate-500">
                    <span class="font-bold text-slate-600">{{ parent }}:</span> {{ (children || []).join(', ') }}
                  </div>
                </div>
                <div v-if="col.type === 'multi_enum' && col.options?.length" class="flex flex-wrap gap-1 mt-0.5">
                  <span v-for="opt in col.options" :key="opt" class="text-[9px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600">{{ opt }}</span>
                </div>
              </div>
            </div>

            <!-- 5. 高级 Prompt 预览 -->
            <div class="border border-slate-200 rounded-lg overflow-hidden">
              <button @click="showAdvanced = !showAdvanced" type="button"
                class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors flex justify-between items-center text-xs font-bold text-slate-700 outline-none">
                <span class="flex items-center gap-1.5">
                  <Sliders class="w-3.5 h-3.5 text-slate-500" /> 高级 Prompt 预览
                </span>
                <ChevronDown class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" :class="{ 'rotate-180': showAdvanced }" />
              </button>

              <div v-show="showAdvanced" class="p-3 bg-white border-t border-slate-100 space-y-3 animate-fade-in">
                <div v-if="labelingPlan.promptDirty" class="text-[9px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                  当前 Prompt 已手动修改，可能与上方新增列方案不完全一致
                </div>
                <textarea v-model="labelingPlan.compiledPrompt" @input="onPromptManualEdit" rows="6"
                  class="w-full p-2 border border-slate-200 rounded text-xs font-mono bg-slate-50 focus:bg-white focus:border-violet-500 outline-none resize-y"></textarea>
                <div class="flex gap-2">
                  <button @click="resetPromptToAuto" class="flex-1 text-[10px] py-1.5 bg-violet-50 text-violet-600 rounded-lg font-bold hover:bg-violet-100 transition-colors">
                    恢复自动生成
                  </button>
                  <button @click="syncPlanFromPrompt" :disabled="isSyncingPlan"
                    class="flex-1 text-[10px] py-1.5 bg-slate-50 text-slate-600 rounded-lg font-bold hover:bg-slate-100 transition-colors disabled:opacity-50">
                    从 Prompt 同步列配置
                  </button>
                </div>
              </div>
            </div>

            <!-- 6. 开始 AI 打标 -->
            <button @click="startLabeling" :disabled="isAnalyzing"
              class="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-bold shadow-md shadow-violet-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Brain class="w-4 h-4" /> {{ isAnalyzing ? '打标中...' : '开始 AI 打标' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：统计 + 表格 -->
      <div class="lg:col-span-8 space-y-6">
        <!-- 统计卡片 -->
        <div v-if="hasData" class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-slate-400 uppercase">总行数</div>
            <div class="text-2xl font-black text-slate-800 mt-1 font-mono">{{ rows.length }}</div>
          </div>
          <div class="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-emerald-600 uppercase">已分析</div>
            <div class="text-2xl font-black text-emerald-800 mt-1 font-mono">{{ stats.done }}</div>
            <div class="text-[9px] text-emerald-600 mt-0.5">{{ Math.round(stats.done / (rows.length || 1) * 100) }}%</div>
          </div>
          <div class="bg-violet-50 rounded-xl border border-violet-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-violet-600 uppercase">AI 新增列</div>
            <div class="text-2xl font-black text-violet-800 mt-1 font-mono">{{ labelingPlan.outputColumns.length }}</div>
          </div>
          <div class="bg-rose-50 rounded-xl border border-rose-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-rose-600 uppercase">错误行</div>
            <div class="text-2xl font-black text-rose-800 mt-1 font-mono">{{ stats.error }}</div>
          </div>
        </div>

        <!-- 数据表格 -->
        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px] overflow-hidden relative animate-fade-in">
          <div v-if="isAnalyzing" class="w-full h-1 bg-slate-100 overflow-hidden relative">
            <div class="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300" :style="{ width: percentFinished + '%' }"></div>
          </div>

          <div class="px-5 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <BarChart2 class="w-4 h-4 text-slate-400" />
              <span class="text-xs font-bold text-slate-700">预览与打标结果</span>
              <span class="text-[10px] text-slate-400">(前 20 行)</span>
              <span v-if="isAnalyzing" class="text-xs text-violet-600 font-bold ml-3 animate-pulse">
                {{ processed }}/{{ totalToProcess }} ({{ percentFinished }}%) 并发{{ actualConcurrency }}
              </span>
            </div>
            <button v-if="Object.keys(analysisMap).length > 0" @click="exportResults"
              class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-violet-600 hover:border-violet-400 transition-all flex items-center gap-1 shadow-sm">
              <Download class="w-3 h-3" /> 导出打标结果.xlsx
            </button>
          </div>

          <div class="flex-1 overflow-auto relative">
            <table class="w-full text-left border-collapse min-w-[800px]">
              <thead class="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                <tr>
                  <th class="px-3 py-3 w-12 text-center bg-slate-50">操作</th>
                  <th v-for="h in headers" :key="h" class="px-4 py-3 bg-slate-50 whitespace-nowrap">{{ h }}</th>
                  <th v-for="col in labelingPlan.outputColumns" :key="col.key" class="px-4 py-3 bg-slate-50 whitespace-nowrap text-violet-700">{{ col.name }} (AI)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-[11px] text-slate-600">
                <tr v-for="(row, ri) in displayRows" :key="ri"
                  class="hover:bg-slate-50 transition-colors"
                  :class="{
                    'opacity-40 bg-slate-50 select-none': isAnalyzing && (ri < (rangeStart - 1) || ri > (rangeEnd - 1)),
                    'bg-violet-50': isAnalyzing && ri === currentProcessingRowIdx
                  }">
                  <td class="px-3 py-2 text-center">
                    <button @click="deleteRow(ri)" type="button" :disabled="isAnalyzing"
                      class="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all disabled:opacity-30">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </td>
                  <td v-for="(_, ci) in headers.length" :key="ci" class="px-4 py-2 truncate max-w-[180px]" :title="row[ci]">
                    {{ row[ci] ?? '' }}
                  </td>
                  <!-- 动态 AI 输出列 -->
                  <td v-for="col in labelingPlan.outputColumns" :key="col.key" class="px-4 py-2 max-w-[200px] truncate">
                    <template v-if="analysisMap[ri]?.status === 'processing'">
                      <span class="inline-flex items-center gap-1 text-violet-600 font-bold animate-pulse">
                        <span class="w-1.5 h-1.5 rounded-full bg-violet-600 animate-ping"></span>
                      </span>
                    </template>
                    <template v-else-if="analysisMap[ri]?.status === 'done'">
                      <span class="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                        {{ formatCellValue(analysisMap[ri]?.values?.[col.key], col.type) }}
                      </span>
                    </template>
                    <template v-else-if="analysisMap[ri]?.status === 'error'">
                      <span class="text-red-500 text-[10px]" :title="analysisMap[ri]?.errorMessage">Error</span>
                    </template>
                    <template v-else>
                      <span class="text-slate-400">-</span>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑列弹窗 -->
    <div v-if="editingColumn != null" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="editingColumn = null">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 class="font-bold text-sm text-slate-800">{{ editingColumnIdx >= 0 ? '编辑' : '添加' }}输出列</h3>
          <button @click="editingColumn = null" class="text-slate-400 hover:text-slate-600"><X class="w-4 h-4" /></button>
        </div>
        <div class="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 mb-1">列名</label>
            <input v-model="editingColumn.name" type="text" placeholder="如：情感倾向"
              class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 mb-1">字段 key</label>
            <input v-model="editingColumn.key" type="text" placeholder="如：sentiment"
              class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-violet-500" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 mb-1">类型</label>
            <select v-model="editingColumn.type" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500">
              <option value="enum">单选标签 (enum)</option>
              <option value="multi_enum">多选标签 (multi_enum)</option>
              <option value="hierarchical_enum">二级分类 (hierarchical_enum)</option>
              <option value="boolean">是否判断 (boolean)</option>
              <option value="text">自由文本 (text)</option>
              <option value="number">数值评分 (number)</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 mb-1">说明</label>
            <input v-model="editingColumn.description" type="text" placeholder="这个字段判断什么"
              class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500" />
          </div>
          <div v-if="editingColumn.type === 'enum' || editingColumn.type === 'multi_enum'">
            <label class="block text-[10px] font-bold text-slate-500 mb-1">选项 (逗号分隔)</label>
            <textarea v-model="editingOptionsStr" rows="2" placeholder="选项1, 选项2, 选项3"
              class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500 resize-none"></textarea>
          </div>
          <div v-if="editingColumn.type === 'hierarchical_enum'">
            <label class="block text-[10px] font-bold text-slate-500 mb-1">分类体系 (JSON)</label>
            <textarea v-model="editingHierStr" rows="4" placeholder='{"大类1":["子1","子2"]}'
              class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-violet-500 resize-none"></textarea>
          </div>
          <label class="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
            <input type="checkbox" v-model="editingColumn.required" class="rounded text-violet-600 focus:ring-violet-500" />
            必填
          </label>
        </div>
        <div class="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button @click="editingColumn = null" class="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">取消</button>
          <button @click="saveEditingColumn" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 flex items-center gap-1">
            <Check class="w-3.5 h-3.5" /> 保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { UploadCloud, SlidersHorizontal, Plus, X, Brain, BarChart2, Download, Sparkles, ChevronDown, Sliders, Trash2, Check, Pencil } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import FileUploader from '../components/common/FileUploader.vue'
import { readFile, exportToXlsx, DEMO_DATA } from '../services/excel'
import { callAI, callAIBatch } from '../services/ai'
import { getColumnDetectionPrompt, getLabelingPlanGenerationPrompt, compileLabelingPrompt, getPlanFromPromptPrompt } from '../services/prompts'
import { useSettingsStore } from '../stores/settings'
import { useToast } from '../services/toast'
import { parseRobustJSON } from '../services/jsonParser'
import { useSettingsStore } from '../stores/settings'

const toast = useToast()
const settings = useSettingsStore()
const dataShare = useDataShareStore()

const headers = ref([])
const rows = ref([])
const actualConcurrency = ref(0)

// 分析范围
const rangeStart = ref(1)
const rangeEnd = ref(0)
const currentProcessingRowIdx = ref(-1)

// 多选参考列
const selectedInputColumns = ref([])

// 用户自然语言目标
const userGoal = ref('')

// 核心状态：打标方案
const labelingPlan = ref({
  taskName: '',
  goal: '',
  inputColumns: [],
  outputColumns: [],
  compiledPrompt: '',
  promptDirty: false
})

// 控制变量
const isAnalyzing = ref(false)
const isGeneratingPlan = ref(false)
const isSyncingPlan = ref(false)
const processed = ref(0)
const totalToProcess = ref(0)
const showAdvanced = ref(false)

// 编辑列弹窗
const editingColumn = ref(null)
const editingColumnIdx = ref(-1)
const editingOptionsStr = ref('')
const editingHierStr = ref('')

// 分析结果映射表 { [rowIdx]: { status, values: {key: val}, errorMessage } }
const analysisMap = ref({})

const hasData = computed(() => rows.value.length > 0)
const displayRows = computed(() => rows.value.slice(0, 20))
const percentFinished = computed(() => {
  if (totalToProcess.value <= 0) return 0
  return Math.round((processed.value / totalToProcess.value) * 100)
})

const stats = computed(() => {
  let done = 0, error = 0
  for (let i = 0; i < rows.value.length; i++) {
    const res = analysisMap.value[i]
    if (res?.status === 'done') done++
    else if (res?.status === 'error') error++
  }
  return { done, error }
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
  selectedInputColumns.value = dataShare.coreColumn != null ? [Number(dataShare.coreColumn)] : []
  analysisMap.value = {}
}

function disconnectGlobalExcel() {
  dataShare.clearSharedData()
  reset()
}

// 当 outputColumns 变化且 promptDirty 为 false 时自动重编译 prompt
watch(
  () => JSON.stringify(labelingPlan.value.outputColumns) + labelingPlan.value.goal,
  () => {
    if (!labelingPlan.value.promptDirty && labelingPlan.value.outputColumns.length > 0) {
      labelingPlan.value.compiledPrompt = compileLabelingPrompt(labelingPlan.value)
    }
  }
)

function onPromptManualEdit() {
  labelingPlan.value.promptDirty = true
}

function resetPromptToAuto() {
  labelingPlan.value.compiledPrompt = compileLabelingPrompt(labelingPlan.value)
  labelingPlan.value.promptDirty = false
}

// 编辑列操作
function addOutputColumn() {
  editingColumnIdx.value = -1
  editingColumn.value = { key: '', name: '', type: 'enum', description: '', options: [], required: true }
  editingOptionsStr.value = ''
  editingHierStr.value = ''
}

function editOutputColumn(idx) {
  editingColumnIdx.value = idx
  const col = labelingPlan.value.outputColumns[idx]
  editingColumn.value = { ...col, options: Array.isArray(col.options) ? [...col.options] : { ...(col.options || {}) } }
  if (col.type === 'enum' || col.type === 'multi_enum') {
    editingOptionsStr.value = (Array.isArray(col.options) ? col.options : []).join(', ')
  } else if (col.type === 'hierarchical_enum' && col.options && typeof col.options === 'object') {
    editingHierStr.value = JSON.stringify(col.options, null, 2)
  }
}

function removeOutputColumn(idx) {
  labelingPlan.value.outputColumns.splice(idx, 1)
}

function saveEditingColumn() {
  const col = editingColumn.value
  if (!col.name.trim() || !col.key.trim()) return

  // 自动生成 key
  col.key = col.key.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || col.name.trim()

  // 解析 options
  if (col.type === 'enum' || col.type === 'multi_enum') {
    col.options = editingOptionsStr.value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
  } else if (col.type === 'hierarchical_enum') {
    try {
      col.options = JSON.parse(editingHierStr.value || '{}')
    } catch { col.options = {} }
  } else {
    col.options = undefined
  }

  if (editingColumnIdx.value >= 0) {
    labelingPlan.value.outputColumns[editingColumnIdx.value] = { ...col }
  } else {
    labelingPlan.value.outputColumns.push({ ...col })
  }
  editingColumn.value = null
}

function deleteRow(ri) {
  rows.value.splice(ri, 1)
  if (rangeEnd.value > rows.value.length) rangeEnd.value = rows.value.length
  const newMap = {}
  Object.keys(analysisMap.value).forEach(k => {
    const keyInt = parseInt(k)
    if (keyInt < ri) newMap[keyInt] = analysisMap.value[keyInt]
    else if (keyInt > ri) newMap[keyInt - 1] = analysisMap.value[keyInt]
  })
  analysisMap.value = newMap
  dataShare.setSharedData(headers.value, rows.value, dataShare.sourceName || 'modified.xlsx')
}

function formatCellValue(val, type) {
  if (val == null || val === '') return '-'
  if (type === 'multi_enum' && Array.isArray(val)) return val.join(', ')
  if (type === 'boolean') return val === true ? 'Yes' : val === false ? 'No' : '-'
  return String(val)
}

// ── 方案校验与规范化 ──
function normalizeLabelingPlan(raw) {
  if (!raw || typeof raw !== 'object') return null
  const plan = {
    taskName: raw.taskName || '',
    goal: raw.goal || '',
    inputColumns: Array.isArray(raw.inputColumns) ? raw.inputColumns : [],
    outputColumns: []
  }
  if (!Array.isArray(raw.outputColumns) || raw.outputColumns.length === 0) return null

  plan.outputColumns = raw.outputColumns.map(col => {
    const c = {
      key: String(col.key || '').trim().replace(/\s+/g, '_'),
      name: String(col.name || '').trim(),
      type: ['enum', 'multi_enum', 'hierarchical_enum', 'boolean', 'text', 'number'].includes(col.type) ? col.type : 'text',
      description: String(col.description || '').trim(),
      required: col.required !== false
    }
    if (col.options != null) c.options = col.options
    if (!c.key && c.name) c.key = c.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_一-鿿]/g, '')
    return c
  }).filter(c => c.key && c.name)

  return plan.outputColumns.length > 0 ? plan : null
}

function validateLabelingPlan(plan) {
  if (!plan || !plan.outputColumns.length) return '请至少定义一个输出列'
  const keys = plan.outputColumns.map(c => c.key)
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
  if (dupes.length) return `字段 key 重复: ${dupes.join(', ')}`
  for (const col of plan.outputColumns) {
    if (['enum', 'multi_enum'].includes(col.type) && (!col.options || !col.options.length)) {
      return `字段 "${col.name}" 是 ${col.type} 类型，但未设置选项`
    }
    if (col.type === 'hierarchical_enum' && (!col.options || typeof col.options !== 'object' || Array.isArray(col.options))) {
      return `字段 "${col.name}" 是 hierarchical_enum 类型，但 options 格式不正确`
    }
  }
  return null
}

// ── 规范化 AI 单行返回 ──
function normalizeRowResult(parsed, outputColumns) {
  if (!parsed || typeof parsed !== 'object') return null
  const values = {}
  for (const col of outputColumns) {
    let val = parsed[col.key]
    if (val === undefined || val === null) {
      values[col.key] = null
      continue
    }
    if (col.type === 'enum') {
      values[col.key] = col.options?.includes(val) ? val : (col.options?.[0] ?? val)
    } else if (col.type === 'multi_enum') {
      values[col.key] = Array.isArray(val) ? val : [val]
    } else if (col.type === 'hierarchical_enum') {
      values[col.key] = typeof val === 'string' ? val : '-'
    } else if (col.type === 'boolean') {
      values[col.key] = val === true ? true : val === false ? false : null
    } else if (col.type === 'number') {
      values[col.key] = typeof val === 'number' ? val : (Number(val) || null)
    } else {
      values[col.key] = String(val)
    }
  }
  return values
}

// ── 文件加载 ──
async function handleFile(file) {
  try {
    const data = await readFile(file)
    headers.value = data.headers.map(String)
    rows.value = data.rows
    rangeStart.value = 1
    rangeEnd.value = data.rows.length
    selectedInputColumns.value = []
    analysisMap.value = {}
    dataShare.setSharedData(headers.value, rows.value, file.name, true)
    if (dataShare.coreColumn != null) {
      selectedInputColumns.value = [Number(dataShare.coreColumn)]
    }
  } catch (err) { toast.error(err.message) }
}

function loadDemo() {
  const demo = DEMO_DATA.comments
  dataShare.setSharedData(demo.headers, demo.rows, '用户评论示例.csv', true)
  headers.value = [...demo.headers]
  rows.value = demo.rows.map(r => [...r])
  rangeStart.value = 1
  rangeEnd.value = demo.rows.length
  selectedInputColumns.value = dataShare.coreColumn != null ? [Number(dataShare.coreColumn)] : []
  analysisMap.value = {}
}

function reset() {
  headers.value = []
  rows.value = []
  analysisMap.value = {}
  labelingPlan.value = { taskName: '', goal: '', inputColumns: [], outputColumns: [], compiledPrompt: '', promptDirty: false }
  userGoal.value = ''
}

// ── AI 生成打标方案 ──
async function generateLabelingPlanWithAI() {
  const settings = useSettingsStore()
  if (!settings.isConfigured) { settings.showSettings = true; toast.warn('请先配置 API 密钥'); return }
  if (!rows.value.length) { toast.warn('请先上传数据'); return }

  isGeneratingPlan.value = true
  try {
    const inputCols = selectedInputColumns.value.length > 0 ? selectedInputColumns.value : (dataShare.coreColumn != null ? [Number(dataShare.coreColumn)] : [0])
    const sampleRows = rows.value.slice(0, 10).map(row => {
      const obj = {}
      inputCols.forEach(ci => { obj[headers.value[ci]] = row[ci] ?? '' })
      return obj
    })

    const prompt = getLabelingPlanGenerationPrompt(userGoal.value, headers.value, sampleRows, inputCols)
    const res = await callAI(prompt, '你是一个数据分析配置专家。', settings.getApiConfig().workModel)
    const parsed = parseRobustJSON(res)

    const plan = normalizeLabelingPlan(parsed)
    if (!plan) throw new Error('AI 返回的方案格式无效')

    const err = validateLabelingPlan(plan)
    if (err) throw new Error(err)

    labelingPlan.value = {
      ...plan,
      compiledPrompt: compileLabelingPrompt(plan),
      promptDirty: false
    }
    selectedInputColumns.value = plan.inputColumns
      .map(name => headers.value.indexOf(name))
      .filter(i => i >= 0)
  } catch (e) {
    toast.error('AI 生成打标方案失败: ' + e.message)
  } finally {
    isGeneratingPlan.value = false
  }
}

// ── 从 Prompt 反向同步列配置 ──
async function syncPlanFromPrompt() {
  const settings = useSettingsStore()
  if (!settings.isConfigured) { settings.showSettings = true; toast.warn('请先配置 API 密钥'); return }
  if (!labelingPlan.value.compiledPrompt.trim()) { toast.warn('当前 Prompt 为空'); return }

  isSyncingPlan.value = true
  try {
    const prompt = getPlanFromPromptPrompt(labelingPlan.value.compiledPrompt, labelingPlan.value)
    const res = await callAI(prompt, '你是一个 Prompt 逆向分析专家。', settings.getApiConfig().workModel)
    const parsed = parseRobustJSON(res)
    const plan = normalizeLabelingPlan(parsed)
    if (!plan) throw new Error('无法从 Prompt 中解析出有效的列配置')

    if (!confirm(`AI 解析出 ${plan.outputColumns.length} 个输出列：\n${plan.outputColumns.map(c => '- ' + c.name).join('\n')}\n\n确认覆盖当前方案？`)) return

    labelingPlan.value = {
      ...plan,
      compiledPrompt: labelingPlan.value.compiledPrompt,
      promptDirty: false
    }
  } catch (e) {
    toast.error('同步失败: ' + e.message)
  } finally {
    isSyncingPlan.value = false
  }
}

// ── 核心：逐行 AI 打标 ──
async function startLabeling() {
  if (isAnalyzing.value || !rows.value.length) return
  const settings = useSettingsStore()
  const config = settings.getApiConfig()
  if (!config.key) { settings.showSettings = true; toast.warn('请先配置 API 密钥'); return }

  const plan = labelingPlan.value
  const validationErr = validateLabelingPlan(plan)
  if (validationErr) { toast.warn(validationErr); return }

  const inputCols = selectedInputColumns.value.length > 0 ? selectedInputColumns.value : (plan.inputColumns.map(name => headers.value.indexOf(name)).filter(i => i >= 0))
  if (inputCols.length === 0) { toast.warn('请选择至少一个 AI 参考列'); return }

  let start = parseInt(rangeStart.value) || 1
  let end = parseInt(rangeEnd.value) || rows.value.length
  if (start < 1) start = 1
  if (end > rows.value.length) end = rows.value.length
  if (start > end) { toast.warn('开始行不能大于结束行'); return }

  isAnalyzing.value = true
  processed.value = 0
  totalToProcess.value = end - start + 1
  currentProcessingRowIdx.value = -1

  for (let k = start - 1; k < end; k++) {
    analysisMap.value[k] = { status: 'pending', values: {}, errorMessage: '' }
  }

  const systemPrompt = plan.promptDirty
    ? plan.compiledPrompt
    : compileLabelingPrompt(plan)

  // 构建任务列表
  const tasks = []
  for (let i = start - 1; i < end; i++) {
    const rowInput = {}
    inputCols.forEach(ci => {
      rowInput[headers.value[ci]] = rows.value[i][ci] ?? ''
    })
    const hasContent = Object.values(rowInput).some(v => String(v).trim().length > 0)
    if (!hasContent) {
      const emptyValues = {}
      plan.outputColumns.forEach(c => { emptyValues[c.key] = null })
      analysisMap.value[i] = { status: 'done', values: emptyValues, errorMessage: '' }
      processed.value++
    } else {
      tasks.push({ content: JSON.stringify(rowInput), systemPrompt, index: i })
    }
  }

  // 标记待处理行
  tasks.forEach(t => { analysisMap.value[t.index].status = 'processing' })

  // 并发调用 AI
  actualConcurrency.value = settings.concurrency
  const { finalConcurrency } = await callAIBatch(
    tasks.map(t => ({ content: t.content, systemPrompt: t.systemPrompt })),
    (batchIdx, result, error, meta) => {
      const rowIdx = tasks[batchIdx].index
      if (error) {
        analysisMap.value[rowIdx] = { status: 'error', values: {}, errorMessage: error.message }
      } else {
        const parsed = parseRobustJSON(result)
        const normalized = normalizeRowResult(parsed, plan.outputColumns)
        if (normalized) {
          analysisMap.value[rowIdx] = { status: 'done', values: normalized, errorMessage: '' }
        } else {
          analysisMap.value[rowIdx] = { status: 'error', values: {}, errorMessage: 'AI 返回 JSON 格式不规范' }
        }
      }
      processed.value++
      actualConcurrency.value = meta.concurrency
    },
    settings.concurrency
  )

  if (finalConcurrency < settings.concurrency) {
    toast.warn(`API 限流，已自动降级并发数: ${settings.concurrency} → ${finalConcurrency}`)
  }

  isAnalyzing.value = false
  currentProcessingRowIdx.value = -1

  // 将打标结果写入全局共享，供数据摘要页使用
  const doneCount = Object.values(analysisMap.value).filter(r => r.status === 'done').length
  if (doneCount > 0) {
    dataShare.setLabelingResults(plan.outputColumns, analysisMap.value)
  }

  toast.success('AI 打标完成！')
}

// ── 导出 ──
function exportResults() {
  const plan = labelingPlan.value
  const expHeaders = [...headers.value, ...plan.outputColumns.map(c => `${c.name} (AI)`)]
  const expRows = rows.value.map((row, ri) => {
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
  exportToXlsx(expHeaders, expRows, 'AI打标结果.xlsx')
}
</script>
