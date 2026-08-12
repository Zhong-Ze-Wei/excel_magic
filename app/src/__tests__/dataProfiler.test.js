import { describe, it, expect } from 'vitest'
import { detectColumnType, computeColumnProfile, computeAllProfiles, stratifiedSample } from '../services/dataProfiler'

describe('detectColumnType', () => {
  it('空列', () => {
    expect(detectColumnType([null, '', '  '])).toBe('empty')
  })
  it('数值列', () => {
    expect(detectColumnType(['1', '2', '3', '4.5'])).toBe('number')
  })
  it('布尔列', () => {
    expect(detectColumnType(['是', '否', '是', '是'])).toBe('boolean')
  })
  it('日期列', () => {
    expect(detectColumnType(['2024-01-01', '2024-02-02', '2024/03/03'])).toBe('date')
  })
  it('枚举列', () => {
    expect(detectColumnType(['猫', '狗', '猫', '狗', '猫', '狗', '猫', '狗'])).toBe('enum')
  })
  it('标识符列', () => {
    expect(detectColumnType(['id001', 'id002', 'id003', 'id004', 'id005', 'id006'])).toBe('identifier')
  })
  it('文本列', () => {
    expect(detectColumnType(['这是一段较长的文本内容', '又是另一段不同的文本', '第三段完全不同的内容'])).toBe('text')
  })
})

describe('computeColumnProfile', () => {
  it('数值列画像含 min/max/mean/median', () => {
    const p = computeColumnProfile('金额', ['10', '20', '30', '40'])
    expect(p.type).toBe('number')
    expect(p.min).toBe(10)
    expect(p.max).toBe(40)
    expect(p.mean).toBe(25)
    expect(p.median).toBe(25)
  })

  it('fillRate 与非空计数', () => {
    const p = computeColumnProfile('x', ['a', 'b', null, ''])
    expect(p.totalCount).toBe(4)
    expect(p.nonNullCount).toBe(2)
    expect(p.fillRate).toBe(50)
  })

  it('枚举列含值分布', () => {
    const p = computeColumnProfile('性别', ['男', '男', '男', '男', '男', '男', '女'])
    expect(p.type).toBe('enum')
    expect(p.valueDistribution['男']).toBe(86) // 6/7 ≈ 86%
  })
})

describe('computeAllProfiles', () => {
  it('按列生成全部画像', () => {
    const profiles = computeAllProfiles(['a', 'b'], [['1', 'x'], ['2', 'y']])
    expect(profiles).toHaveLength(2)
    expect(profiles[0].header).toBe('a')
    expect(profiles[1].header).toBe('b')
  })
})

describe('stratifiedSample', () => {
  it('行数不超过 count 时全量返回', () => {
    const s = stratifiedSample(['col'], [['a'], ['b']], 6)
    expect(s).toHaveLength(2)
    expect(s[0].col).toBe('a')
  })

  it('行数超过 count 时返回头中尾', () => {
    const rows = Array.from({ length: 30 }, (_, i) => [`r${i}`])
    const s = stratifiedSample(['col'], rows, 6)
    expect(s).toHaveLength(6)
    expect(s[0].col).toBe('r0')
    expect(s[s.length - 1].col).toBe('r29')
  })
})
