import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { DEFAULT_RULES_CONFIG } from '../config/defaultSettings'

function snapshot(store) {
  return JSON.parse(JSON.stringify({
    apiPlatform: store.currentPlatform,
    apiKeys: { aiping: localStorage.getItem('aiping_api_key'), siliconflow: localStorage.getItem('siliconflow_api_key') },
    selectedWorkModel: store.selectedWorkModel,
    rulesConfig: store.rulesConfig,
    concurrency: store.concurrency,
    autoIntentAnalysis: store.autoIntentAnalysis,
    cleaningMode: store.cleaningMode,
    processMode: store.processMode
  }))
}

beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })
afterEach(() => vi.restoreAllMocks())

describe('配置导入边界', () => {
  it.each([
    { apiPlatform: 'unknown', apiKeys: { aiping: 'bad-key' } },
    { unrelated: true },
    {},
    { rulesConfig: { tooShort: null } },
    { rulesConfig: { tooShort: { enable: 'false' } } },
    { rulesConfig: { duplicate: { minCount: -1 } } },
    { rulesConfig: { adLink: { keywords: [12] } } },
    { rulesConfig: { customFilters: [{ type: 'textContains', config: { keywords: [12] } }] } },
    { rulesConfig: { customFilters: [{ type: 'regexMatch', config: { pattern: '[' } }] } },
    { rulesConfig: { weakPolicy: 'keep' } },
    { concurrency: 0 },
    { concurrency: 101 },
    { autoIntentAnalysis: 'false' },
    { processMode: 'unexpected' },
    { apiKeys: { unknown: 'bad-key' } },
    JSON.parse('{"rulesConfig":{"__proto__":{"polluted":true}}}')
  ])('拒绝无效配置且不部分修改状态：%j', (input) => {
    const store = useSettingsStore()
    store.saveApiKey('aiping', 'existing-key')
    const before = snapshot(store)
    expect(store.importGlobalConfig(input)).toBe(false)
    expect(snapshot(store)).toEqual(before)
    expect({}.polluted).toBeUndefined()
  })

  it('兼容旧版裸清洗规则，补齐规则内部默认字段且不污染默认值', () => {
    const store = useSettingsStore()
    expect(store.importGlobalConfig({ tooShort: { enable: false }, duplicate: { minCount: 5 } })).toBe(true)
    expect(store.rulesConfig.tooShort).toEqual({ enable: false, minLength: 2 })
    expect(store.rulesConfig.duplicate).toEqual({ enable: true, minCount: 5 })
    expect(store.rulesConfig.adLink.keywords).toEqual(DEFAULT_RULES_CONFIG.adLink.keywords)
    store.rulesConfig.adLink.keywords.push('仅属于当前用户')
    expect(DEFAULT_RULES_CONFIG.adLink.keywords).not.toContain('仅属于当前用户')
  })

  it('词库仅导入文本时同步数组，旧版仅导入数组时同步编辑文本', () => {
    const store = useSettingsStore()
    expect(store.importGlobalConfig({ adLink: { keywordsStr: '新增词，另一个' }, shortMeaningless: { phrases: ['你好'] } })).toBe(true)
    expect(store.rulesConfig.adLink.keywords).toEqual(['新增词', '另一个'])
    expect(store.rulesConfig.shortMeaningless.phrasesStr).toBe('你好')
  })

  it('有效自定义规则备份仍可恢复，包含待确认策略与标签列匹配', () => {
    const store = useSettingsStore()
    const customFilters = [{ id: 'rule-1', name: '标签筛选', enabled: true, policy: 'suspect', type: 'labelColumnEquals', config: { outputKey: 'sentiment', values: ['负面'], value: '' } }]
    expect(store.importGlobalConfig({ rulesConfig: { customFilters } })).toBe(true)
    expect(store.rulesConfig.customFilters).toEqual(customFilters)
  })

  it('全量备份、恢复和重置涵盖并发、自动分析与模式', async () => {
    const store = useSettingsStore()
    store.saveApiKey('aiping', 'test-backup-key')
    store.concurrency = 7
    store.autoIntentAnalysis = false
    store.cleaningMode = 'expert'
    store.processMode = 'expert'
    let exportedBlob
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { exportedBlob = blob; return 'blob:test' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    store.exportGlobalConfig()
    const exported = JSON.parse(await exportedBlob.text())
    expect(exported).toMatchObject({ concurrency: 7, autoIntentAnalysis: false, cleaningMode: 'expert', processMode: 'expert', apiKeys: { aiping: 'test-backup-key' } })
    store.resetAllConfig()
    expect(store.concurrency).toBe(3)
    expect(store.autoIntentAnalysis).toBe(true)
    expect(store.processMode).toBe('simple')
    expect(store.apiKey).toBe('')
    expect(store.importGlobalConfig(exported)).toBe(true)
    await nextTick()
    expect(store.concurrency).toBe(7)
    expect(store.autoIntentAnalysis).toBe(false)
    expect(localStorage.getItem('magic_excel_process_mode')).toBe('expert')
    expect(store.apiKey).toBe('test-backup-key')
  })

  it('损坏本地设置不会留下未知平台或缺项规则，合法模型选择不会在刷新时丢失', () => {
    localStorage.setItem('api_platform', 'unknown')
    localStorage.setItem('magic_excel_cleaning_rules', '{"tooShort":{"enable":false}}')
    localStorage.setItem('magic_excel_concurrency', '-4')
    localStorage.setItem('aiping_work_model', 'GLM-4.7')
    const store = useSettingsStore()
    expect(store.currentPlatform).toBe('aiping')
    expect(store.getApiConfig().url).toBeTruthy()
    expect(store.rulesConfig.tooShort.minLength).toBe(2)
    expect(store.concurrency).toBe(3)
    expect(store.workModel).toBe('GLM-4.7')
  })
})
