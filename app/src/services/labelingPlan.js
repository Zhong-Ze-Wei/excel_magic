/**
 * 打标方案（Labeling Plan）数据规范化与校验
 *
 * 这几个函数是从 AI 返回的原始 JSON → 结构化 labelingPlan 的纯转换逻辑，
 * 与 Vue 响应式无关，抽出作为单一事实源，便于单测与复用。
 */

const VALID_COL_TYPES = ['enum', 'multi_enum', 'hierarchical_enum', 'boolean', 'text', 'number']

/**
 * 规范化 AI 返回的方案对象。
 * 严格过滤：outputColumns 缺失/为空时返回 null；每列必须有 key 和 name。
 * @param {object} raw AI 返回的原始对象
 * @returns {object|null} 规范化后的 plan，或 null（表示不可用）
 */
export function normalizeLabelingPlan(raw) {
  if (!raw || typeof raw !== 'object') return null
  const plan = {
    taskName: raw.taskName || '',
    goal: raw.goal || '',
    inputColumns: Array.isArray(raw.inputColumns) ? raw.inputColumns : [],
    outputColumns: []
  }
  if (!Array.isArray(raw.outputColumns) || raw.outputColumns.length === 0) return null

  plan.outputColumns = raw.outputColumns.map(col => {
    const c = {
      key: String(col.key || '').trim().replace(/\s+/g, '_'),
      name: String(col.name || '').trim(),
      type: VALID_COL_TYPES.includes(col.type) ? col.type : 'text',
      description: String(col.description || '').trim(),
      required: col.required !== false
    }
    if (col.options != null) c.options = col.options
    if (!c.key && c.name) c.key = c.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_一-鿿]/g, '')
    return c
  }).filter(c => c.key && c.name)

  return plan.outputColumns.length > 0 ? plan : null
}

/**
 * 校验方案的完整性，返回首个错误信息（无错返回 null）。
 * @param {object} plan 规范化后的 plan
 * @returns {string|null} 错误信息或 null
 */
export function validateLabelingPlan(plan) {
  if (!plan || !plan.outputColumns.length) return '请至少定义一个输出列'
  const keys = plan.outputColumns.map(c => c.key)
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
  if (dupes.length) return `字段 key 重复: ${dupes.join(', ')}`
  for (const col of plan.outputColumns) {
    if (['enum', 'multi_enum'].includes(col.type) && (!col.options || !col.options.length)) {
      return `字段 "${col.name}" 是 ${col.type} 类型，但未设置选项`
    }
    if (col.type === 'hierarchical_enum' && (!col.options || typeof col.options !== 'object' || Array.isArray(col.options))) {
      return `字段 "${col.name}" 是 hierarchical_enum 类型，但 options 格式不正确`
    }
  }
  return null
}

/**
 * 规范化 AI 单行返回的结果，按 outputColumns 的类型约束逐字段校正。
 * @param {object} parsed AI 返回的单行结果
 * @param {Array} outputColumns 方案的输出列定义
 * @returns {object|null} { [colKey]: value } 或 null
 */
export function normalizeRowResult(parsed, outputColumns) {
  if (!parsed || typeof parsed !== 'object') return null
  const values = {}
  for (const col of outputColumns) {
    let val = parsed[col.key]
    if (val === undefined || val === null) {
      values[col.key] = null
      continue
    }
    if (col.type === 'enum') {
      values[col.key] = col.options?.includes(val) ? val : (col.options?.[0] ?? val)
    } else if (col.type === 'multi_enum') {
      values[col.key] = Array.isArray(val) ? val : [val]
    } else if (col.type === 'hierarchical_enum') {
      values[col.key] = typeof val === 'string' ? val : '-'
    } else if (col.type === 'boolean') {
      values[col.key] = val === true ? true : val === false ? false : null
    } else if (col.type === 'number') {
      values[col.key] = typeof val === 'number' ? val : (Number(val) || null)
    } else {
      values[col.key] = String(val)
    }
  }
  return values
}
