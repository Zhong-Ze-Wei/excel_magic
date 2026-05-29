import { describe, it, expect } from 'vitest'
import { parseRobustJSON } from '../services/jsonParser'

describe('parseRobustJSON', () => {
  it('解析标准 JSON', () => {
    expect(parseRobustJSON('{"a":1}')).toEqual({ a: 1 })
  })

  it('解析 markdown 代码块包裹的 JSON', () => {
    const input = '```json\n{"a":1}\n```'
    expect(parseRobustJSON(input)).toEqual({ a: 1 })
  })

  it('解析前后有多余文本的 JSON', () => {
    const input = '这是分析结果：\n{"a":1}\n以上是结果'
    expect(parseRobustJSON(input)).toEqual({ a: 1 })
  })

  it('解析数组 JSON', () => {
    expect(parseRobustJSON('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('null/空输入返回 null', () => {
    expect(parseRobustJSON(null)).toBe(null)
    expect(parseRobustJSON('')).toBe(null)
  })

  it('非法 JSON 返回 null', () => {
    expect(parseRobustJSON('not json at all')).toBe(null)
  })
})
