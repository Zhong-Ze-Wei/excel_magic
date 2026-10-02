import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { DEFAULT_API_PLATFORMS } from '../config/defaultSettings'
import { createDefaultSettings, normalizeSettingsImport } from '../config/settingsConfig'

const API_PLATFORMS = DEFAULT_API_PLATFORMS
const settingStorageKeys = {
  apiPlatform: 'api_platform',
  rulesConfig: 'magic_excel_cleaning_rules',
  concurrency: 'magic_excel_concurrency',
  autoIntentAnalysis: 'auto_intent_analysis',
  cleaningMode: 'magic_excel_cleaning_mode',
  processMode: 'magic_excel_process_mode'
}

function readSavedSettings() {
  let config = createDefaultSettings()
  for (const [field, storageKey] of Object.entries(settingStorageKeys)) {
    const saved = localStorage.getItem(storageKey)
    if (saved === null) continue
    try {
      const value = ['rulesConfig', 'concurrency', 'autoIntentAnalysis'].includes(field) ? JSON.parse(saved) : saved
      config = normalizeSettingsImport({ [field]: value }, config)
    } catch {
      // 旧备份或损坏存储中的单个字段回退默认，其余用户配置仍可恢复。
    }
  }
  for (const platform of Object.keys(API_PLATFORMS)) {
    config.apiKeys[platform] = localStorage.getItem(`${platform}_api_key`) || ''
    for (const [field, suffix] of [['selectedTranslateModel', 'translate_model'], ['selectedWorkModel', 'work_model']]) {
      const saved = localStorage.getItem(`${platform}_${suffix}`)
      if (saved?.trim()) config[field][platform] = saved
    }
  }
  return config
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = readSavedSettings()
  const currentPlatform = ref(initial.apiPlatform)
  const apiKeys = ref(initial.apiKeys)
  const selectedTranslateModel = ref(initial.selectedTranslateModel)
  const selectedWorkModel = ref(initial.selectedWorkModel)
  const rulesConfig = ref(initial.rulesConfig)
  const concurrency = ref(initial.concurrency)
  const autoIntentAnalysis = ref(initial.autoIntentAnalysis)
  const cleaningMode = ref(initial.cleaningMode)
  const processMode = ref(initial.processMode)
  const showSettings = ref(false)
  const lastAiConfigAt = ref(null)

  watch(rulesConfig, value => localStorage.setItem(settingStorageKeys.rulesConfig, JSON.stringify(value)), { deep: true })
  for (const [field, state] of Object.entries({ concurrency, autoIntentAnalysis, cleaningMode, processMode })) {
    watch(state, value => localStorage.setItem(settingStorageKeys[field], String(value)))
  }

  const platformConfig = computed(() => API_PLATFORMS[currentPlatform.value])
  const apiKey = computed(() => apiKeys.value[currentPlatform.value])
  const isConfigured = computed(() => !!apiKey.value)
  const translateModel = computed(() => selectedTranslateModel.value[currentPlatform.value])
  const workModel = computed(() => selectedWorkModel.value[currentPlatform.value])
  const useSystemPrompt = computed(() => translateModel.value !== 'Tencent/Hunyuan-MT-7B')

  function getApiConfig() {
    return {
      url: platformConfig.value.url,
      key: apiKey.value,
      translateModel: translateModel.value,
      workModel: workModel.value,
      useSystemPrompt: useSystemPrompt.value
    }
  }

  function setPlatform(platform) {
    if (!Object.hasOwn(API_PLATFORMS, platform)) return false
    currentPlatform.value = platform
    localStorage.setItem(settingStorageKeys.apiPlatform, platform)
    return true
  }

  function saveApiKey(platform, key) {
    if (!Object.hasOwn(API_PLATFORMS, platform) || typeof key !== 'string') return false
    apiKeys.value[platform] = key
    if (key) localStorage.setItem(`${platform}_api_key`, key)
    else localStorage.removeItem(`${platform}_api_key`)
    return true
  }

  function saveModelSelection(platform, type, modelId) {
    if (!Object.hasOwn(API_PLATFORMS, platform) || !['translate', 'work'].includes(type) || typeof modelId !== 'string' || !modelId.trim()) return false
    const target = type === 'translate' ? selectedTranslateModel : selectedWorkModel
    target.value[platform] = modelId
    localStorage.setItem(`${platform}_${type}_model`, modelId)
    return true
  }

  function getConfigSnapshot() {
    return JSON.parse(JSON.stringify({
      version: '1.1.0',
      apiPlatform: currentPlatform.value,
      apiKeys: apiKeys.value,
      selectedTranslateModel: selectedTranslateModel.value,
      selectedWorkModel: selectedWorkModel.value,
      rulesConfig: rulesConfig.value,
      concurrency: concurrency.value,
      autoIntentAnalysis: autoIntentAnalysis.value,
      cleaningMode: cleaningMode.value,
      processMode: processMode.value
    }))
  }

  function prepareConfigImport(input, base = getConfigSnapshot()) {
    try {
      return normalizeSettingsImport(input, base)
    } catch {
      return null
    }
  }

  function applyConfig(config) {
    setPlatform(config.apiPlatform)
    for (const platform of Object.keys(API_PLATFORMS)) {
      saveApiKey(platform, config.apiKeys[platform])
      saveModelSelection(platform, 'translate', config.selectedTranslateModel[platform])
      saveModelSelection(platform, 'work', config.selectedWorkModel[platform])
    }
    rulesConfig.value = config.rulesConfig
    concurrency.value = config.concurrency
    autoIntentAnalysis.value = config.autoIntentAnalysis
    cleaningMode.value = config.cleaningMode
    processMode.value = config.processMode
    for (const field of ['rulesConfig', 'concurrency', 'autoIntentAnalysis', 'cleaningMode', 'processMode']) {
      localStorage.setItem(settingStorageKeys[field], field === 'rulesConfig' ? JSON.stringify(config[field]) : String(config[field]))
    }
  }

  function importGlobalConfig(parsed) {
    const config = prepareConfigImport(parsed)
    if (!config) return false
    applyConfig(config)
    return true
  }

  function exportGlobalConfig(config = getConfigSnapshot()) {
    const data = normalizeSettingsImport(config)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'magic_excel_config_backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  function resetAllConfig() {
    applyConfig(createDefaultSettings())
    lastAiConfigAt.value = null
  }

  return {
    currentPlatform, platformConfig, apiKey, isConfigured, translateModel, workModel, useSystemPrompt, showSettings,
    selectedTranslateModel, selectedWorkModel, rulesConfig, concurrency, autoIntentAnalysis, cleaningMode, processMode, lastAiConfigAt,
    API_PLATFORMS, getApiConfig, setPlatform, saveApiKey, saveModelSelection,
    getConfigSnapshot, prepareConfigImport, exportGlobalConfig, importGlobalConfig, resetAllConfig
  }
})
