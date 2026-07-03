<template>
  <!--
    分组对比结果展示（图表 + 明细表）
    复用 CARD token 保证与全站卡片样式一致。
  -->
  <div class="space-y-4">
    <!-- 图表卡 -->
    <div :class="CARD.base + ' ' + CARD.body">
      <div class="flex items-center justify-between mb-3">
        <div class="min-w-0">
          <span class="text-xs font-bold text-slate-700 truncate inline-block">
            {{ headers[groupColIdx] }} 的 {{ valueLabel }}
          </span>
          <span class="text-[10px] text-slate-400 ml-2">
            共 {{ result.meta.totalGroups }} 组 · {{ result.meta.totalRows }} 行
          </span>
        </div>
        <span class="text-[10px] text-slate-400 shrink-0">TOP 15 · 按值降序</span>
      </div>
      <StatsBarChart :data="result.groups" :value-label="valueLabel"
        :color="chartColor" :topN="15" :height="mobile ? 300 : 380" />
    </div>

    <!-- 明细表卡 -->
    <div :class="CARD.base + ' ' + CARD.body">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold text-slate-700">明细</span>
        <button @click="$emit('export')"
          class="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
          <Download class="w-3 h-3" /> 导出
        </button>
      </div>
      <div class="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
        <table class="text-left border-collapse text-xs" style="width:100%">
          <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
            <tr>
              <th class="px-3 py-2">{{ headers[groupColIdx] || '分组' }}</th>
              <th class="px-3 py-2 text-right">{{ valueLabel }}</th>
              <th class="px-3 py-2 text-right">数据行数</th>
              <th v-if="!mobile" class="px-3 py-2 text-right">占比</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-700">
            <tr v-for="g in result.groups" :key="g.group" class="hover:bg-slate-50">
              <td class="px-3 py-2 truncate max-w-[200px]">{{ g.group }}</td>
              <td class="px-3 py-2 text-right font-mono font-bold">{{ formatAggregateValue(g.value, aggOp) }}</td>
              <td class="px-3 py-2 text-right text-slate-500">{{ g.count }}</td>
              <td v-if="!mobile" class="px-3 py-2 text-right text-slate-400">
                {{ ((g.count / result.meta.totalRows) * 100).toFixed(1) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Download } from 'lucide-vue-next'
import { CARD } from '../../styles/tokens'
import StatsBarChart from '../common/StatsBarChart.vue'
import { formatAggregateValue } from '../../services/groupAggregate'

defineProps({
  result: { type: Object, required: true },
  headers: { type: Array, default: () => [] },
  groupColIdx: { type: Number, default: null },
  valueLabel: { type: String, default: '' },
  aggOp: { type: String, default: 'sum' },
  chartColor: { type: String, default: '#3b82f6' },
  mobile: { type: Boolean, default: false }
})
defineEmits(['export'])
</script>
