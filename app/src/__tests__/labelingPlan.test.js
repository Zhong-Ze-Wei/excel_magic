import { describe, it, expect } from 'vitest'
import { normalizeLabelingPlan, validateLabelingPlan, normalizeRowResult, normalizeInputColumns } from '../services/labelingPlan'

describe('normalizeLabelingPlan', () => {
  it('规范化基本字段', () => {
    const raw = {
      taskName: '任务',
      goal: '目标',
      inputColumns: ['A'],
      outputColumns: [{ key: 'sentiment', name: '情感', type: 'enum', options: ['正', '负'] }]
    }
    const plan = normalizeLabelingPlan(raw)
    expect(plan.taskName).toBe('任务')
    expect(plan.outputColumns).toHaveLength(1)
    expect(plan.outputColumns[0].key).toBe('sentiment')
  })

  it('缺失 outputColumns 或非对象返回 null', () => {
    expect(normalizeLabelingPlan(null)).toBeNull()
    expect(normalizeLabelingPlan('not object')).toBeNull()
    expect(normalizeLabelingPlan({ goal: 'x' })).toBeNull()
    expect(normalizeLabelingPlan({ outputColumns: [] })).toBeNull()
  })

  it('key 中的空格转下划线', () => {
    const plan = normalizeLabelingPlan({ outputColumns: [{ key: 'my key', name: '列' }] })
    expect(plan.outputColumns[0].key).toBe('my_key')
  })

  it('缺 key 时从 name 派生', () => {
    const plan = normalizeLabelingPlan({ outputColumns: [{ name: '情感标签', type: 'enum' }] })
    expect(plan.outputColumns[0].key).toBe('情感标签')
  })

  it('非法 type 回退 text，缺 key 且缺 name 的列被过滤', () => {
    const raw = {
      outputColumns: [
        { key: 'a', name: 'A', type: 'invalid_type' },
        { type: 'text' }
      ]
    }
    const plan = normalizeLabelingPlan(raw)
    expect(plan.outputColumns).toHaveLength(1)
    expect(plan.outputColumns[0].type).toBe('text')
  })

  it('畸形列对象被过滤，全部无效时返回 null', () => {
    expect(normalizeLabelingPlan({ outputColumns: [null, 42, [], 'text'] })).toBeNull()
    expect(normalizeLabelingPlan({ outputColumns: [null, { key: 'a', name: '有效列', type: 'text' }] }).outputColumns).toHaveLength(1)
  })
})

describe('validateLabelingPlan', () => {
  it('空 plan 返回错误', () => {
    expect(validateLabelingPlan(null)).toBe('请至少定义一个输出列')
    expect(validateLabelingPlan({ outputColumns: [] })).toBe('请至少定义一个输出列')
  })

  it('key 重复返回错误', () => {
    const plan = { outputColumns: [{ key: 'a', name: 'A' }, { key: 'a', name: 'B' }] }
    expect(validateLabelingPlan(plan)).toContain('重复')
  })

  it('enum 缺 options 返回错误', () => {
    const plan = { outputColumns: [{ key: 'a', name: 'A', type: 'enum', options: [] }] }
    expect(validateLabelingPlan(plan)).toContain('未设置选项')
  })

  it('合法 plan 返回 null', () => {
    const plan = { outputColumns: [{ key: 'a', name: 'A', type: 'text' }] }
    expect(validateLabelingPlan(plan)).toBeNull()
  })

  it('畸形方案和空层级选项不会通过校验', () => {
    expect(validateLabelingPlan({})).toBeTruthy()
    expect(validateLabelingPlan({ outputColumns: [null] })).toBeTruthy()
    expect(validateLabelingPlan({ outputColumns: [{ key: 'a', name: 'A', type: 'enum', options: '正面' }] })).toBeTruthy()
    expect(validateLabelingPlan({ outputColumns: [{ key: 'a', name: 'A', type: 'hierarchical_enum', options: {} }] })).toBeTruthy()
  })
})

describe('normalizeRowResult', () => {
  const cols = [
    { key: 'sentiment', name: '情感', type: 'enum', options: ['正', '负'], required: false },
    { key: 'tags', name: '标签', type: 'multi_enum', options: ['a', 'b'], required: false },
    { key: 'is_valid', name: '有效', type: 'boolean', required: false },
    { key: 'score', name: '得分', type: 'number', required: false },
    { key: 'note', name: '备注', type: 'text', required: false }
  ]

  it('可选 enum 非法值标记为空，不猜测首个选项', () => {
    expect(normalizeRowResult({ sentiment: '不存在' }, cols).sentiment).toBeNull()
    expect(normalizeRowResult({ sentiment: '负' }, cols).sentiment).toBe('负')
  })

  it('multi_enum 标量转数组', () => {
    expect(normalizeRowResult({ tags: 'a' }, cols).tags).toEqual(['a'])
    expect(normalizeRowResult({ tags: ['a', 'b'] }, cols).tags).toEqual(['a', 'b'])
  })

  it('boolean 非布尔值转 null', () => {
    expect(normalizeRowResult({ is_valid: true }, cols).is_valid).toBe(true)
    expect(normalizeRowResult({ is_valid: false }, cols).is_valid).toBe(false)
    expect(normalizeRowResult({ is_valid: 'yes' }, cols).is_valid).toBeNull()
  })

  it('number 字符串转数字', () => {
    expect(normalizeRowResult({ score: '3.5' }, cols).score).toBe(3.5)
    expect(normalizeRowResult({ score: '0' }, cols).score).toBe(0)
    expect(normalizeRowResult({ score: 0 }, cols).score).toBe(0)
    expect(normalizeRowResult({ score: 'Infinity' }, cols).score).toBeNull()
    expect(normalizeRowResult({ score: false }, cols).score).toBeNull()
  })

  it('text 强制转字符串', () => {
    expect(normalizeRowResult({ note: 123 }, cols).note).toBe('123')
  })

  it('缺字段返回 null 值', () => {
    expect(normalizeRowResult({}, cols).sentiment).toBeNull()
  })

  it('非对象返回 null', () => {
    expect(normalizeRowResult(null, cols)).toBeNull()
    expect(normalizeRowResult('x', cols)).toBeNull()
    expect(normalizeRowResult([], cols)).toBeNull()
  })

  it.each([
    ['enum', { options: ['正面', '负面'] }, '不存在'],
    ['multi_enum', { options: ['a', 'b'] }, ['a', '不存在']],
    ['hierarchical_enum', { options: { 商品: ['质量'] } }, '未知 > 质量'],
    ['boolean', {}, 'false'],
    ['number', {}, 'Infinity'],
    ['text', {}, { text: '错误格式' }]
  ])('必填 %s 不符合约束时整行失败，可选字段为空', (type, extra, value) => {
    const required = [{ key: 'value', name: '字段', type, ...extra }]
    expect(normalizeRowResult({ value }, required)).toBeNull()
    expect(normalizeRowResult({ value }, [{ ...required[0], required: false }])).toEqual({ value: null })
  })

  it('必填字段缺失或为 null 时不接受部分成功', () => {
    const required = [{ key: 'a', name: 'A', type: 'text' }, { key: 'b', name: 'B', type: 'number' }]
    expect(normalizeRowResult({ a: '完成' }, required)).toBeNull()
    expect(normalizeRowResult({ a: '完成', b: null }, required)).toBeNull()
    expect(normalizeRowResult({ a: '完成', b: 0 }, required)).toEqual({ a: '完成', b: 0 })
  })

  it('层级结果验证真实父子关系并规范化空白', () => {
    const col = [{ key: 'category', name: '分类', type: 'hierarchical_enum', options: { 商品: ['质量', '价格'], 服务: ['态度'] } }]
    expect(normalizeRowResult({ category: '商品>质量' }, col)).toEqual({ category: '商品 > 质量' })
    expect(normalizeRowResult({ category: '商品 > 态度' }, col)).toBeNull()
  })

  it('对象特殊字段名能作为普通字段保存', () => {
    const parsed = JSON.parse('{"__proto__":"普通文本"}')
    const result = normalizeRowResult(parsed, [{ key: '__proto__', name: '普通字段', type: 'text' }])
    expect(Object.keys(result)).toEqual(['__proto__'])
    expect(result.__proto__).toBe('普通文本')
  })
})

describe('normalizeInputColumns', () => {
  it('列名和索引引用统一为去重合法索引，数字列名优先按名称匹配', () => {
    expect(normalizeInputColumns(['内容', 0, '金额', '2', 99, null, '不存在'], ['编号', '内容', '金额']))
      .toEqual([1, 0, 2])
    expect(normalizeInputColumns(['2'], ['2', '内容', '金额'])).toEqual([0])
  })
})
