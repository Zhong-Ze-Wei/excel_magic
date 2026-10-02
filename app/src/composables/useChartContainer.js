import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue'
import * as echarts from 'echarts/core'

/** 容器可见且有尺寸时才创建图表，折叠展开与页面缓存恢复时同步尺寸和数据。 */
export function useChartContainer(containerRef, render) {
  let chart = null
  let observer = null
  let active = true

  function updateChart() {
    const container = containerRef.value
    if (!active || !container?.isConnected || container.clientWidth <= 0 || container.clientHeight <= 0) return
    if (!chart) chart = echarts.init(container)
    else chart.resize()
    render(chart)
  }

  onMounted(() => {
    observer = new ResizeObserver(updateChart)
    observer.observe(containerRef.value)
    updateChart()
  })
  onActivated(() => {
    active = true
    updateChart()
  })
  onDeactivated(() => { active = false })
  onBeforeUnmount(() => {
    active = false
    observer?.disconnect()
    chart?.dispose()
    chart = null
  })

  return { updateChart }
}
