import { beforeEach, describe, expect, it, vi } from 'vitest'
import { planPipeline } from '../services/pipelinePlanner'
import { runCleaningPipeline } from '../services/cleaningRules'
import { callAI } from '../services/ai'

vi.mock('../services/ai', () => ({ callAI: vi.fn() }))

const input = {
  goal: '按类别分析销售额', headers: ['内容', '类别', '销售额'],
  rows: [['正常评价', '华南', 10], ['普通评价', '华北', 20]], coreColumnIdx: 0, workModel: 'test-model'
}
async function plan(task, response, overrides = {}) {
  callAI.mockResolvedValue(JSON.stringify(response))
  return (await planPipeline({ ...input, ...overrides, tasks: { [task]: true } }))[task]
}

beforeEach(() => vi.clearAllMocks())

describe('四模块规划契约', () => {
  it('清洗规划保留 config、enabled、policy，实际管道可以执行', async () => {
    const result = await plan('clean', {
      strategy: 'custom',
      customFilters: [{ name: '过滤华北', type: 'columnEquals', config: { column: 1, values: ['华北'] }, policy: 'delete' }]
    })
    expect(result.aiRulesConfig.customFilters[0]).toMatchObject({
      name: '过滤华北', enabled: true, type: 'columnEquals', config: { column: 1, values: ['华北'] }, policy: 'delete'
    })
    expect(result.aiRulesConfig.customFilters[0].id).toBeTruthy()
    expect(runCleaningPipeline(input.rows, input.headers, result.sourceCol, result.aiRulesConfig).map(r => r.decision))
      .toEqual(['keep', 'delete'])
  })

  it('不支持的自定义筛选不能返回看似可执行的方案', async () => {
    expect(await plan('clean', { customFilters: [{ type: 'unknown', config: {} }] })).toBeNull()
  })

  it.each([
    [[{ columnIndex: 2, reason: '数值' }, { columnIndex: 1, reason: '分组' }]],
    [[2, 1]],
    [{ columnIndex: [2, 1] }]
  ])('摘要关注列兼容支持的响应结构 %j', async focusColumns => {
    const result = await plan('summary', { analysisTheme: '销售分析', focusColumns })
    expect(result).toEqual({ theme: '销售分析', focusColumns: [2, 1] })
  })

  it('摘要关注列去重并排除越界项', async () => {
    expect((await plan('summary', { focusColumns: [2, 2, -1, 99, null] })).focusColumns).toEqual([2])
  })

  it('加工方案使用模型选择的有效列，不丢弃补充列', async () => {
    const result = await plan('process', { inputColumns: ['销售额', '内容'], outputColumns: [{ key: 'note', name: '结论', type: 'text' }] })
    expect(result.inputColumns).toEqual([2, 0])
  })

  it('加工方案全部引用不存在的列时返回 null', async () => {
    expect(await plan('process', { inputColumns: ['不存在'], outputColumns: [{ key: 'note', name: '结论', type: 'text' }] })).toBeNull()
  })

  it('加工方案选项无效时不返回可用计划', async () => {
    expect(await plan('process', { outputColumns: [{ key: 's', name: '分类', type: 'enum', options: [] }] })).toBeNull()
  })

  it.each([null, undefined, '', -1, 99])('非 COUNT 聚合缺少合法值列 %j 时不默认使用首列', async valueColIdx => {
    expect(await plan('aggregate', { groupColIdx: 1, valueColIdx, op: 'sum' })).toBeNull()
  })

  it('COUNT 可以没有值列，null 分组列不能变成首列', async () => {
    expect(await plan('aggregate', { groupColIdx: 1, valueColIdx: null, op: 'count' })).toMatchObject({ groupColIdx: 1, valueColIdx: null, op: 'count' })
    expect(await plan('aggregate', { groupColIdx: null, valueColIdx: 2, op: 'sum' })).toBeNull()
  })

  it('数值聚合不接受完全没有数值的值列', async () => {
    expect(await plan('aggregate', { groupColIdx: 1, valueColIdx: 0, op: 'sum' })).toBeNull()
  })

  it('单个模型调用失败不影响其他所选模块', async () => {
    callAI.mockImplementation((prompt, systemPrompt) => systemPrompt.includes('清洗专家')
      ? Promise.reject(new Error('网络错误'))
      : Promise.resolve(JSON.stringify({ analysisTheme: '销售', focusColumns: [2] })))
    const result = await planPipeline({ ...input, tasks: { clean: true, summary: true } })
    expect(result.clean).toBeNull()
    expect(result.summary).toEqual({ theme: '销售', focusColumns: [2] })
    expect(result.process).toBeNull()
  })

  it('所有任务调用透传同一个取消信号', async () => {
    const controller = new AbortController()
    callAI.mockResolvedValue('{}')
    await planPipeline({ ...input, tasks: { clean: true, process: true, summary: true, aggregate: true }, signal: controller.signal })
    expect(callAI).toHaveBeenCalledTimes(4)
    for (const call of callAI.mock.calls) expect(call[3]).toEqual({ signal: controller.signal })
  })

  it('数值零的列精确匹配规则确实命中零', async () => {
    const result = await plan('clean', { customFilters: [{ name: '零值', type: 'columnEquals', config: { column: 2, value: 0 } }] })
    expect(runCleaningPipeline([['正常内容', '类别', 0]], input.headers, 0, result.aiRulesConfig)[0].decision).toBe('delete')
  })

  it('缺少匹配条件的模型规则不能隐式匹配空值', async () => {
    expect(await plan('clean', { customFilters: [{ type: 'columnEquals', config: { column: 1 } }] })).toBeNull()
  })

  it.each([
    { duplicate: { minCount: 0 } },
    { tooShort: { minLength: -1 } },
    { duplicate: { enable: 'yes' } }
  ])('内置规则参数无效时不能返回可执行方案 %j', async paramOverrides => {
    expect(await plan('clean', { builtinConfig: { paramOverrides } })).toBeNull()
  })

  it('合法规则通过统一校验后保留 AI 分析说明', async () => {
    const result = await plan('clean', { analysis: '只删除出现三次以上的重复内容', builtinConfig: { paramOverrides: { duplicate: { minCount: 3 } } } })
    expect(result.aiRulesConfig.duplicate.minCount).toBe(3)
    expect(result.aiRulesConfig._aiSummary).toBe('只删除出现三次以上的重复内容')
  })
})
