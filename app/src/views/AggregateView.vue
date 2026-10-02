<template>
  <!-- ===== 移动端模板 ===== -->
  <div v-if="isMobile" :class="PAGE.mobile + ' animate-fade-in'">
    <PageHeader :icon="BarChart3" theme="aggregate" title="分组对比" subtitle="按某列分组，对另一列做求和/均值/计数，快速对比。" />

    <!-- AI 方案引导条 -->
    <AiPlanBanner :visible="hasPlan" :summary="planSummary" @run="runWithPlan" />

    <!-- 全局数据条（统一复用） -->
    <GlobalDataBanner :visible="hasData" :source-name="dataShare.sourceName"
      :headers="headers" :rows="rows" :mobile="true"
      @disconnect="disconnectGlobalExcel" />

    <!-- 未上传提示 -->
    <div v-if="!hasData" :class="CARD.base + ' p-4'">
      <FileUploader label="上传数据文件" :icon="BarChart3" iconBg="bg-blue-50" iconColor="text-blue-600" @file="handleFile" />
    </div>

    <!-- 配置 + 结果 -->
    <div v-else class="space-y-3">
      <AggregateConfigPanel
        :headers="headers" :rows="rows"
        :group-col-idx="groupColIdx" :value-col-idx="valueColIdx" :agg-op="aggOp"
        @update:group-col-idx="v => groupColIdx = v"
        @update:value-col-idx="v => valueColIdx = v"
        @update:agg-op="v => aggOp = v"
        @run="runAggregate" :can-run="canRun" mobile
      />
    </div>

    <!-- 结果 -->
    <AggregateResult v-if="result" :result="result" :headers="headers"
      :group-col-idx="groupColIdx" :value-label="valueLabel" :agg-op="aggOp"
      :chart-color="chartColor" mobile @export="exportResult" />
  </div>

  <!-- ===== 桌面端模板 ===== -->
  <div v-else :class="PAGE.desktop">
    <PageHeader :icon="BarChart3" theme="aggregate" title="分组对比"
      subtitle="按某列分组，对另一列做求和/均值/计数，生成对比图表。适合「按地区看销售额」「按类别统计数量」等场景。" />

    <!-- AI 方案引导条 -->
    <AiPlanBanner :visible="hasPlan" :summary="planSummary" @run="runWithPlan" />

    <!-- 全局数据条 -->
    <GlobalDataBanner :visible="hasData" :source-name="dataShare.sourceName"
      :headers="headers" :rows="rows"
      @disconnect="disconnectGlobalExcel" />

    <!-- 未上传 -->
    <div v-if="!hasData" :class="CARD.base + ' p-8'">
      <FileUploader label="上传数据文件" :icon="BarChart3" iconBg="bg-blue-50" iconColor="text-blue-600" @file="handleFile" />
    </div>

    <!-- 双栏：左配置 / 右结果 -->
    <div v-else :class="TWO_COL.grid">
      <div :class="TWO_COL.left">
        <AggregateConfigPanel
          :headers="headers" :rows="rows"
          :group-col-idx="groupColIdx" :value-col-idx="valueColIdx" :agg-op="aggOp"
          @update:group-col-idx="v => groupColIdx = v"
          @update:value-col-idx="v => valueColIdx = v"
          @update:agg-op="v => aggOp = v"
          @run="runAggregate" :can-run="canRun"
        />
      </div>
      <div :class="TWO_COL.right">
        <AggregateResult v-if="result" :result="result" :headers="headers"
          :group-col-idx="groupColIdx" :value-label="valueLabel" :agg-op="aggOp"
          :chart-color="chartColor" @export="exportResult" />
        <div v-else :class="CARD.base + ' p-12 text-center'">
          <BarChart3 class="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p class="text-sm text-slate-400">配置完成后点击「开始对比」，结果将显示在这里</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { BarChart3 } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import { useImportIntentStore } from '../stores/importIntent'
import { useDevice } from '../composables/useDevice'
import { useGlobalDataSync } from '../composables/useGlobalDataSync'
import { useFileUpload } from '../composables/useFileUpload'
import { useExport } from '../composables/useExport'
import { PAGE, TWO_COL, CARD } from '../styles/tokens'
import FileUploader from '../components/common/FileUploader.vue'
import GlobalDataBanner from '../components/common/GlobalDataBanner.vue'
import PageHeader from '../components/common/PageHeader.vue'
import AiPlanBanner from '../components/common/AiPlanBanner.vue'
import AggregateConfigPanel from '../components/aggregate/AggregateConfigPanel.vue'
import AggregateResult from '../components/aggregate/AggregateResult.vue'
import { groupAggregate, aggregateResultToTable, formatAggregateValue, AGGREGATE_OPS } from '../services/groupAggregate'
import { detectColumnType } from '../services/dataProfiler'
import { useToast } from '../services/toast'

const { isMobile } = useDevice()
const toast = useToast()
const dataShare = useDataShareStore()
const intent = useImportIntentStore()
const groupColIdx = ref(null)
const valueColIdx = ref(null)
const aggOp = ref('sum')
const result = ref(null)

const { headers, rows, hasData, disconnectGlobalExcel } = useGlobalDataSync({
  onInit: () => {
    groupColIdx.value = null
    valueColIdx.value = null
    aggOp.value = 'sum'
    result.value = null
    applyAggregatePlan()
  }
})

// 独立读取 AI 预规划方案，解决 keep-alive 下 onMounted 不重复触发的时序问题：
// 用户从首页确认意图后进对比页，rows/headers 未变 → useGlobalDataSync 的 watch 不触发
// → onInit 不执行 → 方案读不到。改为用 watch 显式监听 pipelinePlan 变化。
function applyAggregatePlan() {
  const plan = intent.pipelinePlan?.aggregate
  if (plan && headers.value.length) {
    // 仅在用户尚未手动配置时预填（避免覆盖用户已选的配置）
    if (groupColIdx.value === null) groupColIdx.value = plan.groupColIdx ?? null
    if (valueColIdx.value === null) valueColIdx.value = plan.valueColIdx ?? null
    if (aggOp.value === 'sum' && plan.op) aggOp.value = plan.op
  }
}

// pipelinePlan 写入或页面激活时，主动应用方案
watch(() => intent.pipelinePlan?.aggregate, () => applyAggregatePlan(), { immediate: true })

const { handleFile } = useFileUpload()
const { exportData } = useExport({ rows, headers })

// 配置状态
watch([groupColIdx, valueColIdx, aggOp], () => { result.value = null }, { flush: 'sync' })

// AI 方案派生
const plan = computed(() => intent.pipelinePlan?.aggregate)
const hasPlan = computed(() => !!plan.value && hasData.value)
const planSummary = computed(() => {
  if (!plan.value) return ''
  const g = headers.value[plan.value.groupColIdx] || '分组列'
  const v = plan.value.valueColIdx != null ? headers.value[plan.value.valueColIdx] : '行数'
  return `按「${g}」分组，对「${v}」做 ${(plan.value.op || 'sum').toUpperCase()}`
})

// 派生
const currentOpDesc = computed(() => AGGREGATE_OPS.find(o => o.key === aggOp.value)?.desc || '')
const valueLabel = computed(() => {
  const opMeta = AGGREGATE_OPS.find(o => o.key === aggOp.value)
  const opText = opMeta ? opMeta.label.split(' ')[0] : ''
  if (aggOp.value === 'count') return `${opText}（行数）`
  return `${opText}·${headers.value[valueColIdx.value] || '值'}`
})
const canRun = computed(() => Number.isInteger(groupColIdx.value) && groupColIdx.value >= 0 && groupColIdx.value < headers.value.length &&
  AGGREGATE_OPS.some(op => op.key === aggOp.value) && (aggOp.value === 'count' ||
  (Number.isInteger(valueColIdx.value) && valueColIdx.value >= 0 && valueColIdx.value < headers.value.length)))
const chartColor = computed(() => {
  const map = { sum: '#3b82f6', avg: '#8b5cf6', count: '#10b981', min: '#f59e0b', max: '#ef4444' }
  return map[aggOp.value] || '#3b82f6'
})

// 列类型标签
function colTypeLabel(idx) {
  if (idx == null || !rows.value.length) return ''
  const sample = rows.value.slice(0, 50).map(r => r[idx])
  const t = detectColumnType(sample)
  const labels = { number: '数值', text: '文本', enum: '枚举', date: '日期', boolean: '布尔', identifier: 'ID', empty: '空' }
  return labels[t] || t
}
// 暴露给子组件
defineExpose({ colTypeLabel })

// 执行
function runAggregate() {
  if (!canRun.value) return
  const vCol = aggOp.value === 'count' ? groupColIdx.value : valueColIdx.value
  try {
    result.value = groupAggregate(rows.value, groupColIdx.value, vCol, aggOp.value)
    toast.success(`已完成 ${result.value.meta.totalGroups} 组对比`)
  } catch (e) {
    result.value = null
    console.error('[分组对比] 执行失败:', e)
    toast.error('执行失败：' + (e.message || '未知错误'))
  }
}

// 按 AI 方案一键执行
function runWithPlan() {
  if (plan.value) {
    groupColIdx.value = plan.value.groupColIdx ?? groupColIdx.value
    valueColIdx.value = plan.value.valueColIdx ?? valueColIdx.value
    aggOp.value = plan.value.op || aggOp.value
  }
  runAggregate()
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
