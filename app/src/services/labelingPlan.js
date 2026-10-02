/**
 * 打标方案（Labeling Plan）数据规范化与校验
 *
 * 这几个函数是从 AI 返回的原始 JSON → 结构化 labelingPlan 的纯转换逻辑，
 * 与 Vue 响应式无关，抽出作为单一事实源，便于单测与复用。
 */

const VALID_COL_TYPES = ['enum', 'multi_enum', 'hierarchical_enum', 'boolean', 'text', 'number']

/** 将表头名称或列索引统一为去重后的合法索引。 */
export function normalizeInputColumns(references, headers) {
  if (!Array.isArray(references)) return []
  const indexes = references.map(reference => {
    if (typeof reference === 'string') {
      const namedIndex = headers.findIndex(header => String(header) === reference)
      if (namedIndex >= 0) return namedIndex
      return /^\d+$/.test(reference) ? Number(reference) : -1
    }
    return typeof reference === 'number' ? reference : -1
  })
  return [...new Set(indexes.filter(i => Number.isInteger(i) && i >= 0 && i < headers.length))]
}

/**
 * 规范化 AI 返回的方案对象。
 * 严格过滤：outputColumns 缺失/为空时返回 null；每列必须有 key 和 name。
 * @param {object} raw AI 返回的原始对象
 * @returns {object|null} 规范化后的 plan，或 null（表示不可用）
 */
export function normalizeLabelingPlan(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const plan = {
    taskName: typeof raw.taskName === 'string' ? raw.taskName : '',
    goal: typeof raw.goal === 'string' ? raw.goal : '',
    inputColumns: Array.isArray(raw.inputColumns) ? raw.inputColumns : [],
    outputColumns: []
  }
  if (!Array.isArray(raw.outputColumns) || raw.outputColumns.length === 0) return null

  plan.outputColumns = raw.outputColumns.filter(col => col && typeof col === 'object' && !Array.isArray(col)
    && (col.key == null || typeof col.key === 'string') && (col.name == null || typeof col.name === 'string')).map(col => {
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
  if (!plan || !Array.isArray(plan.outputColumns) || !plan.outputColumns.length) return '请至少定义一个输出列'
  if (plan.outputColumns.some(col => !col || typeof col.key !== 'string' || !col.key.trim() || typeof col.name !== 'string' || !col.name.trim())) {
    return '每个输出列必须有有效的 key 和名称'
  }
  const keys = plan.outputColumns.map(c => c.key)
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
  if (dupes.length) return `字段 key 重复: ${dupes.join(', ')}`
  for (const col of plan.outputColumns) {
    if (col.type != null && !VALID_COL_TYPES.includes(col.type)) return `字段 "${col.name}" 的类型不受支持`
    if (['enum', 'multi_enum'].includes(col.type) && !validOptions(col.options)) {
      return `字段 "${col.name}" 是 ${col.type} 类型，但未设置选项`
    }
    if (col.type === 'hierarchical_enum' && (!col.options || typeof col.options !== 'object' || Array.isArray(col.options)
      || !Object.keys(col.options).length || Object.entries(col.options).some(([parent, children]) => !parent.trim() || !validOptions(children)))) {
      return `字段 "${col.name}" 是 hierarchical_enum 类型，但 options 格式不正确`
    }
  }
  return null
}

function validOptions(options) {
  return Array.isArray(options) && options.length > 0 && options.every(value => typeof value === 'string' && value.trim() !== '')
}

/**
 * 规范化 AI 单行返回的结果，按 outputColumns 的类型约束逐字段校正。
 * @param {object} parsed AI 返回的单行结果
 * @param {Array} outputColumns 方案的输出列定义
 * @returns {object|null} { [colKey]: value } 或 null
 */
export function normalizeRowResult(parsed, outputColumns) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || validateLabelingPlan({ outputColumns })) return null
  const entries = []
  for (const col of outputColumns) {
    const raw = Object.hasOwn(parsed, col.key) ? parsed[col.key] : null
    const value = normalizeFieldValue(raw, col)
    if (value === null && col.required !== false) return null
    entries.push([col.key, value])
  }
  return Object.fromEntries(entries)
}

function normalizeFieldValue(value, col) {
  if (value == null) return null
  if (col.type === 'enum') return col.options.includes(value) ? value : null
  if (col.type === 'multi_enum') {
    const values = Array.isArray(value) ? value : [value]
    return values.every(item => col.options.includes(item)) ? [...values] : null
  }
  if (col.type === 'hierarchical_enum') {
    if (typeof value !== 'string') return null
    const parts = value.split('>').map(part => part.trim())
    if (parts.length !== 2) return null
    const [parent, child] = parts
    return Object.hasOwn(col.options, parent) && col.options[parent].includes(child) ? `${parent} > ${child}` : null
  }
  if (col.type === 'boolean') return typeof value === 'boolean' ? value : null
  if (col.type === 'number') {
    if (typeof value !== 'number' && typeof value !== 'string') return null
    if (typeof value === 'string' && !value.trim()) return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }
  if (!['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) return null
  const text = String(value)
  return text.trim() ? text : null
}
