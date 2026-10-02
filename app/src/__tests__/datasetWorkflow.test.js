import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { defineComponent, effectScope, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useDataShareStore } from '../stores/dataShare'
import { useImportIntentStore } from '../stores/importIntent'
import { useDatasetTask } from '../composables/useDatasetTask'
import { useGlobalDataSync } from '../composables/useGlobalDataSync'
import { readSheet } from '../services/excel'

vi.mock('../services/excel', () => ({ readSheet: vi.fn() }))

let pinia
const scopes = [], wrappers = []
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
function datasetTask() {
  const scope = effectScope()
  scopes.push(scope)
  return { scope, task: scope.run(() => useDatasetTask()) }
}
function loadOriginal() {
  const store = useDataShareStore()
  store.setSharedData(['内容', '类别'], [['原始正文', 'A']], '原始.xlsx', false, {
    sheetNames: ['A', 'B', 'C'], currentSheet: 'A', file: new File(['original'], '原始.xlsx')
  })
  store.setCoreColumn(1)
  store.setIntentNote('清洗后加工')
  store.labelingPlan = { taskName: '原任务', goal: '原目标', inputColumns: [0], outputColumns: [{ key: 'label', name: '标签', type: 'text' }] }
  store.setLabelingResults(store.labelingPlan.outputColumns, { 0: { status: 'done', values: { label: '旧结果' } } })
  useImportIntentStore().submit({ coreColumnIdx: 1, tasks: { clean: true, process: true }, note: '原目标', suggestions: [{ goal: '旧建议' }], pipelinePlan: { clean: { sourceCol: 1 } } })
  return store
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  vi.clearAllMocks()
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  scopes.splice(0).forEach(scope => scope.stop())
  disposePinia(pinia)
})

describe('数据集身份与结果归属', () => {
  it.each(['新文件.xlsx', '原始.xlsx'])('载入 %s 清掉旧标签、意图、方案和工作簿元信息', name => {
    const store = loadOriginal()
    const version = store.datasetVersion
    store.setSharedData(['新列'], [['新数据']], name)
    expect(store.datasetVersion).toBe(version + 1)
    expect(store.headers).toEqual(['新列'])
    expect(store.rows).toEqual([['新数据']])
    expect(store.labelingResults).toBeNull()
    expect(store.intentNote).toBe('')
    expect(store.labelingPlan.outputColumns).toEqual([])
    expect(store.coreColumn).toBe(0)
    expect([store.file, store.currentSheet, store.sheetNames]).toEqual([null, '', []])
    const intent = useImportIntentStore()
    expect([intent.note, intent.suggestions, intent.pipelinePlan, intent.confirmedAt]).toEqual(['', null, null, null])
  })

  it('清洗或加工转换可显式保留意图，同时使旧标签和旧工作簿失效', () => {
    const store = loadOriginal()
    const previous = store.datasetVersion
    store.setSharedData(['内容', '类别'], [['变换后的正文', 'A']], '处理后.xlsx', false, { preserveIntent: true })
    expect(store.datasetVersion).toBe(previous + 1)
    expect(store.intentNote).toBe('清洗后加工')
    expect(store.labelingPlan.taskName).toBe('原任务')
    expect(useImportIntentStore().note).toBe('原目标')
    expect(store.coreColumn).toBe(1)
    expect(store.labelingResults).toBeNull()
    expect(store.file).toBeNull()
    expect(store.sheetNames).toEqual([])
  })

  it('旧版本结果不写入新数据集，当前结果保存后不受调用方修改影响', () => {
    const store = loadOriginal()
    const previous = store.datasetVersion
    store.setSharedData(['新列'], [['新数据']], '新文件.xlsx')
    const columns = [{ key: 'label', name: '标签', type: 'text' }]
    const result = { 0: { status: 'done', values: { label: '新结果' } } }
    expect(store.setLabelingResults(columns, result, previous)).toBe(false)
    expect(store.labelingResults).toBeNull()
    expect(store.setLabelingResults(columns, result, store.datasetVersion)).toBe(true)
    result[0].values.label = '外部后来修改'
    columns[0].name = '外部改名'
    expect(store.labelingResults.analysisMap[0].values.label).toBe('新结果')
    expect(store.labelingResults.outputColumns[0].name).toBe('标签')
  })

  it('清空数据递增版本并清空正在显示的意图', () => {
    const store = loadOriginal()
    const version = store.datasetVersion
    useImportIntentStore().open({ name: '原始.xlsx' })
    store.clearSharedData()
    expect(store.datasetVersion).toBe(version + 1)
    expect(store.rows).toEqual([])
    expect(store.labelingResults).toBeNull()
    expect(useImportIntentStore().showModal).toBe(false)
    expect(useImportIntentStore().pendingFileMeta).toBeNull()
  })
})

describe('多 Sheet 异步选择', () => {
  it('后选的 Sheet 先完成时，迟到的旧读取不会回写', async () => {
    const store = loadOriginal()
    const b = deferred(), c = deferred()
    readSheet.mockImplementation((file, name) => name === 'B' ? b.promise : c.promise)
    const first = store.setSheet('B')
    await vi.waitFor(() => expect(readSheet).toHaveBeenCalledTimes(1))
    const second = store.setSheet('C')
    await vi.waitFor(() => expect(readSheet).toHaveBeenCalledTimes(2))
    c.resolve({ headers: [2026], rows: [['C数据']] })
    await second
    expect(store.currentSheet).toBe('C')
    expect(store.headers).toEqual(['2026'])
    b.resolve({ headers: ['B'], rows: [['过时数据']] })
    await first
    expect(store.currentSheet).toBe('C')
    expect(store.rows).toEqual([['C数据']])
    expect(store.labelingResults).toBeNull()
    expect(store.intentNote).toBe('')
  })

  it('切表读取期间上传新文件，旧 Sheet 不覆盖新文件', async () => {
    const store = loadOriginal()
    const request = deferred()
    readSheet.mockReturnValue(request.promise)
    const pending = store.setSheet('B')
    await vi.waitFor(() => expect(readSheet).toHaveBeenCalledTimes(1))
    store.setSharedData(['新列'], [['新数据']], 'new.csv')
    const version = store.datasetVersion
    request.resolve({ headers: ['旧列'], rows: [['过时数据']] })
    await pending
    expect(store.rows).toEqual([['新数据']])
    expect(store.sourceName).toBe('new.csv')
    expect(store.datasetVersion).toBe(version)
  })

  it('正在读取其他 Sheet 时重新选当前 Sheet，迟到结果不改变最终选择', async () => {
    const store = loadOriginal()
    const request = deferred()
    readSheet.mockReturnValue(request.promise)
    const pending = store.setSheet('B')
    await vi.waitFor(() => expect(readSheet).toHaveBeenCalledTimes(1))
    await store.setSheet('A')
    request.resolve({ headers: ['B'], rows: [['已取消选择的数据']] })
    await pending
    expect(store.currentSheet).toBe('A')
    expect(store.rows).toEqual([['原始正文', 'A']])
  })

  it('清空后迟到的 Sheet 不复活旧数据，未知 Sheet 不读取', async () => {
    const store = loadOriginal()
    await store.setSheet('不存在')
    expect(readSheet).not.toHaveBeenCalled()
    const request = deferred()
    readSheet.mockReturnValue(request.promise)
    const pending = store.setSheet('B')
    await vi.waitFor(() => expect(readSheet).toHaveBeenCalledTimes(1))
    store.clearSharedData()
    request.resolve({ headers: ['旧列'], rows: [['旧数据']] })
    await pending
    expect(store.rows).toEqual([])
    expect(store.file).toBeNull()
  })
})

describe('数据集绑定的异步任务', () => {
  it('数据替换立即取消任务，即使服务忽略 abort，返回结果也被丢弃', async () => {
    const store = loadOriginal()
    const { task } = datasetTask()
    const request = deferred()
    let signal
    const pending = task.run(options => { signal = options.signal; return request.promise })
    expect(task.isRunning.value).toBe(true)
    store.setSharedData(['新'], [['新数据']], 'new.csv')
    expect(signal.aborted).toBe(true)
    expect(task.isRunning.value).toBe(false)
    request.resolve('旧结果')
    expect(await pending).toBeUndefined()
  })

  it('重复任务取消旧调用，旧调用完成不改变新任务 busy 状态', async () => {
    loadOriginal()
    const { task } = datasetTask()
    const old = deferred(), current = deferred()
    let firstSignal
    const first = task.run(({ signal }) => { firstSignal = signal; return old.promise })
    const second = task.run(() => current.promise)
    expect(firstSignal.aborted).toBe(true)
    old.resolve('旧结果')
    expect(await first).toBeUndefined()
    expect(task.isRunning.value).toBe(true)
    current.resolve('新结果')
    expect(await second).toBe('新结果')
    expect(task.isRunning.value).toBe(false)
  })

  it('真实失败释放 busy 并向调用方报告，取消后的失败被忽略', async () => {
    loadOriginal()
    const { task } = datasetTask()
    await expect(task.run(() => Promise.reject(new Error('网络失败')))).rejects.toThrow('网络失败')
    expect(task.isRunning.value).toBe(false)
    const request = deferred()
    const pending = task.run(() => request.promise)
    task.cancel()
    request.reject(new Error('取消后的迟到错误'))
    expect(await pending).toBeUndefined()
    expect(task.isRunning.value).toBe(false)
  })

  it('作用域销毁时中止请求并忽略后续结果', async () => {
    loadOriginal()
    const { scope, task } = datasetTask()
    const request = deferred()
    let signal
    const pending = task.run(options => { signal = options.signal; return request.promise })
    scope.stop()
    expect(signal.aborted).toBe(true)
    request.resolve('卸载后的结果')
    expect(await pending).toBeUndefined()
    expect(task.isRunning.value).toBe(false)
  })
})

describe('全局数据与页面副本同步', () => {
  function mountSync(onInit = vi.fn()) {
    let sync
    const Component = defineComponent({
      setup() { sync = useGlobalDataSync({ onInit }); return () => h('div') }
    })
    const wrapper = mount(Component, { global: { plugins: [pinia] } })
    wrappers.push(wrapper)
    return { sync, onInit }
  }

  it('挂载载入全局数据，同尺寸替换也更新内容和表头', async () => {
    const store = loadOriginal()
    const { sync, onInit } = mountSync()
    expect(sync.rows.value).toEqual([['原始正文', 'A']])
    store.setSharedData(['新内容', '新类别'], [['替换正文', 'B']], '第二份.xlsx')
    await nextTick()
    expect(sync.headers.value).toEqual(['新内容', '新类别'])
    expect(sync.rows.value).toEqual([['替换正文', 'B']])
    expect(onInit).toHaveBeenLastCalledWith(['新内容', '新类别'], [['替换正文', 'B']])
    sync.rows.value[0][0] = '页面草稿'
    expect(store.rows[0][0]).toBe('替换正文')
  })

  it('全局清空同步清空本地，另一份新数据仍可继续载入', async () => {
    const store = loadOriginal()
    const { sync } = mountSync()
    store.clearSharedData()
    await nextTick()
    expect(sync.hasData.value).toBe(false)
    expect(sync.headers.value).toEqual([])
    expect(sync.rows.value).toEqual([])
    store.setSharedData(['重新开始'], [['新的值']], 'new.csv')
    await nextTick()
    expect(sync.rows.value).toEqual([['新的值']])
  })
})
