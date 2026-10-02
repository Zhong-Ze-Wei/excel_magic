import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, ref, computed, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useDataShareStore } from '../stores/dataShare'
import { useImportIntentStore } from '../stores/importIntent'
import { useSettingsStore } from '../stores/settings'
import { useLabeling } from '../composables/useLabeling'
import { useFileUpload } from '../composables/useFileUpload'
import ImportIntentModal from '../components/ImportIntentModal.vue'
import { callAIBatch } from '../services/ai'
import { readFile } from '../services/excel'
import { planPipeline } from '../services/pipelinePlanner'
import { analyzeTableIntent } from '../services/intentAnalysis'

vi.mock('../services/ai', () => ({ callAI: vi.fn(), callAIBatch: vi.fn() }))
vi.mock('../services/excel', () => ({ readFile: vi.fn() }))
vi.mock('../services/pipelinePlanner', () => ({ planPipeline: vi.fn() }))
vi.mock('../services/intentAnalysis', () => ({
  buildTableSnapshot: () => ({ profiles: [] }), analyzeTableIntent: vi.fn()
}))

const scopes = []
const wrappers = []
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function inScope(callback) {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(callback)
}
function labeling() {
  const store = useDataShareStore()
  store.setSharedData(['内容'], [['测试内容']])
  store.labelingPlan = { taskName: '标签', goal: '分类', inputColumns: [0], outputColumns: [{ key: 'kind', name: '类型', type: 'enum', options: ['A'], required: true }], compiledPrompt: '', promptDirty: false }
  const analysisMap = ref({})
  const state = inScope(() => useLabeling({
    headers: computed(() => store.headers), rows: computed(() => store.rows), labelingPlan: computed(() => store.labelingPlan),
    selectedInputColumns: ref([]), rangeStart: ref(1), rangeEnd: ref(1), analysisMap
  }))
  return { ...state, analysisMap, store }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  setActivePinia(createPinia())
  useSettingsStore().saveApiKey('aiping', 'test-key')
  useSettingsStore().autoIntentAnalysis = false
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  scopes.splice(0).forEach(scope => scope.stop())
})

describe('文件导入的先后顺序与同名重传', () => {
  it('较早发起但较晚读完的文件不会覆盖最新上传', async () => {
    const first = deferred(), second = deferred()
    readFile.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const upload = inScope(() => useFileUpload())
    const a = upload.handleFile({ name: 'a.csv' })
    const b = upload.handleFile({ name: 'b.csv' })
    second.resolve({ headers: ['B'], rows: [['b']], sheetNames: [], currentSheet: '' })
    await b
    first.resolve({ headers: ['A'], rows: [['a']], sheetNames: [], currentSheet: '' })
    await a
    expect(useDataShareStore().sourceName).toBe('b.csv')
    expect(useImportIntentStore().pendingFileMeta.name).toBe('b.csv')
    expect(upload.isUploading.value).toBe(false)
  })
  it('同名文件重新导入也清空旧目标、方案与结果', async () => {
    const store = useDataShareStore(), intent = useImportIntentStore()
    store.setSharedData(['A'], [['旧']])
    intent.submit({ coreColumnIdx: 0, tasks: { process: true }, note: '旧目标', pipelinePlan: { process: {} }, suggestions: ['旧'] })
    store.setLabelingResults([], {})
    readFile.mockResolvedValue({ headers: ['A'], rows: [['新']], sheetNames: [], currentSheet: '' })
    await inScope(() => useFileUpload()).handleFile({ name: 'same.csv' })
    expect(intent.pipelinePlan).toBeNull()
    expect(intent.note).toBe('')
    expect(store.labelingResults).toBeNull()
    expect(intent.showModal).toBe(true)
  })
  it('读文件过程中已经切换到其他数据时不再覆盖', async () => {
    const pending = deferred()
    readFile.mockReturnValue(pending.promise)
    const upload = inScope(() => useFileUpload())
    const result = upload.handleFile({ name: 'slow.csv' })
    useDataShareStore().setSharedData(['示例'], [['已切换']])
    pending.resolve({ headers: ['旧文件'], rows: [['旧数据']] })
    await result
    expect(useDataShareStore().headers).toEqual(['示例'])
  })
})

describe('逐行加工生命周期', () => {
  it('预设的整数参考列能执行并提交有效结果', async () => {
    callAIBatch.mockImplementation(async (tasks, progress) => {
      expect(JSON.parse(tasks[0].content)).toEqual({ 内容: '测试内容' })
      progress(0, '{"kind":"A"}', null, { concurrency: 3 })
      return { finalConcurrency: 3 }
    })
    const state = labeling()
    await state.runLabeling()
    expect(state.analysisMap.value[0].status).toBe('done')
    expect(state.store.labelingResults.analysisMap[0].values.kind).toBe('A')
    expect(state.isLabeling.value).toBe(false)
  })
  it('未知枚举值不能作为成功结果使用', async () => {
    callAIBatch.mockImplementation(async (tasks, progress) => {
      progress(0, '{"kind":"未知"}', null, { concurrency: 3 })
      return { finalConcurrency: 3 }
    })
    const state = labeling()
    await state.runLabeling()
    expect(state.stats.value.error).toBe(1)
    expect(state.store.labelingResults).toBeNull()
  })
  it('批次级异常也释放运行状态并标记未完成行', async () => {
    callAIBatch.mockRejectedValue(new Error('网络断开'))
    const state = labeling()
    await state.runLabeling()
    expect(state.isLabeling.value).toBe(false)
    expect(state.analysisMap.value[0]).toMatchObject({ status: 'error', errorMessage: '网络断开' })
  })
  it('换数据后旧批次回调不污染新数据，并取消网络信号', async () => {
    const pending = deferred()
    let progress, signal
    callAIBatch.mockImplementation((tasks, callback, concurrency, model, options) => {
      progress = callback; signal = options.signal; return pending.promise
    })
    const state = labeling()
    const result = state.runLabeling()
    state.store.setSharedData(['新表'], [['新值']])
    expect(signal.aborted).toBe(true)
    progress(0, '{"kind":"A"}', null, { concurrency: 3 })
    pending.resolve({ finalConcurrency: 3 })
    await result
    expect(state.analysisMap.value).toEqual({})
    expect(state.store.labelingResults).toBeNull()
    expect(state.isLabeling.value).toBe(false)
  })
  it('修改方案清除已有结果，防止把旧结果套到新列上', async () => {
    const state = labeling()
    state.store.setLabelingResults(state.store.labelingPlan.outputColumns, { 0: { status: 'done', values: { kind: 'A' } } })
    await nextTick()
    state.store.labelingPlan.outputColumns[0].key = 'new_kind'
    expect(state.analysisMap.value).toEqual({})
    expect(state.store.labelingResults).toBeNull()
  })
  it('切换模式时首次初始化参考列保留共享结果，用户随后改列才清除', async () => {
    const state = labeling()
    state.store.setSharedData(['内容', '其它'], [['内容', '其它']], '', false, { preserveIntent: true })
    state.store.setLabelingResults(state.store.labelingPlan.outputColumns, { 0: { status: 'done', values: { kind: 'A' } } })
    const selection = ref([]), map = ref({})
    inScope(() => useLabeling({ headers: computed(() => state.store.headers), rows: computed(() => state.store.rows), labelingPlan: computed(() => state.store.labelingPlan), selectedInputColumns: selection, rangeStart: ref(1), rangeEnd: ref(1), analysisMap: map }))
    selection.value = [0]
    await nextTick()
    expect(state.store.labelingResults).not.toBeNull()
    expect(map.value[0].values.kind).toBe('A')
    selection.value = [1]
    expect(state.store.labelingResults).toBeNull()
  })
})

describe('意图确认与方案的一致性', () => {
  function openModal() {
    const store = useDataShareStore(), intent = useImportIntentStore()
    store.setSharedData(['内容'], [['待分析']])
    intent.submit({ coreColumnIdx: 0, tasks: { clean: false, process: true, summary: false, aggregate: false }, note: '原目标', suggestions: [], pipelinePlan: { process: { taskName: '旧方案', outputColumns: [{ name: '旧列', type: 'text' }] } } })
    const wrapper = mount(ImportIntentModal, { global: { stubs: { DataOverview: true } } })
    wrappers.push(wrapper)
    intent.open({ headers: ['内容'], rowCount: 1, colCount: 1 })
    return { wrapper, state: wrapper.vm.$.setupState, store, intent }
  }
  it('修改目标后旧预规划方案失效，确认不能缓存旧方案', async () => {
    const { state, intent } = openModal()
    state.form.goal = '新的目标'
    expect(state.pipelinePlan).toBeNull()
    state.onSubmit()
    expect(intent.note).toBe('新的目标')
    expect(intent.pipelinePlan).toBeNull()
  })
  it('修改任务或核心列立即取消正在生成的方案', async () => {
    const pending = deferred()
    let signal
    planPipeline.mockImplementation(options => { signal = options.signal; return pending.promise })
    const { state } = openModal()
    const run = state.runPipelinePlan()
    state.form.tasks.summary = true
    expect(signal.aborted).toBe(true)
    pending.resolve({ process: { taskName: '过期' } })
    await run
    expect(state.pipelinePlan).toBeNull()
    expect(state.planningPipeline).toBe(false)
  })
  it('关闭弹窗后候选结果不会写回或覆盖下次打开的表单', async () => {
    const pending = deferred()
    analyzeTableIntent.mockReturnValue(pending.promise)
    const { state, intent } = openModal()
    const run = state.runAnalysis()
    intent.close()
    pending.resolve({ suggestions: [{ goal: '迟到目标', coreColumnIdx: 0, tasks: { process: true } }] })
    await run
    expect(state.form.goal).toBe('原目标')
    expect(state.analyzing).toBe(false)
  })
  it('等待候选时输入的目标保留，AI 不覆盖手动输入', async () => {
    const pending = deferred()
    analyzeTableIntent.mockReturnValue(pending.promise)
    const { state } = openModal()
    const run = state.runAnalysis()
    state.form.goal = '手动输入'
    pending.resolve({ suggestions: [{ goal: '模型建议', coreColumnIdx: 0, tasks: { process: true } }] })
    await run
    await flushPromises()
    expect(state.form.goal).toBe('手动输入')
    expect(state.suggestions[0].goal).toBe('模型建议')
  })
})
