import { describe, it, expect } from 'vitest'
import { groupAggregate, formatAggregateValue, aggregateResultToTable } from '../services/groupAggregate'

describe('groupAggregate', () => {
  const rows = [
    ['A', 10],
    ['B', 20],
    ['A', 30],
    ['C', 5]
  ]

  it('SUM 分组求和', () => {
    const { groups, meta } = groupAggregate(rows, 0, 1, 'sum')
    const map = Object.fromEntries(groups.map(g => [g.group, g.value]))
    expect(map.A).toBe(40)
    expect(map.B).toBe(20)
    expect(map.C).toBe(5)
    expect(meta.totalGroups).toBe(3)
    expect(meta.totalRows).toBe(4)
  })

  it('AVG 分组求均值', () => {
    const { groups } = groupAggregate(rows, 0, 1, 'avg')
    const map = Object.fromEntries(groups.map(g => [g.group, g.value]))
    expect(map.A).toBe(20)
    expect(map.B).toBe(20)
  })

  it('COUNT 分组计数（不依赖值列数值）', () => {
    const { groups } = groupAggregate([['A', 'x'], ['A', 'y'], ['B', 'z']], 0, 1, 'count')
    const map = Object.fromEntries(groups.map(g => [g.group, g.value]))
    expect(map.A).toBe(2)
    expect(map.B).toBe(1)
  })

  it('MIN/MAX', () => {
    const minMap = Object.fromEntries(groupAggregate(rows, 0, 1, 'min').groups.map(g => [g.group, g.value]))
    expect(minMap.A).toBe(10)
    const maxMap = Object.fromEntries(groupAggregate(rows, 0, 1, 'max').groups.map(g => [g.group, g.value]))
    expect(maxMap.A).toBe(30)
  })

  it('非数值按 0 处理', () => {
    const { groups } = groupAggregate([['A', 'not-a-number']], 0, 1, 'sum')
    expect(groups[0].value).toBe(0)
  })

  it('空分组键记为 (空)', () => {
    const { groups } = groupAggregate([['', 1], [null, 2]], 0, 1, 'sum')
    expect(groups[0].group).toBe('(空)')
    expect(groups[0].value).toBe(3)
  })

  it('按聚合值降序排序', () => {
    const { groups } = groupAggregate(rows, 0, 1, 'sum')
    expect(groups.map(g => g.value)).toEqual([40, 20, 5])
  })

  it('空行返回空 groups', () => {
    const { groups, meta } = groupAggregate([], 0, 1, 'sum')
    expect(groups).toEqual([])
    expect(meta.totalGroups).toBe(0)
  })
})

describe('formatAggregateValue', () => {
  it('count 取整', () => {
    expect(formatAggregateValue(3.7, 'count')).toBe('4')
  })
  it('整数加千分位', () => {
    expect(formatAggregateValue(1234, 'sum')).toBe('1,234')
  })
})

describe('aggregateResultToTable', () => {
  it('生成表头与数据行', () => {
    const { headers, rows } = aggregateResultToTable(
      [{ group: 'A', value: 40, count: 2 }], '分组', '值(SUM)'
    )
    expect(headers).toEqual(['分组', '值(SUM)', '数据行数'])
    expect(rows).toEqual([['A', 40, 2]])
  })
})
