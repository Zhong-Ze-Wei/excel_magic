/**
 * 数据集意图分析 — 导入后由 AI 读取表格快照，推断「用户可能想做什么」
 *
 * 设计原则：
 * - 只读「列画像 + 分层抽样」，控制 token（不灌全表）
 * - AI 返回 2-3 个「任务方案」作为建议，用户采纳或自改
 * - 失败/降级时返回 null，调用方回退到原始手动模式
 */
import { computeAllProfiles, stratifiedSample, formatProfilesForAI, formatSampleRows } from './dataProfiler'
import { getIntentAnalysisPrompt } from './prompts'
import { callAI } from './ai'
import { parseRobustJSON } from './jsonParser'

/**
 * 生成表格快照（列画像 + 分层抽样），供 AI 分析或前端展示。
 * @param {Array} headers
 * @param {Array} rows
 * @param {number} sampleCount 抽样行数，默认 8（头/中/尾各取）
 * @returns {{ profiles: Array, sampleRows: Array, profilesText: string, sampleText: string }}
 */
export function buildTableSnapshot(headers, rows, sampleCount = 8) {
  const profiles = computeAllProfiles(headers, rows)
  const sampleRows = stratifiedSample(headers, rows, sampleCount)
  return {
    profiles,
    sampleRows,
    profilesText: formatProfilesForAI(profiles),
    sampleText: formatSampleRows(sampleRows)
  }
}

/**
 * 调用 AI 分析表格意图，返回 2-3 个任务方案建议。
 * @param {Array} headers
 * @param {Array} rows
 * @param {object} apiConfig settings.getApiConfig() 的返回值
 * @returns {Promise<{suggestions: Array<{goal:string, coreColumnIdx:number, tasks:{clean,process,summary}, confidence:'high'|'medium'|'low'}>}>}
 */
export async function analyzeTableIntent(headers, rows, apiConfig) {
  const { profilesText, sampleText } = buildTableSnapshot(headers, rows)
  const systemPrompt = getIntentAnalysisPrompt()
  const userPrompt = `【列画像】\n${profilesText}\n\n【样本数据】\n${sampleText}\n\n【表头】${JSON.stringify(headers)}`

  const raw = await callAI(userPrompt, systemPrompt, apiConfig.workModel)
  const parsed = parseRobustJSON(raw)
  if (!parsed || !Array.isArray(parsed.suggestions)) {
    throw new Error('AI 返回格式无法解析')
  }
  return normalizeSuggestions(parsed.suggestions, headers)
}

/**
 * 规范化 AI 返回的建议：校验核心列索引、任务布尔值、置信度。
 */
function normalizeSuggestions(raw, headers) {
  const validTasks = { clean: false, process: false, summary: false }
  const confidences = new Set(['high', 'medium', 'low'])

  return raw
    .filter(s => s && typeof s.goal === 'string' && s.goal.trim())
    .slice(0, 3)
    .map(s => {
      // 核心列索引校验：必须在表头范围内
      let coreColumnIdx = Number(s.coreColumnIdx)
      if (!Number.isInteger(coreColumnIdx) || coreColumnIdx < 0 || coreColumnIdx >= headers.length) {
        coreColumnIdx = 0
      }
      // 任务布尔值：缺省视为 false
      const tasks = {
        clean: !!s.tasks?.clean,
        process: !!s.tasks?.process,
        summary: !!s.tasks?.summary
      }
      // 至少选一个任务，否则全选（兜底）
      if (!tasks.clean && !tasks.process && !tasks.summary) {
        Object.assign(tasks, { clean: true, process: true, summary: true })
      }
      const confidence = confidences.has(s.confidence) ? s.confidence : 'medium'
      return { goal: s.goal.trim(), coreColumnIdx, tasks, confidence }
    })
    .filter(s => s.goal)
}
