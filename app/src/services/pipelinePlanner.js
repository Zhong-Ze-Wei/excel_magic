/**
 * 方案预演引擎 — 根据意图目标，并行调用 AI 规划清洗/加工/对比/摘要的基础配置
 *
 * 设计原则：
 * - 多次小调用（各模块各一次），Promise.all 并行，质量优先于成本
 * - 每段独立 try/catch，单个失败不影响其他（返回 null，调用方降级为"进页面手动配"）
 * - 复用现有 prompt 函数 + 规范化函数，不重复造轮子
 * - 每段 systemPrompt 注入对应模块的能力边界（getCapabilityConstraint），AI 不会越界规划
 */
import { callAI } from './ai'
import { parseRobustJSON } from './jsonParser'
import { getSmartFilterPrompt, getLabelingPlanGenerationPrompt, getAnalysisThemePrompt, getCapabilityConstraint } from './prompts'
import { normalizeLabelingPlan } from './labelingPlan'
import { DEFAULT_RULES_CONFIG } from '../config/defaultSettings'

/**
 * 并行规划各模块方案。
 * @param {{
 *   goal: string,            // 用户确认的任务目标
 *   headers: Array,          // 表头
 *   rows: Array,             // 全表数据（内部会抽样）
 *   tasks: {clean,process,summary,aggregate},  // 用户选的任务
 *   coreColumnIdx: number,   // 主列索引（清洗用）
 *   workModel: string        // 模型 ID
 * }} params
 * @returns {Promise<{clean,process,summary,aggregate}>}
 *   每段失败时为 null；成功时为该模块的基础配置对象
 */
export async function planPipeline({ goal, headers, rows, tasks, coreColumnIdx, workModel }) {
  const ctx = { goal, headers, rows, tasks, coreColumnIdx, workModel }

  // 按用户选的任务并行规划，没选的任务跳过（返回 null）
  const [clean, process, summary, aggregate] = await Promise.all([
    tasks.clean ? planClean(ctx).catch(() => null) : Promise.resolve(null),
    tasks.process ? planProcess(ctx).catch(() => null) : Promise.resolve(null),
    tasks.summary ? planSummary(ctx).catch(() => null) : Promise.resolve(null),
    tasks.aggregate ? planAggregate(ctx).catch(() => null) : Promise.resolve(null)
  ])

  return { clean, process, summary, aggregate }
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
  const systemPrompt = `你是一个数据清洗专家。你的清洗规则必须严格服从用户的任务目标：「${goal}」。${getCapabilityConstraint('clean')}`
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
  const systemPrompt = `你是一个数据分析配置专家。你的输出列方案必须严格服从用户的任务目标：「${goal}」。只围绕该目标设计输出列，不要根据数据特征自行发散到其他分析方向。${getCapabilityConstraint('process')}`
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
  const systemPrompt = `你是一个数据分析顾问。你的分析主题和关注列必须严格服从用户的任务目标：「${goal}」。不要根据数据特征自行发散到其他分析方向。${getCapabilityConstraint('summary')}`
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

// ── 对比方案：AI 推荐分组列 + 值列 + 聚合方式 ──
async function planAggregate({ goal, headers, rows, workModel }) {
  // 轻量列画像：列名 + 样本 + 简单类型判断
  const colSummary = headers.map((h, i) => {
    const vals = rows.slice(0, 30).map(r => r[i]).filter(v => v != null && v !== '').map(String)
    const nums = vals.filter(v => !isNaN(Number(v)) && v.trim() !== '').length
    const isNumeric = nums / Math.max(vals.length, 1) > 0.7
    return `- 列${i} "${h}"：${isNumeric ? '数值' : '文本/枚举'}，样本 ${JSON.stringify(vals.slice(0, 3))}`
  }).join('\n')

  const prompt = `用户希望对数据做"分组对比"，请根据任务目标和列结构，推荐最合适的分组列、值列和聚合方式。

【用户的任务目标】
"${goal}"

【全表列结构】
${colSummary}

【支持的操作】
- 聚合方式：sum（求和）/ avg（均值）/ count（计数，不需要值列）/ min（最小）/ max（最大）

【判断要点】
1. 分组列（groupColIdx）：通常是分类/枚举/文本列，如"站点""地区""类别"等，值的种类不宜过多（建议 < 50）。
2. 值列（valueColIdx）：通常是数值列，如"互动量""销售额""数量"。count 模式下可为 null。
3. 聚合方式（op）：根据用户目标语义推断。如"总互动量"→sum，"平均客单价"→avg，"各有多少条"→count。
4. 如果数据中没有合适的分组列或值列（如全是文本无数值列），请在 feasibility 标注"insufficient_data"。

【返回格式】
必须返回纯 JSON，不要 markdown 代码块，不要解释。
{
  "groupColIdx": 0,
  "valueColIdx": 1,
  "op": "sum",
  "reason": "简要说明为什么这样选",
  "feasibility": "ok"
}`

  const systemPrompt = `你是一个数据分析顾问。你必须严格服从用户的任务目标：「${goal}」，为其推荐最合适的分组对比方案。${getCapabilityConstraint('aggregate')}`
  const raw = await callAI(prompt, systemPrompt, workModel)
  const parsed = parseRobustJSON(raw)
  if (!parsed) return null

  // 校验索引合法性
  const gIdx = Number(parsed.groupColIdx)
  const vIdx = Number(parsed.valueColIdx)
  const validOps = ['sum', 'avg', 'count', 'min', 'max']

  const groupColIdx = (Number.isInteger(gIdx) && gIdx >= 0 && gIdx < headers.length) ? gIdx : null
  const valueColIdx = (parsed.op === 'count' || !Number.isInteger(vIdx) || vIdx < 0 || vIdx >= headers.length)
    ? null : vIdx
  const op = validOps.includes(parsed.op) ? parsed.op : 'sum'

  if (groupColIdx === null) return null

  return { groupColIdx, valueColIdx, op, reason: parsed.reason || '', feasibility: parsed.feasibility || 'ok' }
}
