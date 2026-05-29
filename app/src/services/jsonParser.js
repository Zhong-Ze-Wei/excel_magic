/**
 * 强健的 JSON 解析器 — 容错 AI 返回的各种格式
 */

/**
 * 从 AI 返回的文本中提取并解析 JSON
 * 支持：markdown 代码块包裹、前后有多余文本、只有部分 JSON
 */
export function parseRobustJSON(text) {
  if (!text) return null
  let cleaned = text.trim()

  // 1. 过滤 markdown 语法标记
  cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim()

  // 2. 剥离并截取最外层对齐的大括号或中括号
  const startBrace = cleaned.indexOf('{')
  const startBracket = cleaned.indexOf('[')
  let startIdx = -1
  let endIdx = -1

  if (startBrace !== -1 && (startBracket === -1 || startBrace < startBracket)) {
    startIdx = startBrace
    endIdx = cleaned.lastIndexOf('}')
  } else if (startBracket !== -1) {
    startIdx = startBracket
    endIdx = cleaned.lastIndexOf(']')
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1)
  }

  try {
    return JSON.parse(cleaned)
  } catch (e) {
    console.warn('JSON 强健性解析失败:', e.message, '正文:', cleaned.slice(0, 200))
    return null
  }
}
