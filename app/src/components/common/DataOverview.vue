<template>
  <div class="rounded-xl border border-slate-200/60 overflow-hidden">
    <!-- 折叠态：一行摘要（默认显示） -->
    <button @click="toggle" class="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
      <div class="flex items-center gap-2 text-[11px]">
        <span class="text-slate-400">📊</span>
        <span class="font-bold text-slate-700">{{ rowCount.toLocaleString() }}</span>
        <span class="text-slate-400">行 ×</span>
        <span class="font-bold text-slate-700">{{ colCount }}</span>
        <span class="text-slate-400">列</span>
        <span v-if="dominantType" class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">{{ dominantType }}</span>
        <span class="text-slate-400">·</span>
        <span class="text-slate-500">填充率 {{ avgFillRate }}%</span>
      </div>
      <ChevronDown class="w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0" :class="{ 'rotate-180': isOpen }" />
    </button>

    <!-- 展开态：chart 可视化 -->
    <div class="overflow-hidden transition-all duration-300 ease-in-out" :style="{ maxHeight: isOpen ? '500px' : '0px' }">
      <div v-show="isOpen" class="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
        <!-- 左右双栏：列类型分布 + 填充率 TOP -->
        <div class="grid grid-cols-2 gap-3">
          <!-- 列类型分布环形图 -->
          <div>
            <p class="text-[9px] font-bold text-slate-400 uppercase mb-1">列类型分布</p>
            <div ref="typeChartRef" style="height: 120px;"></div>
          </div>
          <!-- 填充率条形 -->
          <div>
            <p class="text-[9px] font-bold text-slate-400 uppercase mb-1">填充率</p>
            <div class="space-y-1">
              <div v-for="item in fillRateTop" :key="item.header" class="flex items-center gap-1.5">
                <span class="text-[9px] text-slate-500 w-16 truncate text-right">{{ item.header }}</span>
                <div class="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-500"
                    :class="item.rate >= 90 ? 'bg-emerald-400' : item.rate >= 60 ? 'bg-amber-400' : 'bg-rose-400'"
                    :style="{ width: item.rate + '%' }"></div>
                </div>
                <span class="text-[9px] font-mono text-slate-500 w-7">{{ item.rate }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 数值列摘要（如果有） -->
        <div v-if="numericStats.length">
          <p class="text-[9px] font-bold text-slate-400 uppercase mb-1">数值列摘要</p>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="ns in numericStats" :key="ns.header"
              class="px-2 py-1 rounded-md text-[9px] bg-slate-50 border border-slate-200 text-slate-600 font-mono">
              {{ ns.header }}: 中位{{ ns.median }} · 均值{{ ns.mean }} · [{{ ns.min }}, {{ ns.max }}]
            </span>
          </div>
        </div>

        <!-- 文本列摘要（如果有） -->
        <div v-if="textStats.length">
          <p class="text-[9px] font-bold text-slate-400 uppercase mb-1">文本列概览</p>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="ts in textStats" :key="ts.header"
              class="px-2 py-1 rounded-md text-[9px] bg-slate-50 border border-slate-200 text-slate-600">
              {{ ts.header }}: 均{{ ts.avgLength }}字
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useChartContainer } from '../../composables/useChartContainer'

echarts.use([PieChart, TooltipComponent, CanvasRenderer])

const props = defineProps({
  profiles: { type: Array, default: () => [] },
  rowCount: { type: Number, default: 0 },
  colCount: { type: Number, default: 0 }
})

const isOpen = ref(false)
const typeChartRef = ref(null)
const { updateChart } = useChartContainer(typeChartRef, renderChart)

const TYPE_LABELS = { number: '数值', text: '文本', enum: '枚举', boolean: '布尔', date: '日期', identifier: '标识', empty: '空' }
const TYPE_COLORS = { number: '#3b82f6', text: '#8b5cf6', enum: '#10b981', boolean: '#f59e0b', date: '#06b6d4', identifier: '#64748b', empty: '#cbd5e1' }

const dominantType = computed(() => {
  const counts = {}
  props.profiles.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1 })
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? (TYPE_LABELS[top[0]] || top[0]) + '为主' : null
})

const avgFillRate = computed(() => {
  if (!props.profiles.length) return 0
  const sum = props.profiles.reduce((s, p) => s + (p.fillRate || 0), 0)
  return Math.round(sum / props.profiles.length)
})

// 列类型分布（给 ECharts 用）
const typeChartData = computed(() => {
  const counts = {}
  props.profiles.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1 })
  return Object.entries(counts).map(([type, count]) => ({
    name: TYPE_LABELS[type] || type,
    value: count,
    itemStyle: { color: TYPE_COLORS[type] || '#94a3b8' }
  }))
})

// 填充率 TOP 5（降序）
const fillRateTop = computed(() => {
  return props.profiles
    .map(p => ({ header: p.header, rate: Math.round(p.fillRate || 0) }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5)
})

// 数值列摘要
const numericStats = computed(() => {
  return props.profiles
    .filter(p => p.type === 'number' && p.median != null)
    .slice(0, 4)
    .map(p => ({ header: p.header, median: p.median, mean: p.mean, min: p.min, max: p.max }))
})

// 文本列摘要
const textStats = computed(() => {
  return props.profiles
    .filter(p => p.type === 'text' && p.avgLength != null)
    .slice(0, 4)
    .map(p => ({ header: p.header, avgLength: p.avgLength }))
})

function toggle() {
  isOpen.value = !isOpen.value
}

function renderChart(chartInstance) {
  chartInstance.setOption({
    tooltip: { trigger: 'item', renderMode: 'richText', formatter: '{b}: {c} 列 ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, fontSize: 9, color: '#64748b', formatter: '{b}\n{d}%' },
      data: typeChartData.value
    }]
  })
}

watch(typeChartData, updateChart, { flush: 'post' })
</script>
