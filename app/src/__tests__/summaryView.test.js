// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import SummaryView from '../views/SummaryView.vue'
import { useDataShareStore } from '../stores/dataShare'
import { useImportIntentStore } from '../stores/importIntent'
import { useSettingsStore } from '../stores/settings'
import { useToast } from '../services/toast'
import { callAI, callStreamingAI } from '../services/ai'
import { DEMO_DATA } from '../data/demoData'

vi.mock('../services/ai', () => ({ callAI: vi.fn(), callStreamingAI: vi.fn() }))
vi.mock('../composables/useDevice', () => ({ useDevice: () => ({ isMobile: ref(false) }) }))

let pinia, wrapper
beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  useSettingsStore().saveApiKey('aiping', 'test-key')
  vi.mocked(callAI).mockReset()
  vi.mocked(callStreamingAI).mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  useToast().clearAll()
  disposePinia(pinia)
  localStorage.clear()
})

async function mountSummary(headers = ['评论', '敏感列'], rows = [['公开评价', 'SECRET-CELL']]) {
  const data = useDataShareStore()
  data.setSharedData(headers, rows, 'test.xlsx')
  wrapper = shallowMount(SummaryView, { global: { plugins: [pinia] } })
  await nextTick()
  return { data, view: wrapper.vm }
}

describe('摘要界面数据与安全边界', () => {
  it('保留 Markdown 格式并移除模型 HTML 中的事件和脚本', async () => {
    const { view } = await mountSummary()
    vi.mocked(callStreamingAI).mockImplementation(async (_system, _user, onChunk) => {
      onChunk('## 报告\n\n**正常内容**\n<img src="invalid" onerror="window.injected=true"><script>alert(1)</script>')
    })
    await view.generateSummary()
    await nextTick()
    expect(wrapper.find('.prose strong').text()).toBe('正常内容')
    expect(wrapper.find('.prose img').attributes('onerror')).toBeUndefined()
    expect(wrapper.find('.prose script').exists()).toBe(false)
  })

  it('生成报告的画像和样本均只发送勾选列', async () => {
    const { view } = await mountSummary()
    view.selectedCols = [0]
    await nextTick()
    await view.generateSummary()
    const [, prompt, , , options] = vi.mocked(callStreamingAI).mock.calls[0]
    expect(prompt).toContain('公开评价')
    expect(prompt).not.toContain('SECRET-CELL')
    expect(prompt).not.toContain('敏感列')
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  it('推荐仅发送勾选画像，并把相对画像序号映射回原始列', async () => {
    const { view } = await mountSummary(['敏感列', '评论'], [['SECRET-CELL', '公开评价']])
    view.analysisTheme = '评价分析'
    view.selectedCols = [1]
    await nextTick()
    vi.mocked(callAI).mockResolvedValue(JSON.stringify({ theme: '反馈主题', focusColumns: [{ columnIndex: 0 }], analysisAngles: ['服务质量'] }))
    await view.recommendColumns()
    await nextTick()
    expect(vi.mocked(callAI).mock.calls[0][0]).not.toContain('SECRET-CELL')
    expect(vi.mocked(callAI).mock.calls[0][0]).not.toContain('敏感列')
    expect(view.selectedCols).toEqual([1])
    expect(view.analysisTheme).toBe('反馈主题')
    expect(view.recommendedAngles).toEqual(['服务质量'])
  })

  it('同形状数据替换会取消旧流，迟到分片不能写入新数据', async () => {
    const { view, data } = await mountSummary()
    view.analysisTheme = '旧主题'
    await nextTick()
    let onChunk, finish, signal
    vi.mocked(callStreamingAI).mockImplementation((_s, _u, callback, _m, options) => {
      onChunk = callback
      signal = options?.signal
      return new Promise(resolve => { finish = resolve })
    })
    const task = view.generateSummary()
    onChunk('旧报告前半段')
    data.setSharedData(['评论', '敏感列'], [['新评价', 'NEW-SECRET']], 'new.xlsx')
    await nextTick()
    onChunk('旧报告迟到片段')
    finish()
    await task
    expect(signal?.aborted).toBe(true)
    expect(view.summaryText).toBe('')
    expect(view.analysisTheme).toBe('')
    expect(view.isSummarizing).toBe(false)
  })

  it('切换数据后迟到的推荐不覆盖新主题和列选择', async () => {
    const { view, data } = await mountSummary()
    view.analysisTheme = '旧主题'
    await nextTick()
    let finish
    vi.mocked(callAI).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const task = view.recommendColumns()
    data.setSharedData(['新列'], [['新内容']], 'new.xlsx')
    await nextTick()
    finish(JSON.stringify({ theme: '过时推荐', focusColumns: [{ columnIndex: 0 }], analysisAngles: ['过时角度'] }))
    await task
    expect(view.analysisTheme).toBe('')
    expect(view.recommendedAngles).toEqual([])
    expect(view.selectedCols).toEqual([0])
  })

  it('用户修改主题后忽略旧推荐', async () => {
    const { view } = await mountSummary()
    view.analysisTheme = '主题 A'
    await nextTick()
    let finish
    vi.mocked(callAI).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const task = view.recommendColumns()
    view.analysisTheme = '主题 B'
    await nextTick()
    finish(JSON.stringify({ theme: '主题 A 的迟到推荐', focusColumns: [{ columnIndex: 0 }] }))
    await task
    expect(view.analysisTheme).toBe('主题 B')
  })

  it('页面已挂载后仍能消费新预规划，并保留关注列', async () => {
    const { view } = await mountSummary()
    useImportIntentStore().pipelinePlan = { summary: { theme: '新规划主题', focusColumns: [1] } }
    await nextTick()
    expect(view.analysisTheme).toBe('新规划主题')
    expect(view.selectedCols).toEqual([1])
  })

  it('首次进入页面时预规划关注列不会被表头 watcher 重置全选', async () => {
    const data = useDataShareStore()
    data.setSharedData(['A', 'B'], [['a', 'b']])
    useImportIntentStore().pipelinePlan = { summary: { theme: 'B主题', focusColumns: [1] } }
    wrapper = shallowMount(SummaryView, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(wrapper.vm.selectedCols).toEqual([1])
    expect(wrapper.vm.analysisTheme).toBe('B主题')
  })

  it('清除打标结果同步清除虚拟列选择和旧报告', async () => {
    const { view, data } = await mountSummary()
    data.setLabelingResults([{ key: 'label', name: '标签', type: 'text' }], { 0: { status: 'done', values: { label: 'value' } } })
    await nextTick()
    expect(view.selectedLabelingCols).toEqual(['label'])
    view.summaryText = '旧报告'
    data.clearLabelingResults()
    await nextTick()
    expect(view.selectedLabelingCols).toEqual([])
    expect(view.summaryText).toBe('')
  })

  it('重置通过全局数据总线清除数据', async () => {
    const { view, data } = await mountSummary()
    view.reset()
    await nextTick()
    expect(data.hasData).toBe(false)
    expect(view.hasData).toBe(false)
  })

  it('取消后的网络错误不会附加到新数据报告', async () => {
    const { view, data } = await mountSummary()
    let fail
    vi.mocked(callStreamingAI).mockImplementation(() => new Promise((_resolve, reject) => { fail = reject }))
    const task = view.generateSummary()
    data.clearSharedData()
    await nextTick()
    fail(new DOMException('aborted', 'AbortError'))
    await task
    expect(view.summaryText).toBe('')
    expect(view.isSummarizing).toBe(false)
  })

  it('清除正在生成的报告会取消请求且忽略后续分片', async () => {
    const { view } = await mountSummary()
    let callback, finish
    vi.mocked(callStreamingAI).mockImplementation((_s, _u, onChunk) => {
      callback = onChunk
      return new Promise(resolve => { finish = resolve })
    })
    const task = view.generateSummary()
    callback('半份报告')
    view.clearReport()
    callback('迟到片段')
    finish()
    await task
    expect(view.summaryText).toBe('')
    expect(view.isSummarizing).toBe(false)
  })

  it('取消勾选的 AI 标签不会出现在推荐和摘要中', async () => {
    const { view, data } = await mountSummary()
    data.setLabelingResults([
      { key: 'public', name: '公开标签', type: 'text' },
      { key: 'private', name: '隐私标签', type: 'text' }
    ], { 0: { status: 'done', values: { public: '公开值', private: 'PRIVATE-LABEL' } } })
    await nextTick()
    view.selectedLabelingCols = ['public']
    view.analysisTheme = '主题'
    await nextTick()
    vi.mocked(callAI).mockResolvedValue('{"focusColumns":[{"columnIndex":0}]}')
    await view.recommendColumns()
    await view.generateSummary()
    const recommendation = vi.mocked(callAI).mock.calls[0][0]
    const summary = vi.mocked(callStreamingAI).mock.calls[0][1]
    expect(recommendation).toContain('公开标签')
    expect(recommendation).not.toContain('隐私标签')
    expect(summary).toContain('公开值')
    expect(summary).not.toContain('PRIVATE-LABEL')
    expect(summary).not.toContain('隐私标签')
  })

  it('缺少密钥时打开设置，不发送摘要请求', async () => {
    const { view } = await mountSummary()
    useSettingsStore().saveApiKey('aiping', '')
    await view.generateSummary()
    expect(useSettingsStore().showSettings).toBe(true)
    expect(callStreamingAI).not.toHaveBeenCalled()
    expect(view.isSummarizing).toBe(false)
  })

  it('加载示例数据通过全局数据总线初始化页面', async () => {
    const { view, data } = await mountSummary()
    view.reset()
    await nextTick()
    view.loadDemo()
    await nextTick()
    expect(data.sourceName).toBe(DEMO_DATA.comments.name)
    expect(data.coreColumn).toBe(DEMO_DATA.comments.coreColumn)
    expect(data.rows.length).toBeGreaterThan(0)
    expect(view.rows).toEqual(data.rows)
    expect(view.selectedCols).toEqual(data.headers.map((_, index) => index))
  })
})
