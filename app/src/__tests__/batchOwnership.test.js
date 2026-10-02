import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useLabeling } from '../composables/useLabeling'
import { useFileUpload } from '../composables/useFileUpload'
import { useDataShareStore } from '../stores/dataShare'
import { useSettingsStore } from '../stores/settings'
import { useImportIntentStore } from '../stores/importIntent'
import AnalysisView from '../views/AnalysisView.vue'
import { callAIBatch } from '../services/ai'
import { readFile } from '../services/excel'

vi.mock('../services/ai', () => ({ callAIBatch: vi.fn(), callAI: vi.fn() }))
vi.mock('../services/excel', async importOriginal => ({ ...await importOriginal(), readFile: vi.fn() }))
vi.mock('vue-router', async importOriginal => ({ ...await importOriginal(), useRouter: () => ({ push: vi.fn() }) }))

let scopes = []
let wrappers = []
let dataShare
const outputColumns = [{ key: 'sentiment', name: '情感', type: 'enum', options: ['Positive', 'Negative'], required: true }]
const done = sentiment => ({ status: 'done', values: { sentiment }, errorMessage: '' })

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  setActivePinia(createPinia())
  useSettingsStore().saveApiKey('aiping', 'isolated-test-key')
  dataShare = useDataShareStore()
  dataShare.setSharedData(['评论', '地区'], [['喜欢', '上海'], ['不喜欢', '北京']], '原数据.csv')
  dataShare.labelingPlan = {
    taskName: '情感', goal: '判断情感', inputColumns: [0], outputColumns: structuredClone(outputColumns),
    compiledPrompt: '', promptDirty: false
  }
})

afterEach(async () => {
  wrappers.forEach(wrapper => wrapper.unmount())
  scopes.forEach(scope => scope.stop())
  wrappers = []
  scopes = []
  await flushPromises()
})

function instance(columns = [0]) {
  const scope = effectScope()
  scopes.push(scope)
  const selectedInputColumns = ref(columns)
  const analysisMap = ref({})
  const rangeStart = ref(1)
  const rangeEnd = ref(2)
  const api = scope.run(() => useLabeling({
    headers: ref([...dataShare.headers]), rows: ref(dataShare.rows.map(row => [...row])),
    labelingPlan: computed(() => dataShare.labelingPlan), rangeStart, rangeEnd,
    selectedInputColumns, analysisMap
  }))
  return { api, selectedInputColumns, analysisMap, rangeStart, rangeEnd }
}

function holdBatch() {
  const requests = []
  callAIBatch.mockImplementation((tasks, progress, concurrency, model, { signal }) => new Promise((resolve, reject) => {
    requests.push({ tasks, progress, signal, resolve, reject })
    signal.addEventListener('abort', () => reject(new DOMException('取消', 'AbortError')), { once: true })
  }))
  return requests
}

function mountExpert() {
  const wrapper = mount(AnalysisView, { global: { stubs: {
    StatsPieChart: true, GlobalDataBanner: true, OutputColumnsList: true, EditColumnDialog: true
  } } })
  wrappers.push(wrapper)
  return wrapper
}

describe('不同加工页面共享一个批次', () => {
  it('第二个实例不能重复发起，运行状态、进度和完成结果在两个实例一致', async () => {
    const requests = holdBatch()
    const first = instance()
    const second = instance()
    const running = first.api.runLabeling()
    const duplicate = second.api.runLabeling()
    expect(callAIBatch).toHaveBeenCalledTimes(1)
    expect([first.api.isLabeling.value, second.api.isLabeling.value]).toEqual([true, true])
    expect([first.api.totalToProcess.value, second.api.totalToProcess.value]).toEqual([2, 2])
    requests[0].progress(0, '{"sentiment":"Positive"}', null, { concurrency: 2 })
    expect([first.api.processed.value, second.api.processed.value]).toEqual([1, 1])
    expect([first.api.actualConcurrency.value, second.api.actualConcurrency.value]).toEqual([2, 2])
    requests[0].progress(1, '{"sentiment":"Negative"}', null, { concurrency: 2 })
    requests[0].resolve({ finalConcurrency: 2 })
    await Promise.all([running, duplicate])
    await nextTick()
    expect([first.api.isLabeling.value, second.api.isLabeling.value]).toEqual([false, false])
    expect(first.analysisMap.value).toEqual({ 0: done('Positive'), 1: done('Negative') })
    expect(second.analysisMap.value).toEqual(first.analysisMap.value)
  })

  it('在另一个实例修改参考列会取消原批次，迟到结果不能写回', async () => {
    const requests = holdBatch()
    const first = instance()
    const second = instance()
    const running = first.api.runLabeling()
    requests[0].progress(0, '{"sentiment":"Positive"}', null, { concurrency: 2 })
    second.selectedInputColumns.value = [1]
    expect(requests[0].signal.aborted).toBe(true)
    expect([first.api.isLabeling.value, second.api.isLabeling.value]).toEqual([false, false])
    requests[0].progress(0, '{"sentiment":"Positive"}', null, { concurrency: 2 })
    await running
    await nextTick()
    expect(dataShare.labelingResults).toBeNull()
    expect([first.api.processed.value, second.api.processed.value]).toEqual([0, 0])
    expect(first.analysisMap.value).toEqual({})
    expect(second.analysisMap.value).toEqual({})
  })

  it('再次加工全部失败时，另一实例不能继续导出上次成功的标签', async () => {
    dataShare.setLabelingResults(outputColumns, { 0: done('Positive'), 1: done('Negative') })
    const requests = holdBatch()
    const first = instance()
    const second = instance()
    const running = first.api.runLabeling()
    await nextTick()
    requests[0].progress(0, null, new Error('mock 服务异常'), { concurrency: 3 })
    requests[0].progress(1, null, new Error('mock 服务异常'), { concurrency: 3 })
    requests[0].resolve({ finalConcurrency: 3 })
    await running
    await nextTick()
    expect(first.api.stats.value.done).toBe(0)
    expect(second.api.stats.value.done).toBe(0)
  })

  it('仅重跑指定范围时，保留范围外已有标签并同步到另一实例', async () => {
    dataShare.setLabelingResults(outputColumns, { 0: done('Positive'), 1: done('Negative') })
    const requests = holdBatch()
    const first = instance()
    const second = instance()
    first.rangeStart.value = 2
    const running = first.api.runLabeling()
    expect(requests[0].tasks).toHaveLength(1)
    requests[0].progress(0, '{"sentiment":"Positive"}', null, { concurrency: 3 })
    requests[0].resolve({ finalConcurrency: 3 })
    await running
    await nextTick()
    expect(first.analysisMap.value).toEqual({ 0: done('Positive'), 1: done('Positive') })
    expect(second.analysisMap.value).toEqual(first.analysisMap.value)
  })

  it('批次异常结束时保留已完成行，并让两种模式看到相同结果', async () => {
    const requests = holdBatch()
    const first = instance()
    const second = instance()
    const running = first.api.runLabeling()
    requests[0].progress(0, '{"sentiment":"Positive"}', null, { concurrency: 3 })
    requests[0].reject(new Error('mock 批次中断'))
    await running
    await nextTick()
    expect(first.analysisMap.value[0]).toEqual(done('Positive'))
    expect(first.analysisMap.value[1].status).toBe('error')
    expect(second.analysisMap.value).toEqual(first.analysisMap.value)
  })

  it('批次运行中首次打开专家页只同步选列，不取消原批次', async () => {
    const requests = holdBatch()
    const first = instance()
    const running = first.api.runLabeling()
    const wrapper = mountExpert()
    await nextTick()
    expect(requests[0].signal.aborted).toBe(false)
    expect(first.api.isLabeling.value).toBe(true)
    const startButton = wrapper.findAll('button').find(button => button.text().includes('打标中'))
    expect(startButton).toBeDefined()
    expect(startButton.attributes('disabled')).toBeDefined()
    requests[0].progress(0, '{"sentiment":"Positive"}', null, { concurrency: 3 })
    requests[0].progress(1, '{"sentiment":"Negative"}', null, { concurrency: 3 })
    requests[0].resolve({ finalConcurrency: 3 })
    await running
    await nextTick()
    expect(wrapper.find('tbody').text()).toContain('Positive')
    expect(wrapper.find('tbody').text()).toContain('Negative')
  })
})

describe('跨页面上传顺序', () => {
  it.each([['旧文件先完成', ['A', 'B']], ['新文件先完成', ['B', 'A']]])('%s都保留最后发起的文件', async (_title, order) => {
    const pending = {}
    readFile.mockImplementation(file => new Promise(resolve => { pending[file.name[0]] = resolve }))
    const onFirstLoaded = vi.fn()
    const onSecondLoaded = vi.fn()
    const first = useFileUpload({ onFileLoaded: onFirstLoaded })
    const second = useFileUpload({ onFileLoaded: onSecondLoaded })
    const firstUpload = first.handleFile(new File(['a'], 'A.csv'))
    const secondUpload = second.handleFile(new File(['b'], 'B.csv'))
    for (const id of order) {
      pending[id]({ headers: ['来源'], rows: [[id]], sheetNames: [], currentSheet: '' })
      await flushPromises()
      if (id === 'A' && order[0] === 'A') expect(dataShare.sourceName).toBe('原数据.csv')
    }
    await Promise.all([firstUpload, secondUpload])
    expect(dataShare.sourceName).toBe('B.csv')
    expect(dataShare.rows).toEqual([['B']])
    expect(useImportIntentStore().pendingFileMeta.name).toBe('B.csv')
    expect(onFirstLoaded).not.toHaveBeenCalled()
    expect(onSecondLoaded).toHaveBeenCalledTimes(1)
    expect([first.isUploading.value, second.isUploading.value]).toEqual([false, false])
  })
})

describe('专家页删除已加工数据', () => {
  it('通过实际删除按钮删掉第一行，保留剩余行的标签和共享导出数据', async () => {
    dataShare.setLabelingResults(outputColumns, { 0: done('Positive'), 1: done('Negative') })
    const wrapper = mountExpert()
    await nextTick()
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.find('tbody').text()).toContain('Positive')
    expect(wrapper.find('tbody').text()).toContain('Negative')
    await wrapper.find('tbody tr button').trigger('click')
    await nextTick()
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.find('tbody').text()).toContain('不喜欢')
    expect(wrapper.find('tbody').text()).toContain('Negative')
    expect(dataShare.rows).toEqual([['不喜欢', '北京']])
    expect(dataShare.labelingResults.analysisMap).toEqual({ 0: done('Negative') })
    expect(callAIBatch).not.toHaveBeenCalled()
  })
})
