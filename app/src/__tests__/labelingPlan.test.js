import { describe, it, expect } from 'vitest'
import { normalizeLabelingPlan, validateLabelingPlan, normalizeRowResult } from '../services/labelingPlan'

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
})

describe('normalizeRowResult', () => {
  const cols = [
    { key: 'sentiment', name: '情感', type: 'enum', options: ['正', '负'] },
    { key: 'tags', name: '标签', type: 'multi_enum' },
    { key: 'is_valid', name: '有效', type: 'boolean' },
    { key: 'score', name: '得分', type: 'number' },
    { key: 'note', name: '备注', type: 'text' }
  ]

  it('enum 非法值回退到首个选项', () => {
    expect(normalizeRowResult({ sentiment: '不存在' }, cols).sentiment).toBe('正')
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
  })
})
