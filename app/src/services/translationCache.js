/**
 * 翻译缓存服务 — 避免重复翻译相同文本
 */

export function createTranslationCache() {
  const cache = new Map()
  let hits = 0
  let misses = 0

  function get(key) {
    if (cache.has(key)) {
      hits++
      return cache.get(key)
    }
    misses++
    return null
  }

  function set(key, value) {
    cache.set(key, value)
  }

  function has(key) {
    return cache.has(key)
  }

  function clear() {
    cache.clear()
    hits = 0
    misses = 0
  }

  function stats() {
    return { hits, misses, size: cache.size }
  }

  return { get, set, has, clear, stats }
}
