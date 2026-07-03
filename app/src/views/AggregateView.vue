<template>
  <!-- ===== 移动端模板 ===== -->
  <div v-if="isMobile" class="px-4 py-4 space-y-4 pb-20 animate-fade-in">
    <!-- 标题 -->
    <div class="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-200/50 p-3">
      <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
        <BarChart3 class="w-5 h-5 text-blue-600" /> 分组对比
      </h2>
      <p class="text-[10px] text-slate-500 mt-0.5">按某列分组，对另一列做求和/均值/计数，快速对比。</p>
    </div>

    <!-- 全局数据关联 -->
    <div v-if="hasData && dataShare.hasData"
      class="bg-emerald-500/10 rounded-lg border border-emerald-500/20 px-3 py-2 flex justify-between items-center text-[10px]">
      <div class="flex items-center gap-1.5 text-emerald-800 min-w-0">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        <span class="truncate">已关联 <strong>{{ dataShare.sourceName }}</strong></span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 font-bold shrink-0 ml-2">断开</button>
    </div>

    <!-- 未上传提示 -->
    <div v-if="!hasData" class="space-y-3">
      <FileUploader label="上传数据文件" :icon="BarChart3" iconBg="bg-blue-50" iconColor="text-blue-600" @file="handleFile" />
    </div>

    <!-- 配置 + 结果 -->
    <div v-else class="space-y-3">
      <!-- 步骤①选分组列 -->
      <div class="bg-white rounded-xl border border-slate-200 p-3">
        <label class="block text-[10px] font-bold text-slate-600 mb-1.5">① 按哪列分组？</label>
        <select v-model="groupColIdx" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold">
          <option :value="null" disabled>选择分组列…</option>
          <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}（{{ colTypeLabel(i) }}）</option>
        </select>
      </div>

      <!-- 步骤②选值列 -->
      <div class="bg-white rounded-xl border border-slate-200 p-3">
        <label class="block text-[10px] font-bold text-slate-600 mb-1.5">② 对哪列做统计？</label>
        <select v-model="valueColIdx" :disabled="aggOp === 'count'" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40">
          <option :value="null" disabled>选择值列…</option>
          <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}（{{ colTypeLabel(i) }}）</option>
        </select>
      </div>

      <!-- 步骤③选聚合方式 -->
      <div class="bg-white rounded-xl border border-slate-200 p-3">
        <label class="block text-[10px] font-bold text-slate-600 mb-1.5">③ 怎么统计？</label>
        <div class="grid grid-cols-3 gap-1.5">
          <button v-for="op in AGGREGATE_OPS" :key="op.key" @click="aggOp = op.key"
            class="py-1.5 rounded-lg text-[10px] font-bold transition-colors"
            :class="aggOp === op.key ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 active:bg-slate-100'">
            {{ op.label.split(' ')[0] }}
          </button>
        </div>
        <p class="text-[9px] text-slate-400 mt-1.5">{{ currentOpDesc }}</p>
      </div>

      <!-- 执行按钮 -->
      <button @click="runAggregate" :disabled="!canRun"
        class="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold active:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200">
        开始对比
      </button>
    </div>

    <!-- 步骤④结果 -->
    <div v-if="result" class="space-y-3">
      <!-- 图表 -->
      <div class="bg-white rounded-xl border border-slate-200 p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-slate-600 uppercase tracking-wider">对比图</span>
          <span class="text-[9px] text-slate-400">TOP {{ Math.min(result.groups.length, 15) }} · 按值降序</span>
        </div>
        <StatsBarChart :data="result.groups" :value-label="valueLabel" :color="chartColor" :topN="15" :height="300" />
      </div>

      <!-- 明细表 -->
      <div class="bg-white rounded-xl border border-slate-200 p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-slate-600 uppercase tracking-wider">明细</span>
          <button @click="exportResult"
            class="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold active:bg-emerald-100">
            导出
          </button>
        </div>
        <div class="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table class="text-left border-collapse text-[10px]" style="width:100%">
            <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th class="px-2 py-1.5">{{ headers[groupColIdx] || '分组' }}</th>
                <th class="px-2 py-1.5 text-right">{{ valueLabel }}</th>
                <th class="px-2 py-1.5 text-right">行数</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              <tr v-for="g in result.groups" :key="g.group" class="hover:bg-slate-50">
                <td class="px-2 py-1 truncate max-w-[120px]">{{ g.group }}</td>
                <td class="px-2 py-1 text-right font-mono font-bold">{{ formatAggregateValue(g.value, aggOp) }}</td>
                <td class="px-2 py-1 text-right text-slate-400">{{ g.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== 桌面端模板 ===== -->
  <div v-else class="animate-fade-in max-w-5xl mx-auto space-y-6 pb-10">
    <!-- 标题 -->
    <div class="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-200/50 p-4">
      <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
        <BarChart3 class="w-6 h-6 text-blue-600" /> 分组对比
      </h2>
      <p class="text-xs text-slate-500 mt-1">按某列分组，对另一列做求和/均值/计数，生成对比图表。适合「按地区看销售额」「按类别统计数量」等场景。</p>
    </div>

    <!-- 全局数据状态 -->
    <div v-if="hasData && dataShare.hasData"
      class="bg-emerald-500/10 rounded-lg border border-emerald-500/20 px-4 py-2.5 flex justify-between items-center text-xs">
      <div class="flex items-center gap-2 text-emerald-800 min-w-0">
        <span class="relative flex h-2 w-2 shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span class="truncate">已关联全局工作表：<strong>{{ dataShare.sourceName }}</strong>（{{ rows.length }} 行 × {{ headers.length }} 列）</span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 hover:text-rose-600 font-bold shrink-0 ml-3">断开</button>
    </div>

    <!-- 未上传 -->
    <div v-if="!hasData" class="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      <FileUploader label="上传数据文件" :icon="BarChart3" iconBg="bg-blue-50" iconColor="text-blue-600" @file="handleFile" />
    </div>

    <!-- 双栏：左配置 / 右结果 -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- 左：配置面板 -->
      <div class="lg:col-span-4 space-y-4">
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <h3 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Settings class="w-4 h-4 text-slate-500" /> 配置
          </h3>

          <!-- ① 分组列 -->
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1.5">① 按哪列分组？</label>
            <select v-model="groupColIdx" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500">
              <option :value="null" disabled>选择分组列…</option>
              <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}（{{ colTypeLabel(i) }}）</option>
            </select>
            <p class="text-[10px] text-slate-400 mt-1">分组列会作为对比维度（如「站点」「地区」）</p>
          </div>

          <!-- ② 值列 -->
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1.5">② 对哪列做统计？</label>
            <select v-model="valueColIdx" :disabled="aggOp === 'count'" class="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">
              <option :value="null" disabled>选择值列…</option>
              <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}（{{ colTypeLabel(i) }}）</option>
            </select>
            <p v-if="aggOp === 'count'" class="text-[10px] text-amber-600 mt-1">计数模式不需要值列</p>
          </div>

          <!-- ③ 聚合方式 -->
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1.5">③ 怎么统计？</label>
            <div class="grid grid-cols-5 gap-1.5">
              <button v-for="op in AGGREGATE_OPS" :key="op.key" @click="aggOp = op.key"
                class="py-2 rounded-lg text-[10px] font-bold transition-colors"
                :class="aggOp === op.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'">
                {{ op.label.split(' ')[0] }}
              </button>
            </div>
            <p class="text-[10px] text-slate-400 mt-1.5">{{ currentOpDesc }}</p>
          </div>

          <button @click="runAggregate" :disabled="!canRun"
            class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
            开始对比
          </button>
        </div>
      </div>

      <!-- 右：结果面板 -->
      <div class="lg:col-span-8 space-y-4">
        <div v-if="!result" class="bg-white rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <BarChart3 class="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p class="text-sm text-slate-400">配置完成后点击「开始对比」，结果将显示在这里</p>
        </div>

        <template v-else>
          <!-- 图表卡 -->
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <span class="text-xs font-bold text-slate-700">{{ headers[groupColIdx] }} 的 {{ valueLabel }}</span>
                <span class="text-[10px] text-slate-400 ml-2">共 {{ result.meta.totalGroups }} 组 · {{ result.meta.totalRows }} 行</span>
              </div>
              <span class="text-[10px] text-slate-400">TOP 15 · 按值降序</span>
            </div>
            <StatsBarChart :data="result.groups" :value-label="valueLabel" :color="chartColor" :topN="15" :height="380" />
          </div>

          <!-- 明细表卡 -->
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold text-slate-700">明细</span>
              <button @click="exportResult"
                class="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                <Download class="w-3 h-3" /> 导出 Excel
              </button>
            </div>
            <div class="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table class="text-left border-collapse text-xs" style="width:100%">
                <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th class="px-3 py-2">{{ headers[groupColIdx] || '分组' }}</th>
                    <th class="px-3 py-2 text-right">{{ valueLabel }}</th>
                    <th class="px-3 py-2 text-right">数据行数</th>
                    <th class="px-3 py-2 text-right">占比</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-700">
                  <tr v-for="g in result.groups" :key="g.group" class="hover:bg-slate-50">
                    <td class="px-3 py-2 truncate max-w-[200px]">{{ g.group }}</td>
                    <td class="px-3 py-2 text-right font-mono font-bold">{{ formatAggregateValue(g.value, aggOp) }}</td>
                    <td class="px-3 py-2 text-right text-slate-500">{{ g.count }}</td>
                    <td class="px-3 py-2 text-right text-slate-400">{{ ((g.count / result.meta.totalRows) * 100).toFixed(1) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { BarChart3, Settings, Download } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import { useImportIntentStore } from '../stores/importIntent'
import { useDevice } from '../composables/useDevice'
import { useGlobalDataSync } from '../composables/useGlobalDataSync'
import { useFileUpload } from '../composables/useFileUpload'
import { useExport } from '../composables/useExport'
import FileUploader from '../components/common/FileUploader.vue'
import StatsBarChart from '../components/common/StatsBarChart.vue'
import { groupAggregate, aggregateResultToTable, formatAggregateValue, AGGREGATE_OPS } from '../services/groupAggregate'
import { detectColumnType } from '../services/dataProfiler'
import { useToast } from '../services/toast'

const { isMobile } = useDevice()
const toast = useToast()
const dataShare = useDataShareStore()
const intent = useImportIntentStore()

const { headers, rows, hasData, disconnectGlobalExcel } = useGlobalDataSync({
  onInit: (h) => {
    // 从意图方案预填配置（AI 规划了 aggregate 方案时）
    const plan = intent.pipelinePlan?.aggregate
    if (plan && h.length) {
      groupColIdx.value = plan.groupColIdx ?? null
      valueColIdx.value = plan.valueColIdx ?? null
      aggOp.value = plan.op || 'sum'
    }
  }
})

const { handleFile } = useFileUpload()
const { exportData } = useExport({ rows, headers })

// 配置状态
const groupColIdx = ref(null)
const valueColIdx = ref(null)
const aggOp = ref('sum')
const result = ref(null)

// 派生
const currentOpDesc = computed(() => AGGREGATE_OPS.find(o => o.key === aggOp.value)?.desc || '')
const valueLabel = computed(() => {
  const opMeta = AGGREGATE_OPS.find(o => o.key === aggOp.value)
  const opText = opMeta ? opMeta.label.split(' ')[0] : ''
  if (aggOp.value === 'count') return `${opText}（行数）`
  return `${opText}·${headers.value[valueColIdx.value] || '值'}`
})
const canRun = computed(() => groupColIdx.value !== null && (aggOp.value === 'count' || valueColIdx.value !== null))
const chartColor = computed(() => {
  const map = { sum: '#3b82f6', avg: '#8b5cf6', count: '#10b981', min: '#f59e0b', max: '#ef4444' }
  return map[aggOp.value] || '#3b82f6'
})

// 列类型标签（帮助用户识别数值列）
function colTypeLabel(idx) {
  if (idx == null || !rows.value.length) return ''
  const sample = rows.value.slice(0, 50).map(r => r[idx])
  const t = detectColumnType(sample)
  const labels = { number: '数值', text: '文本', enum: '枚举', date: '日期', boolean: '布尔', identifier: 'ID', empty: '空' }
  return labels[t] || t
}

// 执行
function runAggregate() {
  if (!canRun.value) return
  const vCol = aggOp.value === 'count' ? groupColIdx.value : valueColIdx.value
  try {
    result.value = groupAggregate(rows.value, groupColIdx.value, vCol, aggOp.value)
    toast.success(`已完成 ${result.value.meta.totalGroups} 组对比`)
  } catch (e) {
    console.error('[分组对比] 执行失败:', e)
    toast.error('执行失败：' + (e.message || '未知错误'))
  }
}

// 导出
function exportResult() {
  if (!result.value) return
  const { headers: expHeaders, rows: expRows } = aggregateResultToTable(
    result.value.groups,
    headers.value[groupColIdx.value] || '分组',
    valueLabel.value
  )
  exportData(
    () => expRows,
    `分组对比_${headers.value[groupColIdx.value] || ''}_${aggOp.value}.xlsx`,
    () => expHeaders
  )
}
</script>
