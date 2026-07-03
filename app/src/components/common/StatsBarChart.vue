<template>
  <!--
    水平柱状对比图（分组聚合专用）
    设计：横向柱状（分组名在 Y 轴），按值降序，自动取 TOP N 避免过长。
    复用项目已注册的 echarts/core（与 StatsPieChart 同一依赖）。
  -->
  <div ref="chartRef" :style="{ height: height + 'px', width: '100%' }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  // [{ group: '站点A', value: 120 }, ...]
  data: { type: Array, default: () => [] },
  // 柱子颜色（单色，渐变起始色）
  color: { type: String, default: '#3b82f6' },
  // 值的标签（如 '总互动量'）
  valueLabel: { type: String, default: '值' },
  // 最多展示多少根柱子（避免分组过多时挤压）
  topN: { type: Number, default: 15 },
  height: { type: Number, default: 360 }
})

const chartRef = ref(null)
let chartInstance = null

function render() {
  if (!chartInstance) return

  // 取 TOP N，并反转（echarts Y 轴从下往上，降序需反转后最大的在上）
  const top = props.data.slice(0, props.topN).reverse()
  const groupNames = top.map(d => d.group)
  const values = top.map(d => d.value)
  const maxVal = values.length ? Math.max(...values) : 0

  chartInstance.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const p = params[0]
        return `${p.name}<br/><b>${props.valueLabel}：${p.value}</b>`
      }
    },
    grid: {
      left: '3%', right: '8%', top: '3%', bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      max: Math.ceil(maxVal * 1.15),
      axisLabel: { fontSize: 11, color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#f1f5f9' } }
    },
    yAxis: {
      type: 'category',
      data: groupNames,
      axisLabel: { fontSize: 11, color: '#475569' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e2e8f0' } }
    },
    series: [{
      type: 'bar',
      data: values,
      barMaxWidth: 24,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: props.color },
          { offset: 1, color: lightenColor(props.color) }
        ])
      },
      label: {
        show: true,
        position: 'right',
        fontSize: 11,
        fontWeight: 'bold',
        color: '#475569',
        formatter: '{c}'
      }
    }]
  }, true)
}

// 简易颜色变亮（hex → rgba 加白），用于渐变结束色
function lightenColor(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.8)`
}

function handleResize() {
  chartInstance?.resize()
}

onMounted(() => {
  chartInstance = echarts.init(chartRef.value)
  render()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
  chartInstance = null
})

watch(() => props.data, () => render(), { deep: true })
watch(() => props.topN, () => render())
</script>
