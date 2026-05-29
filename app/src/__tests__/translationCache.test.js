import { describe, it, expect, beforeEach } from 'vitest'
import { createTranslationCache } from '../services/translationCache'

describe('createTranslationCache', () => {
  let cache

  beforeEach(() => {
    cache = createTranslationCache()
  })

  it('存储和读取翻译结果', () => {
    cache.set('Hello', '你好')
    expect(cache.get('Hello')).toBe('你好')
  })

  it('未缓存返回 null', () => {
    expect(cache.get('Unknown')).toBe(null)
  })

  it('has() 判断是否缓存', () => {
    expect(cache.has('Hello')).toBe(false)
    cache.set('Hello', '你好')
    expect(cache.has('Hello')).toBe(true)
  })

  it('stats 返回命中/未命中统计', () => {
    cache.get('A') // miss
    cache.set('B', 'B翻译')
    cache.get('B') // hit
    cache.get('C') // miss
    const stats = cache.stats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(2)
    expect(stats.size).toBe(1)
  })

  it('clear 清空缓存', () => {
    cache.set('A', 'A翻译')
    cache.clear()
    expect(cache.has('A')).toBe(false)
    expect(cache.stats().size).toBe(0)
  })
})
