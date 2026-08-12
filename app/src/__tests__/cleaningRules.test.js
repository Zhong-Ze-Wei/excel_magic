import { describe, it, expect } from 'vitest'
import {
  normalizeText, checkIsEmpty, checkTooShort, checkDuplicate, checkPureEmoji,
  checkPureSymbol, checkLinkOnly, checkTopicOnly, checkShortMeaningless,
  checkAdLinkPattern, checkGarbledText, runCleaningPipeline, evaluateCustomFilter
} from '../services/cleaningRules'
import { DEFAULT_RULES_CONFIG } from '../config/defaultSettings'

describe('normalizeText', () => {
  it('去除首尾空白并压缩连续空白', () => {
    expect(normalizeText('  hello   world  ')).toBe('hello world')
  })
  it('null/undefined 转空串', () => {
    expect(normalizeText(null)).toBe('')
    expect(normalizeText(undefined)).toBe('')
  })
  it('去除零宽空格等不可见字符', () => {
    expect(normalizeText('a​b')).toBe('ab')
  })
})

describe('原子规则', () => {
  it('checkIsEmpty 空文本命中', () => {
    expect(checkIsEmpty('').hit).toBe(true)
    expect(checkIsEmpty('x').hit).toBe(false)
  })

  it('checkTooShort 单字占位命中', () => {
    expect(checkTooShort('赞', 2).hit).toBe(true)
    expect(checkTooShort('这是一个正常的句子', 2).hit).toBe(false)
  })

  it('checkDuplicate 保留首条，删除后续', () => {
    const textFreq = { 'x': 3 }
    const firstIndices = { 'x': 0 }
    expect(checkDuplicate('x', 0, textFreq, firstIndices, 3).hit).toBe(false)
    expect(checkDuplicate('x', 1, textFreq, firstIndices, 3).hit).toBe(true)
  })

  it('checkPureEmoji 纯表情/占位表情命中', () => {
    expect(checkPureEmoji('[赞][玫瑰]').hit).toBe(true)
    expect(checkPureEmoji('👍👍').hit).toBe(true)
    expect(checkPureEmoji('正常文本').hit).toBe(false)
  })

  it('checkPureSymbol 纯标点命中', () => {
    expect(checkPureSymbol('!!!').hit).toBe(true)
    expect(checkPureSymbol('hello').hit).toBe(false)
  })

  it('checkLinkOnly 纯链接命中，纯数字不误判', () => {
    expect(checkLinkOnly('https://example.com').hit).toBe(true)
    expect(checkLinkOnly('666').hit).toBe(false)
    expect(checkLinkOnly('普通文本').hit).toBe(false)
  })

  it('checkTopicOnly 纯话题命中', () => {
    expect(checkTopicOnly('#话题#').hit).toBe(true)
    expect(checkTopicOnly('#话题# 这是正文').hit).toBe(false)
  })

  it('checkShortMeaningless 默认短语命中', () => {
    expect(checkShortMeaningless('哈哈').hit).toBe(true)
    expect(checkShortMeaningless('这是一段内容').hit).toBe(false)
  })

  it('checkAdLinkPattern 区分强/弱广告', () => {
    const strong = checkAdLinkPattern('加微信 https://x.com/y')
    expect(strong.hit).toBe(true)
    expect(strong.reason).toBe('ad_link')
    const weak = checkAdLinkPattern('加微信咨询详情')
    expect(weak.hit).toBe(true)
    expect(weak.reason).toBe('suspect_ad')
    expect(checkAdLinkPattern('正常文本').hit).toBe(false)
  })

  it('checkGarbledText 乱码占比超阈值命中', () => {
    expect(checkGarbledText('ÀÀÀÀ测试').hit).toBe(true)
    expect(checkGarbledText('这是一段正常的中文文本').hit).toBe(false)
    expect(checkGarbledText('abc').hit).toBe(false) // 过短不判定
  })
})

describe('runCleaningPipeline', () => {
  it('空文本 → delete', () => {
    const res = runCleaningPipeline([[''], ['x'], ['y']], ['col'], 0, DEFAULT_RULES_CONFIG)
    expect(res[0].decision).toBe('delete')
    expect(res[0].hitRule).toBe('empty_text')
  })

  it('正常文本 → keep', () => {
    const res = runCleaningPipeline([['这是一段正常的文本内容']], ['col'], 0, DEFAULT_RULES_CONFIG)
    expect(res[0].decision).toBe('keep')
  })

  it('重复文本保留首条，删除后续', () => {
    const rows = [['重复文本'], ['重复文本'], ['重复文本']]
    const res = runCleaningPipeline(rows, ['col'], 0, DEFAULT_RULES_CONFIG)
    expect(res[0].decision).toBe('keep')
    expect(res[1].decision).toBe('delete')
    expect(res[2].decision).toBe('delete')
  })

  it('纯链接 → delete', () => {
    const res = runCleaningPipeline([['https://example.com']], ['col'], 0, DEFAULT_RULES_CONFIG)
    expect(res[0].decision).toBe('delete')
    expect(res[0].hitRule).toBe('link_only')
  })

  it('引流广告（含链接）→ delete', () => {
    const res = runCleaningPipeline([['加微信 https://x.com/y']], ['col'], 0, DEFAULT_RULES_CONFIG)
    expect(res[0].decision).toBe('delete')
    expect(res[0].hitRule).toBe('ad_link')
  })

  it('疑似广告（仅关键词）→ suspect（默认 mark 策略）', () => {
    const res = runCleaningPipeline([['加微信咨询详情']], ['col'], 0, DEFAULT_RULES_CONFIG)
    expect(res[0].decision).toBe('suspect')
    expect(res[0].hitRule).toBe('suspect_ad')
  })
})

describe('evaluateCustomFilter', () => {
  it('textContains 命中', () => {
    const f = { type: 'textContains', config: { keywords: ['你好'] } }
    expect(evaluateCustomFilter(f, ['你好世界'], '你好世界', 0).hit).toBe(true)
    expect(evaluateCustomFilter(f, ['再见'], '再见', 0).hit).toBe(false)
  })

  it('textNotContains 不含关键词时命中', () => {
    const f = { type: 'textNotContains', config: { keywords: ['垃圾'] } }
    expect(evaluateCustomFilter(f, ['正常'], '正常', 0).hit).toBe(true)
    expect(evaluateCustomFilter(f, ['垃圾内容'], '垃圾内容', 0).hit).toBe(false)
  })

  it('columnEquals 按列值命中', () => {
    const f = { type: 'columnEquals', config: { column: 1, values: ['已删除'] } }
    expect(evaluateCustomFilter(f, ['x', '已删除'], 'x', 0).hit).toBe(true)
    expect(evaluateCustomFilter(f, ['x', '保留'], 'x', 0).hit).toBe(false)
  })

  it('labelColumnEquals 读 AI 标签', () => {
    const f = { type: 'labelColumnEquals', config: { outputKey: 'is_spam', values: ['是'] } }
    const ctx = { labelingResults: { analysisMap: { 0: { values: { is_spam: '是' } } } }, rowIdx: 0 }
    expect(evaluateCustomFilter(f, ['x'], 'x', 0, ctx).hit).toBe(true)
  })
})
