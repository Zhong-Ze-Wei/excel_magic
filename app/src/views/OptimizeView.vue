<template>
  <!-- ===== 移动端模板 ===== -->
  <div v-if="isMobile" class="px-3 py-3 space-y-3 pb-20 animate-fade-in">
    <div class="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-xl border border-violet-200/50 p-3">
      <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
        <Sparkles class="w-5 h-5 text-violet-600" /> 数据优化
      </h2>
      <p class="text-[10px] text-slate-500 mt-0.5">一句话描述目标，AI 自动识别核心列并配置清洗规则。</p>
    </div>

    <!-- 全局关联状态 -->
    <div v-if="hasData && dataShare.hasData"
      class="bg-emerald-500/10 rounded-lg border border-emerald-500/20 px-3 py-2 flex justify-between items-center text-[10px]">
      <div class="flex items-center gap-1.5 text-emerald-800 min-w-0">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        <span class="truncate">已关联 <strong>{{ dataShare.sourceName }}</strong></span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 font-bold shrink-0 ml-2">断开</button>
    </div>

    <!-- 数据上传 -->
    <MobileCollapsible title="数据文件" :default-open="!hasData">
      <FileUploader v-if="!hasData" label="上传 Excel/CSV" :icon="Sparkles" iconBg="bg-violet-50" iconColor="text-violet-600" @file="handleFile" />
      <div v-else class="text-xs text-slate-600">
        <span class="font-bold">{{ rows.length }} 行 × {{ headers.length }} 列</span>
        <span class="text-slate-400 ml-2">核心列: {{ headers[sourceCol] }}</span>
      </div>
    </MobileCollapsible>

    <!-- AI 意图输入 -->
    <MobileCollapsible v-if="hasData" title="AI 清洗" :default-open="true">
      <div class="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-lg p-3 border border-violet-100">
        <textarea v-model="intentInput" rows="2" class="w-full px-3 py-2 text-xs border border-violet-200 rounded-lg outline-none resize-none bg-white"
          :placeholder="`描述清洗目标，如：清洗${headers[sourceCol] || '数据'}中的水军和广告垃圾...`"
          @keydown.ctrl.enter="runAiOptimize" @keydown.meta.enter="runAiOptimize"></textarea>
        <button @click="runAiOptimize" :disabled="isOptimizing || !intentInput.trim()"
          class="w-full mt-2 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
          <Sparkles class="w-3.5 h-3.5" /> {{ isOptimizing ? 'AI 分析中...' : '智能优化' }}
        </button>
      </div>
      <!-- AI 配置摘要 -->
      <div v-if="aiSummary" class="mt-2 px-3 py-2 bg-slate-50 rounded-lg text-[10px] text-slate-600 border border-slate-200">
        {{ aiSummary }}
      </div>
    </MobileCollapsible>

    <!-- 统计 + 操作 -->
    <MobileCollapsible v-if="hasData && cleanedRows.length" title="结果" :default-open="true">
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="bg-white rounded-lg border border-slate-200 p-2.5">
          <div class="text-[9px] font-bold text-slate-400 uppercase">总量</div>
          <div class="text-lg font-black text-slate-800 font-mono">{{ totalCount }}</div>
        </div>
        <div class="bg-emerald-50 rounded-lg border border-emerald-200 p-2.5">
          <div class="text-[9px] font-bold text-emerald-600 uppercase">保留</div>
          <div class="text-lg font-black text-emerald-800 font-mono">{{ stats.keep }}</div>
        </div>
      </div>
      <div class="space-y-2">
        <button @click="exportCleanedOnly"
          class="w-full py-2.5 bg-orange-600 text-white rounded-lg text-xs font-bold active:bg-orange-700 flex items-center justify-center gap-1">
          <Download class="w-3.5 h-3.5" /> 导出保留数据
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button @click="shareDataTo('/analysis')"
            class="py-2 bg-violet-600 text-white rounded-lg text-[10px] font-bold active:bg-violet-700">
            发送至分析
          </button>
          <button @click="applyToGlobal"
            class="py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold active:bg-emerald-700">
            应用到全局
          </button>
        </div>
      </div>
    </MobileCollapsible>

    <!-- 结果表格 -->
    <MobileCollapsible v-if="hasData && cleanedRows.length" title="优化预览" :default-open="true">
      <MobileTableWrapper title="优化结果" :row-count="filteredRows.length" height-class="h-[40vh]">
        <table class="w-full text-left border-collapse text-[10px]">
          <thead class="bg-slate-50 sticky top-0 z-10 text-[8px] font-bold text-slate-500 uppercase border-b border-slate-200">
            <tr>
              <th class="px-2 py-2 text-center sticky left-0 bg-slate-50 z-20 w-12">状态</th>
              <th class="px-2 py-2">原文</th>
              <th class="px-2 py-2 w-16 text-center">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-600">
            <tr v-for="(item, ri) in filteredRows" :key="ri" :class="item.displayDecision === 'delete' ? 'bg-rose-50/20' : ''">
              <td class="px-2 py-1.5 text-center whitespace-nowrap sticky left-0 z-10 bg-white" :class="{ 'bg-rose-50/80': item.displayDecision === 'delete' }">
                <span class="px-1 py-0.5 rounded-full text-[8px] font-bold"
                  :class="item.displayDecision === 'delete' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'">
                  {{ item.displayDecision === 'delete' ? '已删' : '保留' }}
                </span>
              </td>
              <td class="px-2 py-1.5 truncate max-w-[200px]">{{ item.originalText || '' }}</td>
              <td class="px-2 py-1.5 text-center whitespace-nowrap">
                <button @click="toggleDecision(item)"
                  class="p-1 rounded text-slate-400 active:text-slate-600">
                  {{ item.displayDecision === 'keep' ? '✕' : '✓' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </MobileTableWrapper>
    </MobileCollapsible>
  </div>

  <!-- ===== 桌面端模板 ===== -->
  <div v-else class="animate-fade-in max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-2xl border border-violet-200/50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Sparkles class="w-6 h-6 text-violet-600" /> AI 数据优化
        </h2>
        <p class="text-xs text-slate-500 mt-1">描述你的清洗目标，AI 自动识别核心列并配置全套清洗规则。</p>
      </div>
    </div>

    <!-- 全局关联状态 -->
    <div v-if="hasData && dataShare.hasData"
      class="bg-emerald-500/10 rounded-xl border border-emerald-500/20 px-4 py-3 flex justify-between items-center text-xs animate-fade-in">
      <div class="flex items-center gap-2 text-emerald-800">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>已关联全局工作表：<strong>{{ dataShare.sourceName }}</strong> ({{ rows.length }} 行)</span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 hover:text-rose-600 font-bold">断开</button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Panel: Upload + AI Intent -->
      <div class="lg:col-span-4 space-y-6">
        <FileUploader v-if="!hasData" label="上传需要优化的 Excel/CSV 文件" :icon="Sparkles" iconBg="bg-violet-50" iconColor="text-violet-600" @file="handleFile" />

        <!-- AI 意图卡片 -->
        <div v-if="hasData" class="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-xl border border-violet-200/60 p-5 space-y-3">
          <div class="flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-violet-600" />
            <span class="text-sm font-bold text-violet-800">描述清洗目标</span>
          </div>
          <textarea v-model="intentInput" rows="3"
            class="w-full px-3 py-2.5 text-sm border border-violet-200 rounded-lg outline-none resize-none bg-white focus:ring-2 focus:ring-violet-300"
            :placeholder="`例如：清洗${headers[sourceCol] || '数据'}中的水军、广告和重复内容，只保留有价值的真实评论...`"
            @keydown.ctrl.enter="runAiOptimize" @keydown.meta.enter="runAiOptimize"></textarea>
          <button @click="runAiOptimize" :disabled="isOptimizing || !intentInput.trim()"
            class="w-full py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm">
            <Sparkles class="w-4 h-4" /> {{ isOptimizing ? 'AI 分析中...' : '智能优化' }}
          </button>
          <div v-if="aiSummary" class="text-xs text-slate-600 bg-white/60 rounded-lg px-3 py-2 border border-slate-200/60">
            {{ aiSummary }}
          </div>
          <div v-if="hasData" class="text-[10px] text-slate-400">
            核心列: <span class="font-bold text-slate-600">{{ headers[sourceCol] }}</span>
            <select :value="sourceCol" @change="e => { dataShare.setCoreColumn(Number(e.target.value)); }"
              class="ml-1 px-1 py-0.5 border border-slate-200 rounded text-[10px] text-slate-600">
              <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Right Panel: Results -->
      <div class="lg:col-span-8 space-y-6">
        <!-- Empty State -->
        <div v-if="!hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center text-slate-400">
          <Sparkles class="w-16 h-16 mb-4 opacity-30 text-violet-500" />
          <h3 class="font-bold text-slate-700 text-sm">等待数据</h3>
          <p class="text-xs text-slate-400 mt-1">请在左侧上传 Excel/CSV，然后描述清洗目标。</p>
        </div>

        <!-- Result Table -->
        <div v-if="hasData && cleanedRows.length" class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[640px] animate-fade-in">
          <div class="px-5 py-2 border-b border-slate-100 bg-slate-50/50 space-y-2">
            <!-- Filter Tabs -->
            <div class="flex items-center gap-1">
              <button @click="activeFilter = 'all'"
                class="px-2 py-0.5 rounded text-[11px] font-bold transition-all"
                :class="activeFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100'">
                全部 {{ totalCount }}
              </button>
              <button @click="activeFilter = 'keep'"
                class="px-2 py-0.5 rounded text-[11px] font-bold transition-all"
                :class="activeFilter === 'keep' ? 'bg-emerald-600 text-white' : 'text-emerald-600 hover:bg-emerald-50'">
                保留 {{ stats.keep }}
              </button>
              <button @click="activeFilter = 'delete'"
                class="px-2 py-0.5 rounded text-[11px] font-bold transition-all"
                :class="activeFilter === 'delete' ? 'bg-rose-600 text-white' : 'text-rose-600 hover:bg-rose-50'">
                过滤 {{ stats.delete }}
              </button>
            </div>
            <!-- Actions -->
            <div class="flex items-center gap-1.5">
              <button @click="exportCleanedOnly"
                class="px-3 py-1 bg-orange-600 text-white rounded-md text-xs font-medium hover:bg-orange-700 transition-all flex items-center gap-1">
                <Download class="w-3.5 h-3.5" /> 导出保留数据
              </button>
              <button @click="shareDataTo('/analysis')"
                class="px-3 py-1 text-violet-600 hover:bg-violet-50 rounded-md text-xs font-medium transition-all">
                发送至分析
              </button>
              <button @click="shareDataTo('/summary')"
                class="px-3 py-1 text-violet-600 hover:bg-violet-50 rounded-md text-xs font-medium transition-all">
                数据摘要
              </button>
              <span class="w-px h-4 bg-slate-200 mx-1"></span>
              <button @click="applyToGlobal" v-if="dataShare.hasData"
                class="px-3 py-1 text-emerald-600 hover:bg-emerald-50 rounded-md text-xs font-medium transition-all">
                应用到全局
              </button>
            </div>
          </div>

          <!-- Table Body -->
          <div class="flex-1 overflow-auto rounded-b-xl">
            <table class="w-full text-left border-collapse min-w-[500px]">
              <thead class="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                <tr>
                  <th class="px-3 py-3 w-20 text-center">状态</th>
                  <th class="px-4 py-3 w-44">命中原因</th>
                  <th class="px-4 py-3">原文 ({{ headers[sourceCol] }})</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-[11px] text-slate-600">
                <tr v-for="item in filteredRows" :key="item"
                  class="hover:bg-slate-50/50 transition-colors"
                  :class="item.displayDecision === 'delete' ? 'bg-rose-50/20 text-rose-700/90' : ''">
                  <td class="px-3 py-2 text-center whitespace-nowrap">
                    <button @click="toggleDecision(item)"
                      class="px-2 py-0.5 rounded-full text-[9px] font-bold cursor-pointer transition-all hover:ring-2 hover:ring-offset-1"
                      :class="item.displayDecision === 'delete' ? 'bg-rose-100 text-rose-800 hover:ring-rose-400' : 'bg-emerald-100 text-emerald-800 hover:ring-emerald-400'">
                      {{ item.displayDecision === 'delete' ? '已删除' : '保留' }}
                    </button>
                  </td>
                  <td class="px-4 py-2">
                    <span class="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1 py-0.5 rounded">{{ item.hitRule }}</span>
                    <div class="text-[9px] text-slate-400 leading-tight mt-0.5">{{ item.reason }}</div>
                  </td>
                  <td class="px-4 py-2" :title="item.originalText">{{ item.originalText || '' }}</td>
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
import { ref, computed, watch } from 'vue'
import { Sparkles, Download } from 'lucide-vue-next'
import FileUploader from '../components/common/FileUploader.vue'
import MobileCollapsible from '../components/common/MobileCollapsible.vue'
import MobileTableWrapper from '../components/common/MobileTableWrapper.vue'
import { runCleaningPipeline } from '../services/cleaningRules'
import { getSmartFilterPrompt } from '../services/prompts'
import { callAI } from '../services/ai'
import { parseRobustJSON } from '../services/jsonParser'
import { useDataShareStore } from '../stores/dataShare'
import { useSettingsStore } from '../stores/settings'
import { useDevice } from '../composables/useDevice'
import { useGlobalDataSync } from '../composables/useGlobalDataSync'
import { useFileUpload } from '../composables/useFileUpload'
import { useExport } from '../composables/useExport'
import { useShare } from '../composables/useShare'
import { useToast } from '../services/toast'
import { DEFAULT_RULES_CONFIG } from '../config/defaultSettings'

const toast = useToast()
const dataShare = useDataShareStore()
const settings = useSettingsStore()
const { isMobile } = useDevice()

const intentInput = ref('')
const isOptimizing = ref(false)
const aiSummary = ref('')
const activeFilter = ref('all')

const { headers, rows, hasData, importGlobalExcel, disconnectGlobalExcel } = useGlobalDataSync({
  onInit: () => {}
})

const { exportData } = useExport({ rows, headers })
const { shareTo, applyToGlobal: applyGlobal } = useShare({ rows, headers, importGlobalExcel })

const { handleFile } = useFileUpload({
  onFileLoaded: () => {}
})

const sourceCol = computed(() => dataShare.coreColumn)

// AI 配置后的临时规则
const aiRulesConfig = ref(null)
const cleanedRows = ref([])

const totalCount = computed(() => rows.value.length)

const stats = computed(() => {
  let keep = 0, del = 0
  cleanedRows.value.forEach(r => {
    if (r.displayDecision === 'keep') keep++
    else del++
  })
  return { keep, delete: del }
})

const filteredRows = computed(() => {
  if (activeFilter.value === 'all') return cleanedRows.value
  return cleanedRows.value.filter(r => r.displayDecision === activeFilter.value)
})

// 核心列变化时，如果已有 AI 配置，重新跑 pipeline
watch(() => dataShare.coreColumn, () => {
  if (aiRulesConfig.value && rows.value.length) {
    runPipelineWithConfig(aiRulesConfig.value)
  }
})

// 数据变化时，清除旧结果
watch(() => rows.value.length, (newLen) => {
  if (newLen === 0) {
    cleanedRows.value = []
    aiSummary.value = ''
    aiRulesConfig.value = null
  }
})

async function runAiOptimize() {
  const input = intentInput.value.trim()
  if (!input || isOptimizing.value) return
  if (!settings.isConfigured) { settings.showSettings = true; toast.warn('请先配置 API 密钥'); return }
  if (!rows.value.length) { toast.warn('请先上传数据'); return }

  isOptimizing.value = true
  aiSummary.value = ''
  try {
    // 收集列样本
    const allColumnSamples = {}
    for (let c = 0; c < headers.value.length; c++) {
      allColumnSamples[c] = rows.value.slice(0, 20).map(r => r[c] != null ? String(r[c]) : '')
    }
    const rulesMeta = [
      { key: 'empty', title: '空文本过滤', description: '空单元格删除' },
      { key: 'tooShort', title: '字数过短', description: '过短无意义文本' },
      { key: 'duplicate', title: '精确去重', description: '重复文本' },
      { key: 'pureEmoji', title: '纯表情', description: '纯表情符号' },
      { key: 'pureSymbol', title: '纯符号', description: '纯标点符号' },
      { key: 'linkOnly', title: '纯链接', description: '纯网址' },
      { key: 'topicOnly', title: '纯话题', description: '纯话题标签' },
      { key: 'shortMeaningless', title: '无意义短词', description: '水贴词汇' },
      { key: 'adLink', title: '引流广告', description: '含广告关键词' },
      { key: 'garbledText', title: '疑似乱码', description: '非正常字符占比高' }
    ]

    const prompt = getSmartFilterPrompt(input, headers.value, sourceCol.value, allColumnSamples, rulesMeta)
    const raw = await callAI(prompt, '你是一个数据清洗专家。', settings.getApiConfig().workModel)
    const parsed = parseRobustJSON(raw)

    if (!parsed) { toast.error('AI 返回格式异常'); return }

    // 构建 AI 规则配置（基于默认值 + AI 覆盖）
    const config = JSON.parse(JSON.stringify(DEFAULT_RULES_CONFIG))
    config.weakPolicy = 'delete'

    if (parsed.builtinConfig) {
      const bc = parsed.builtinConfig
      if (bc.rulesToEnable) bc.rulesToEnable.forEach(k => { if (config[k]) config[k].enable = true })
      if (bc.rulesToDisable) bc.rulesToDisable.forEach(k => { if (config[k]) config[k].enable = false })
      if (bc.paramOverrides) {
        for (const [key, overrides] of Object.entries(bc.paramOverrides)) {
          if (config[key]) Object.assign(config[key], overrides)
        }
      }
    }
    if (parsed.customFilters?.length) {
      config.customFilters = parsed.customFilters.map(cf => ({
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: cf.name || 'AI 规则',
        type: cf.type,
        enabled: true,
        policy: 'delete',
        config: cf.config || {}
      }))
    }

    // AI 推荐核心列
    if (typeof parsed.recommendedCoreColumn === 'number' && parsed.recommendedCoreColumn >= 0 && parsed.recommendedCoreColumn < headers.value.length) {
      if (parsed.recommendedCoreColumn !== sourceCol.value) {
        dataShare.setCoreColumn(parsed.recommendedCoreColumn)
      }
    }

    aiRulesConfig.value = config
    runPipelineWithConfig(config)

    // 生成摘要
    const enabledCount = Object.keys(config).filter(k => config[k]?.enable).length
    const customCount = config.customFilters?.length || 0
    aiSummary.value = `已启用 ${enabledCount} 条原子规则` + (customCount ? `，添加 ${customCount} 条自定义筛选` : '') + `。核心列：${headers.value[sourceCol.value]}`

    toast.success('AI 配置完成')
  } catch (err) {
    toast.error('AI 优化失败: ' + err.message)
  } finally {
    isOptimizing.value = false
  }
}

function runPipelineWithConfig(config) {
  const result = runCleaningPipeline(rows.value, headers.value, sourceCol.value, config)
  // suspect → delete 在展示层处理
  cleanedRows.value = result.map(r => ({
    ...r,
    displayDecision: r.decision === 'suspect' ? 'delete' : r.decision
  }))
}

function toggleDecision(item) {
  item.displayDecision = item.displayDecision === 'keep' ? 'delete' : 'keep'
}

function exportCleanedOnly() {
  exportData(() => {
    return cleanedRows.value.filter(r => r.displayDecision === 'keep').map(r => r.originalRow)
  }, '优化结果.xlsx')
}

function shareDataTo(targetPath) {
  shareTo(() => ({
    headers: [...headers.value],
    rows: cleanedRows.value.filter(r => r.displayDecision === 'keep').map(r => r.originalRow)
  }), targetPath, '优化后数据')
  toast.success('数据已共享')
}

function applyToGlobal() {
  applyGlobal(() => ({
    headers: [...headers.value],
    rows: cleanedRows.value.filter(r => r.displayDecision === 'keep').map(r => r.originalRow)
  }), dataShare.sourceName || '已优化数据.xlsx')
}
</script>
