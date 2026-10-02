import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import SettingsModal from '../components/settings/SettingsModal.vue'
import CleaningRulesPanel from '../components/cleaning/CleaningRulesPanel.vue'
import MobileCollapsible from '../components/common/MobileCollapsible.vue'
import { useSettingsStore } from '../stores/settings'

let wrappers = []
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers = []; vi.restoreAllMocks(); vi.unstubAllGlobals() })
function render(component, options = {}) { const wrapper = mount(component, options); wrappers.push(wrapper); return wrapper }
function button(wrapper, text) { return wrapper.findAll('button').find(b => b.text() === text) }
async function settingsModal() {
  const store = useSettingsStore()
  const wrapper = render(SettingsModal, { global: { stubs: { teleport: true } } })
  store.showSettings = true
  await nextTick()
  return { wrapper, store }
}

describe('设置草稿', () => {
  it('关闭弹窗同时丢弃并发、自动分析与密钥修改，保存后统一生效', async () => {
    const { wrapper, store } = await settingsModal()
    await wrapper.find('input[type=range]').setValue(9)
    await wrapper.find('input[type=checkbox]').setValue(false)
    await wrapper.find('input[list="work-list-aiping"]').setValue('draft-model')
    expect(store.concurrency).toBe(3)
    expect(store.autoIntentAnalysis).toBe(true)
    store.showSettings = false
    await nextTick()
    store.showSettings = true
    await nextTick()
    expect(wrapper.find('input[type=range]').element.value).toBe('3')
    expect(wrapper.find('input[type=checkbox]').element.checked).toBe(true)
    expect(wrapper.find('input[list="work-list-aiping"]').element.value).not.toBe('draft-model')
    await wrapper.find('input[type=range]').setValue(9)
    await wrapper.find('input[type=checkbox]').setValue(false)
    await button(wrapper, '保存配置').trigger('click')
    expect(store.concurrency).toBe(9)
    expect(store.autoIntentAnalysis).toBe(false)
    expect(store.showSettings).toBe(false)
  })

  it('重置先修改草稿，关闭不清除已保存的密钥', async () => {
    const { wrapper, store } = await settingsModal()
    store.saveApiKey('aiping', 'saved-key')
    store.concurrency = 8
    vi.stubGlobal('confirm', vi.fn(() => true))
    await button(wrapper, '重置默认').trigger('click')
    expect(store.apiKey).toBe('saved-key')
    expect(store.concurrency).toBe(8)
    expect(wrapper.find('input[type=range]').element.value).toBe('3')
    await button(wrapper, '保存配置').trigger('click')
    expect(store.apiKey).toBe('')
    expect(store.concurrency).toBe(3)
  })

  it('导入有效配置只更新草稿，保存前不覆盖 API 或并发', async () => {
    const { wrapper, store } = await settingsModal()
    const input = wrapper.find('input[type=file]')
    const file = new File([JSON.stringify({ apiKeys: { aiping: 'imported-key' }, concurrency: 12, autoIntentAnalysis: false })], 'settings.json')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.find('input[type=range]').element.value).toBe('12'))
    expect(store.concurrency).toBe(3)
    expect(store.apiKey).toBe('')
    await button(wrapper, '保存配置').trigger('click')
    expect(store.concurrency).toBe(12)
    expect(store.apiKey).toBe('imported-key')
    expect(store.autoIntentAnalysis).toBe(false)
  })

  it('无关 JSON 不污染草稿，导出提示明确包含密钥', async () => {
    const { wrapper, store } = await settingsModal()
    const input = wrapper.find('input[type=file]')
    Object.defineProperty(input.element, 'files', { value: [new File(['{"unrelated":true}'], 'bad.json')], configurable: true })
    await input.trigger('change')
    await flushPromises()
    await button(wrapper, '保存配置').trigger('click')
    expect(store.rulesConfig.unrelated).toBeUndefined()
    store.showSettings = true
    await nextTick()
    expect(wrapper.text()).toContain('导出文件包含 API Key')
  })
})

describe('清洗规则面板', () => {
  function panel() {
    return render(CleaningRulesPanel, { props: { headers: [], rulesMeta: [{ key: 'tooShort', title: '短文本' }], expandedRules: { tooShort: true }, enabledRulesCount: 1, customFiltersCount: 0, describeFilter: () => '' } })
  }
  it('导入按钮打开隐藏文件选择器', async () => {
    const wrapper = panel()
    const click = vi.spyOn(wrapper.find('input[type=file]').element, 'click').mockImplementation(() => {})
    await button(wrapper, '导入').trigger('click')
    expect(click).toHaveBeenCalledOnce()
  })
  it('配置对象被替换后显示新值，编辑写回新对象', async () => {
    const wrapper = panel(), store = useSettingsStore()
    store.rulesConfig = { ...store.rulesConfig, tooShort: { enable: false, minLength: 8 } }
    await nextTick()
    expect(wrapper.find('input[type=number]').element.value).toBe('8')
    await wrapper.find('input[type=number]').setValue(10)
    expect(store.rulesConfig.tooShort.minLength).toBe(10)
  })
})

describe('移动折叠内容', () => {
  it('脱离文档挂载后插入、内容增长和重新展开不依赖旧像素高度', async () => {
    const report = ref('短报告')
    const wrapper = render({ setup: () => () => h(MobileCollapsible, { title: '报告' }, () => h('p', report.value)) })
    await flushPromises()
    document.body.appendChild(wrapper.element)
    report.value = '新增流式报告段落\n'.repeat(100)
    await nextTick()
    expect(wrapper.find('p').isVisible()).toBe(true)
    expect(wrapper.findAll('[style*="max-height"]')).toHaveLength(0)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('p').isVisible()).toBe(false)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('p').isVisible()).toBe(true)
    expect(wrapper.find('p').text()).toContain('新增流式报告段落')
  })
})
