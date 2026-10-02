import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { runCleaningPipeline } from '../services/cleaningRules'
import { computeColumnProfile, detectColumnType, stratifiedSample } from '../services/dataProfiler'
import { groupAggregate } from '../services/groupAggregate'
import { useCleaningPipeline } from '../composables/useCleaningPipeline'

describe('清洗结果一致性', () => {
  it('预览、全量统计和导出使用相同的全表去重判断', () => {
    const rows = ref([['重复文本'], ['重复文本'], ...Array.from({ length: 98 }, (_, i) => [`正常正文${i}`]), ['重复文本']])
    const getConfig = vi.fn(() => ({ duplicate: { enable: true, minCount: 3 } }))
    const task = useCleaningPipeline({ headers: ref(['内容']), rows, sourceCol: ref(0), getConfig, previewLimit: 100 })
    task.runPipeline()
    expect(getConfig).toHaveBeenCalledTimes(1)
    expect(task.cleanedRows.value).toHaveLength(100)
    expect(task.cleanedRows.value[1].decision).toBe('delete')
    expect(task.fullStats.value).toEqual({ keep: 99, delete: 2, suspect: 0 })
    expect(task.getCleanRows()).toHaveLength(99)
  })

  it.each(['__proto__', 'constructor', 'toString'])('特殊文本 %s 按普通文本去重', text => {
    const result = runCleaningPipeline([[text], [text], [text]], ['内容'], 0, { duplicate: { enable: true, minCount: 3 } })
    expect(result.map(r => r.decision)).toEqual(['keep', 'delete', 'delete'])
  })
})

describe('画像统计边界', () => {
  it('小数分桶名称不覆盖计数', () => {
    const profile = computeColumnProfile('比例', [0.1, 0.2, 0.3, 0.4, 0.5])
    expect(Object.keys(profile.distribution)).toHaveLength(5)
    expect(Object.values(profile.distribution).reduce((sum, n) => sum + n, 0)).toBe(5)
  })

  it('常量与相邻浮点数分布不丢失数据', () => {
    for (const values of [[5, 5, 5], [1, 1 + Number.EPSILON, 1 + Number.EPSILON * 2, 2]]) {
      const profile = computeColumnProfile('数值', values)
      expect(Object.values(profile.distribution).reduce((sum, n) => sum + n, 0)).toBe(values.length)
    }
  })

  it('非补零和混合分隔符日期按时间排序', () => {
    expect(computeColumnProfile('日期', ['2026-2-01', '2026/10/01', '2026-1-01']).dateRange)
      .toBe('2026-1-01 ~ 2026/10/01')
    expect(detectColumnType(['2026-13-40', '2026-02-30'])).not.toBe('date')
  })

  it.each(['__proto__', 'constructor', 'toString'])('枚举频率支持特殊键 %s', value => {
    const profile = computeColumnProfile('类别', Array(10).fill(value))
    expect(profile.valueDistribution[value]).toBe(100)
    expect(profile.topValues).toEqual([`${value}(100%)`])
  })

  it('高频词及抽样表头不会丢失对象特殊键', () => {
    const profile = computeColumnProfile('正文', ['__proto__ 其他词', 'toString 正常文本', 'toString 第二内容'])
    expect(profile.topWords).toContain('toString(2)')
    const sample = stratifiedSample(['__proto__', 'constructor'], [['内容', 0]])
    expect(Object.keys(sample[0])).toEqual(['__proto__', 'constructor'])
    expect(sample[0].__proto__).toBe('内容')
  })

  it('20 万行不同长文本画像不会因展开参数溢栈', () => {
    const values = Array.from({ length: 200000 }, (_, i) => `用于验证超大数组文本长度统计的完整而不同的正常文本内容编号${i}`)
    const profile = computeColumnProfile('正文', values)
    expect(profile.type).toBe('text')
    expect(profile.nonNullCount).toBe(200000)
    expect(profile.minLength).toBe(values[0].length)
    expect(profile.maxLength).toBe(values.at(-1).length)
  })

  it('数值画像排除 Infinity 且有限大数均值不溢出', () => {
    expect(detectColumnType(['Infinity', '-Infinity'])).not.toBe('number')
    const profile = computeColumnProfile('数值', [1e308, 1e308])
    expect(profile.mean).toBe(1e308)
    expect(profile.median).toBe(1e308)
    expect(profile.stddev).toBe(0)
  })

  it('最大有限数常量列仍有有限均值和零标准差', () => {
    for (const count of [3, 7, 9]) {
      const profile = computeColumnProfile('极值', Array(count).fill(Number.MAX_VALUE))
      expect(profile.mean).toBe(Number.MAX_VALUE)
      expect(profile.stddev).toBe(0)
    }
    const profile = computeColumnProfile('正负极值', [-Number.MAX_VALUE, Number.MAX_VALUE])
    expect(profile.mean).toBe(0)
    expect(profile.stddev).toBe(Number.MAX_VALUE)
  })

  it.each([0, 1, 2, 3, 6, 8])('抽取 %i 行不超量且不重复', count => {
    const samples = stratifiedSample(['编号'], Array.from({ length: 10 }, (_, i) => [i]), count)
    expect(samples).toHaveLength(count)
    expect(new Set(samples.map(r => r.编号)).size).toBe(count)
  })
})

describe('大表聚合和数值范围', () => {
  it.each(['min', 'max'])('20 万行同组 %s 不展开参数', op => {
    const rows = Array.from({ length: 200000 }, (_, i) => ['组', i - 100000])
    expect(groupAggregate(rows, 0, 1, op).groups[0].value).toBe(op === 'min' ? -100000 : 99999)
  })

  it('超出数值范围明确报错，不静默返回零', () => {
    expect(() => groupAggregate([['A', 1e308], ['A', 1e308]], 0, 1, 'sum')).toThrow(/超出.*数值范围/)
  })

  it('有限大数不因四舍五入乘100溢出，平均值避免求和溢出', () => {
    expect(groupAggregate([['A', 1e308]], 0, 1, 'sum').groups[0].value).toBe(1e308)
    expect(groupAggregate([['A', 1e308], ['A', 1e308]], 0, 1, 'avg').groups[0].value).toBe(1e308)
  })

  it('多个最大有限数的平均值仍在可表示范围', () => {
    const rows = Array.from({ length: 3 }, () => ['A', Number.MAX_VALUE])
    expect(groupAggregate(rows, 0, 1, 'avg').groups[0].value).toBe(Number.MAX_VALUE)
  })

  it('空白字符串不作为零参与平均值和最小值', () => {
    const rows = [['A', '  '], ['A', 10], ['A', '\t']]
    expect(groupAggregate(rows, 0, 1, 'avg').groups[0].value).toBe(10)
    expect(groupAggregate(rows, 0, 1, 'min').groups[0].value).toBe(10)
    expect(groupAggregate(rows, 0, 1, 'count').groups[0].value).toBe(3)
  })
})
