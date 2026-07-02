/**
 * 三步方案预演引擎 — 根据意图目标，并行调用 AI 规划清洗/加工/摘要的基础配置
 *
 * 设计原则：
 * - 多次小调用（清洗/加工/摘要各一次），Promise.all 并行，质量优先于成本
 * - 每段独立 try/catch，单个失败不影响其他（返回 null，调用方降级为"进页面手动配"）
 * - 复用现有 prompt 函数 + 规范化函数，不重复造轮子
 */
import { callAI } from './ai'
import { parseRobustJSON } from './jsonParser'
import { getSmartFilterPrompt, getLabelingPlanGenerationPrompt, getAnalysisThemePrompt } from './prompts'
import { normalizeLabelingPlan } from './labelingPlan'
import { DEFAULT_RULES_CONFIG } from '../config/defaultSettings'

/**
 * 并行规划三步方案。
 * @param {{
 *   goal: string,            // 用户确认的任务目标
 *   headers: Array,          // 表头
 *   rows: Array,             // 全表数据（内部会抽样）
 *   tasks: {clean,process,summary},  // 用户选的任务
 *   coreColumnIdx: number,   // 主列索引（清洗用）
 *   workModel: string        // 模型 ID
 * }} params
 * @returns {Promise<{clean:Object|null, process:Object|null, summary:Object|null}>}
 *   每段失败时为 null；成功时为该模块的基础配置对象
 */
export async function planPipeline({ goal, headers, rows, tasks, coreColumnIdx, workModel }) {
  const ctx = { goal, headers, rows, tasks, coreColumnIdx, workModel }

  // 按用户选的任务并行规划，没选的任务跳过（返回 null）
  const [clean, process, summary] = await Promise.all([
    tasks.clean ? planClean(ctx).catch(() => null) : Promise.resolve(null),
    tasks.process ? planProcess(ctx).catch(() => null) : Promise.resolve(null),
    tasks.summary ? planSummary(ctx).catch(() => null) : Promise.resolve(null)
  ])

  return { clean, process, summary }
}

// ── 清洗方案：AI 生成 rulesConfig ──
async function planClean({ goal, headers, rows, coreColumnIdx, workModel }) {
  const sourceCol = coreColumnIdx ?? 0
  // 采样前 20 行各列
  const allColumnSamples = {}
  for (let c = 0; c < headers.length; c++) {
    allColumnSamples[c] = rows.slice(0, 20).map(r => r[c] != null ? String(r[c]) : '')
  }
  const { ATOMIC_RULES_META } = await import('./cleaningRules')
  const rulesMeta = ATOMIC_RULES_META.map(r => ({ key: r.key, title: r.title, description: r.description }))

  const prompt = getSmartFilterPrompt(goal, headers, sourceCol, allColumnSamples, rulesMeta)
  const systemPrompt = `你是一个数据清洗专家。你的清洗规则必须严格服从用户的任务目标：「${goal}」。`
  const raw = await callAI(prompt, systemPrompt, workModel)
  const parsed = parseRobustJSON(raw)
  if (!parsed) return null

  // 组装 rulesConfig（与 OptimizeView.runAiOptimize 同逻辑）
  const config = JSON.parse(JSON.stringify(DEFAULT_RULES_CONFIG))
  config.weakPolicy = 'delete'
  if (parsed.builtinConfig) {
    const bc = parsed.builtinConfig
    if (bc.rulesToEnable) bc.rulesToEnable.forEach(k => { if (config[k]) config[k].enable = true })
    if (bc.rulesToDisable) bc.rulesToDisable.forEach(k => { if (config[k]) config[k].enable = false })
    if (bc.paramOverrides) {
      for (const [key, overrides] of Object.entries(bc.paramOverrides)) {
        if (config[key]) Object.assign(config[key], overrides)
      }
    }
  }
  if (parsed.customFilters?.length) {
    config.customFilters = parsed.customFilters.map(cf => ({
      name: cf.name || '自定义规则',
      enable: true,
      type: cf.type || 'textContains',
      target: cf.target ?? sourceCol,
      value: cf.value || '',
      caseSensitive: cf.caseSensitive || false
    }))
  }
  if (parsed.analysis) config._aiSummary = parsed.analysis

  return { sourceCol, aiRulesConfig: config }
}

// ── 加工方案：AI 生成 labelingPlan.outputColumns ──
async function planProcess({ goal, headers, rows, coreColumnIdx, workModel }) {
  const sampleRows = rows.slice(0, 6)
  // 默认参考列：主列 + 相邻 1-2 列（让 AI 有上下文）
  const inputColumns = [coreColumnIdx ?? 0]
  const prompt = getLabelingPlanGenerationPrompt(goal, headers, sampleRows, inputColumns)
  // 硬约束：必须服从用户目标，不得自行发散到其他分析方向
  const systemPrompt = `你是一个数据分析配置专家。你的输出列方案必须严格服从用户的任务目标：「${goal}」。只围绕该目标设计输出列，不要根据数据特征自行发散到其他分析方向。`
  const raw = await callAI(prompt, systemPrompt, workModel)
  const parsed = parseRobustJSON(raw)
  const plan = normalizeLabelingPlan(parsed)
  if (!plan) return null
  return {
    inputColumns,
    outputColumns: plan.outputColumns,
    taskName: plan.taskName,
    goal: plan.goal || goal
  }
}

// ── 摘要方案：AI 推荐分析主题 + 关注列 ──
async function planSummary({ goal, headers, rows, workModel }) {
  // 简单列画像（轻量，不调 computeAllProfiles 避免重算）
  const colSummary = headers.map((h, i) => {
    const vals = rows.slice(0, 50).map(r => r[i]).filter(v => v != null && v !== '')
    const sample = vals.slice(0, 3).map(v => String(v).slice(0, 20))
    return `- 列${i} "${h}"：样本 ${JSON.stringify(sample)}`
  }).join('\n')

  const prompt = getAnalysisThemePrompt(goal, colSummary, null)
  // 硬约束：分析主题和关注列必须服从用户目标
  const systemPrompt = `你是一个数据分析顾问。你的分析主题和关注列必须严格服从用户的任务目标：「${goal}」。不要根据数据特征自行发散到其他分析方向。`
  const raw = await callAI(prompt, systemPrompt, workModel)
  const parsed = parseRobustJSON(raw)

  // 推荐关注列（从 AI 返回的 focusColumns 解析，兜底为主列）
  let focusColumns = []
  if (parsed?.focusColumns?.columnIndex && Array.isArray(parsed.focusColumns.columnIndex)) {
    focusColumns = parsed.focusColumns.columnIndex.filter(i => Number.isInteger(i) && i >= 0 && i < headers.length)
  }
  const theme = parsed?.analysisTheme || parsed?.theme || goal

  return { theme, focusColumns }
}
