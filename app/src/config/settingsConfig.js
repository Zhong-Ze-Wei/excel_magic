import { DEFAULT_API_PLATFORMS, DEFAULT_RULES_CONFIG, DEFAULT_SETTINGS } from './defaultSettings'

const clone = value => JSON.parse(JSON.stringify(value))
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const isString = value => typeof value === 'string'
const isBoolean = value => typeof value === 'boolean'
const isNumber = value => typeof value === 'number' && Number.isFinite(value)
const isStringList = value => Array.isArray(value) && value.every(isString)
const isColumn = value => Number.isInteger(value) && value >= 0
const isTextColumn = value => Number.isInteger(value) && value >= -1
const isScalar = value => isString(value) || isNumber(value) || isBoolean(value)

function requireValid(condition, field) {
  if (!condition) throw new Error(`配置字段无效：${field}`)
}

function checkKeys(value, allowed, field) {
  requireValid(isObject(value), field)
  requireValid(Object.keys(value).every(key => allowed.includes(key)), field)
}

function checkedFields(input, validators, field) {
  checkKeys(input, Object.keys(validators), field)
  for (const [key, value] of Object.entries(input)) {
    requireValid(validators[key](value), `${field}.${key}`)
  }
}

export function createDefaultSettings() {
  return clone({ version: '1.1.0', ...DEFAULT_SETTINGS, rulesConfig: DEFAULT_RULES_CONFIG })
}

const filterConfigSchemas = {
  textContains: { column: isTextColumn, keywords: isStringList, matchAll: isBoolean, caseSensitive: isBoolean },
  textNotContains: { column: isTextColumn, keywords: isStringList, matchAll: isBoolean, caseSensitive: isBoolean },
  textEquals: { column: isTextColumn, value: isString, caseSensitive: isBoolean },
  regexMatch: { column: isTextColumn, pattern: isString },
  textLength: { column: isTextColumn, operator: value => ['lt', 'gt', 'eq', 'lte', 'gte'].includes(value), value: value => Number.isInteger(value) && value >= 0 },
  columnEquals: { column: isColumn, value: isScalar, values: value => Array.isArray(value) && value.every(isScalar) },
  columnGt: { column: isColumn, value: isNumber },
  columnLt: { column: isColumn, value: isNumber },
  labelColumnEquals: { column: isTextColumn, outputKey: value => isString(value) && value.length > 0, value: isScalar, values: value => Array.isArray(value) && value.every(isScalar) }
}

function normalizeCustomFilter(filter, index) {
  const field = `customFilters[${index}]`
  checkKeys(filter, ['id', 'name', 'type', 'enabled', 'policy', 'config'], field)
  requireValid(Object.hasOwn(filterConfigSchemas, filter.type), `${field}.type`)
  if (Object.hasOwn(filter, 'id')) requireValid(isString(filter.id) && filter.id.length > 0, `${field}.id`)
  if (Object.hasOwn(filter, 'name')) requireValid(isString(filter.name), `${field}.name`)
  if (Object.hasOwn(filter, 'enabled')) requireValid(isBoolean(filter.enabled), `${field}.enabled`)
  if (Object.hasOwn(filter, 'policy')) requireValid(['delete', 'suspect'].includes(filter.policy), `${field}.policy`)
  checkedFields(filter.config, filterConfigSchemas[filter.type], `${field}.config`)
  const config = clone(filter.config)
  if (filter.type.startsWith('column')) requireValid(isColumn(config.column), `${field}.config.column`)
  if (filter.type === 'labelColumnEquals') requireValid(isString(config.outputKey) && config.outputKey.length > 0, `${field}.config.outputKey`)
  if (filter.type === 'regexMatch' && config.pattern) {
    // 导入时直接拒绝无效表达式，避免保存一条永远不会执行的规则。
    new RegExp(config.pattern)
  }
  if (filter.type === 'columnEquals' && Object.hasOwn(config, 'value')) config.value = String(config.value)
  return {
    id: filter.id || `imported_${index + 1}`,
    name: filter.name || '导入规则',
    type: filter.type,
    enabled: filter.enabled ?? true,
    policy: filter.policy || 'delete',
    config
  }
}

export function normalizeRulesConfig(input) {
  checkKeys(input, Object.keys(DEFAULT_RULES_CONFIG), 'rulesConfig')
  const result = clone(DEFAULT_RULES_CONFIG)
  for (const [key, value] of Object.entries(input)) {
    if (key === 'weakPolicy') {
      requireValid(['mark', 'delete'].includes(value), key)
      result[key] = value
    } else if (key === 'customFilters') {
      requireValid(Array.isArray(value), key)
      result[key] = value.map(normalizeCustomFilter)
      requireValid(new Set(result[key].map(filter => filter.id)).size === result[key].length, 'customFilters.id')
    } else {
      const defaults = DEFAULT_RULES_CONFIG[key]
      checkKeys(value, Object.keys(defaults), key)
      for (const [param, paramValue] of Object.entries(value)) {
        let valid
        if (param === 'enable') valid = isBoolean(paramValue)
        else if (param === 'minLength') valid = Number.isInteger(paramValue) && paramValue >= 1
        else if (param === 'minCount') valid = Number.isInteger(paramValue) && paramValue >= 2
        else if (param === 'ratioThreshold' || param === 'threshold') valid = isNumber(paramValue) && paramValue >= 0 && paramValue <= 1
        else if (Array.isArray(defaults[param])) valid = isStringList(paramValue)
        else valid = isString(paramValue)
        requireValid(valid, `${key}.${param}`)
      }
      result[key] = { ...result[key], ...clone(value) }
    }
  }
  for (const [key, arrayKey, textKey] of [['adLink', 'keywords', 'keywordsStr'], ['shortMeaningless', 'phrases', 'phrasesStr']]) {
    const rule = input[key]
    if (rule && Object.hasOwn(rule, arrayKey)) result[key][textKey] = rule[arrayKey].join(',')
    else if (rule && Object.hasOwn(rule, textKey)) result[key][arrayKey] = rule[textKey].split(/[,，\n]/).map(word => word.trim()).filter(Boolean)
  }
  return result
}

// 先得到完整有效快照，再交给 store 一次应用；验证失败时不会部分写入。
export function normalizeSettingsImport(input, base = createDefaultSettings()) {
  requireValid(isObject(input) && Object.keys(input).length > 0, '配置文件')
  const keys = Object.keys(input)
  const rulesKeys = Object.keys(DEFAULT_RULES_CONFIG)
  if (keys.every(key => rulesKeys.includes(key))) {
    return { ...clone(base), rulesConfig: normalizeRulesConfig(input) }
  }
  checkKeys(input, ['version', ...Object.keys(DEFAULT_SETTINGS), 'rulesConfig'], '配置文件')
  requireValid(keys.some(key => key !== 'version'), '配置文件')
  const next = clone(base)
  if (Object.hasOwn(input, 'version')) requireValid(isString(input.version), 'version')
  if (Object.hasOwn(input, 'apiPlatform')) {
    requireValid(Object.hasOwn(DEFAULT_API_PLATFORMS, input.apiPlatform), 'apiPlatform')
    next.apiPlatform = input.apiPlatform
  }
  for (const field of ['apiKeys', 'selectedTranslateModel', 'selectedWorkModel']) {
    if (!Object.hasOwn(input, field)) continue
    checkKeys(input[field], Object.keys(DEFAULT_API_PLATFORMS), field)
    for (const [platform, value] of Object.entries(input[field])) {
      requireValid(isString(value) && (field === 'apiKeys' || value.trim().length > 0), `${field}.${platform}`)
      next[field][platform] = value
    }
  }
  if (Object.hasOwn(input, 'concurrency')) {
    requireValid(Number.isInteger(input.concurrency) && input.concurrency >= 1 && input.concurrency <= 100, 'concurrency')
    next.concurrency = input.concurrency
  }
  if (Object.hasOwn(input, 'autoIntentAnalysis')) {
    requireValid(isBoolean(input.autoIntentAnalysis), 'autoIntentAnalysis')
    next.autoIntentAnalysis = input.autoIntentAnalysis
  }
  for (const field of ['cleaningMode', 'processMode']) {
    if (!Object.hasOwn(input, field)) continue
    requireValid(['simple', 'expert'].includes(input[field]), field)
    next[field] = input[field]
  }
  if (Object.hasOwn(input, 'rulesConfig')) next.rulesConfig = normalizeRulesConfig(input.rulesConfig)
  next.version = '1.1.0'
  return next
}
