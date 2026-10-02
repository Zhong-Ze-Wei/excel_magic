import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import DataOverview from '../components/common/DataOverview.vue'
import StatsPieChart from '../components/common/StatsPieChart.vue'
import StatsBarChart from '../components/common/StatsBarChart.vue'

const echarts = vi.hoisted(() => ({ init: vi.fn(), use: vi.fn() }))
vi.mock('echarts/core', () => ({
  ...echarts,
  graphic: { LinearGradient: class LinearGradient {} }
}))

const wrappers = [], observers = [], charts = []
let width = 400, height = 200
function visible(element) {
  if (!element.isConnected) return false
  for (let node = element; node; node = node.parentElement) {
    if (node.style?.display === 'none') return false
  }
  return true
}
function resizeContainers() {
  for (const observer of observers) observer.callback([])
}
function mountChart(component, props) {
  const wrapper = mount(component, { props, attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  width = 400
  height = 200
  vi.clearAllMocks()
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () { return visible(this) ? width : 0 })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () { return visible(this) ? height : 0 })
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback) {
      this.callback = callback
      this.observe = vi.fn()
      this.disconnect = vi.fn()
      observers.push(this)
    }
  })
  echarts.init.mockImplementation(() => {
    const instance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
    charts.push(instance)
    return instance
  })
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  observers.length = 0
  charts.length = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('折叠数据概览', () => {
  it('折叠挂载不初始化，展开后只初始化一次并在数据清空时清掉旧扇区', async () => {
    const wrapper = mountChart(DataOverview, { profiles: [{ header: '金额', type: 'number', fillRate: 100 }], rowCount: 2, colCount: 1 })
    expect(echarts.init).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    resizeContainers()
    expect(echarts.init).toHaveBeenCalledTimes(1)
    expect(charts[0].setOption.mock.lastCall[0].tooltip.renderMode).toBe('richText')
    expect(charts[0].setOption.mock.lastCall[0].series[0].data[0]).toMatchObject({ name: '数值', value: 1 })
    await wrapper.get('button').trigger('click')
    const resizeCount = charts[0].resize.mock.calls.length
    await wrapper.setProps({ profiles: [] })
    resizeContainers()
    expect(charts[0].resize).toHaveBeenCalledTimes(resizeCount)
    await wrapper.get('button').trigger('click')
    resizeContainers()
    expect(echarts.init).toHaveBeenCalledTimes(1)
    expect(charts[0].setOption.mock.lastCall[0].series[0].data).toEqual([])
    wrapper.unmount()
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(charts[0].dispose).toHaveBeenCalledTimes(1)
  })
})

describe.each([
  ['饼图', StatsPieChart, { name: 'A', value: 1 }],
  ['条形图', StatsBarChart, { group: 'A', value: 1 }]
])('%s 容器生命周期', (name, component, item) => {
  it('等待非零容器，显示后使用最新数据且容器变化会调整尺寸', async () => {
    width = 0
    const wrapper = mountChart(component, { data: [item] })
    expect(echarts.init).not.toHaveBeenCalled()
    await wrapper.setProps({ data: [{ ...item, value: 9 }] })
    width = 320
    resizeContainers()
    expect(echarts.init).toHaveBeenCalledTimes(1)
    expect(charts[0].setOption.mock.lastCall[0].series[0].data[0]).toEqual(name === '饼图'
      ? { name: 'A', value: 9, itemStyle: { color: undefined } } : 9)
    width = 640
    height = 360
    resizeContainers()
    expect(charts[0].resize).toHaveBeenCalled()
    expect(echarts.init).toHaveBeenCalledTimes(1)
  })

  it('KeepAlive 失活不更新图表，重新激活恢复尺寸且不重复初始化', async () => {
    const show = ref(true)
    const Other = defineComponent({ render: () => h('div', '其他页面') })
    const Host = defineComponent({ setup: () => () => h(KeepAlive, null, {
      default: () => show.value ? h(component, { data: [item], key: 'chart' }) : h(Other, { key: 'other' })
    }) })
    mountChart(Host)
    expect(echarts.init).toHaveBeenCalledTimes(1)
    show.value = false
    await nextTick()
    const resizeCount = charts[0].resize.mock.calls.length
    width = 280
    resizeContainers()
    expect(charts[0].resize).toHaveBeenCalledTimes(resizeCount)
    show.value = true
    await nextTick()
    expect(charts[0].resize.mock.calls.length).toBeGreaterThan(resizeCount)
    expect(echarts.init).toHaveBeenCalledTimes(1)
  })

  it('卸载释放观察器和实例，已排队的通知不重新创建图表', () => {
    const wrapper = mountChart(component, { data: [item] })
    wrapper.unmount()
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(charts[0].dispose).toHaveBeenCalledTimes(1)
    resizeContainers()
    expect(echarts.init).toHaveBeenCalledTimes(1)
    expect(charts[0].dispose).toHaveBeenCalledTimes(1)
  })

  it('从有数据变为空数组时清掉旧图形', async () => {
    const wrapper = mountChart(component, { data: [item] })
    await wrapper.setProps({ data: [] })
    expect(charts[0].setOption.mock.lastCall[0].series[0].data).toEqual([])
  })

  it('导入的图例和分组值通过 Canvas 文本 tooltip 展示', () => {
    mountChart(component, { data: [item] })
    expect(charts[0].setOption.mock.lastCall[0].tooltip.renderMode).toBe('richText')
  })
})

it('聚合 tooltip 把分组和列名当文本，不拼接 HTML 标签', () => {
  const group = '<img src=x onerror=alert(1)>'
  const label = '<svg onload=alert(2)>'
  mountChart(StatsBarChart, { data: [{ group, value: 9 }], valueLabel: label })
  const tooltip = charts[0].setOption.mock.lastCall[0].tooltip
  expect(tooltip.renderMode).toBe('richText')
  expect(tooltip.formatter([{ name: group, value: 9 }])).toBe(`${group}\n${label}：9`)
})
