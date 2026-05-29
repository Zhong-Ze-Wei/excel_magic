import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { DEFAULT_API_PLATFORMS, DEFAULT_RULES_CONFIG } from '../config/defaultSettings'

const API_PLATFORMS = DEFAULT_API_PLATFORMS

export const useSettingsStore = defineStore('settings', () => {
  // 当前选中的平台
  const currentPlatform = ref(localStorage.getItem('api_platform') || 'aiping')
  // 各平台选中的翻译模型 ID
  const selectedTranslateModel = ref({
    siliconflow: localStorage.getItem('siliconflow_translate_model') || 'deepseek-ai/DeepSeek-V3',
    aiping: (localStorage.getItem('aiping_translate_model') === 'GLM-4.7' || !localStorage.getItem('aiping_translate_model')) ? 'DeepSeek-V4-Flash' : localStorage.getItem('aiping_translate_model')
  })
  // 各平台选中的分析模型 ID
  const selectedWorkModel = ref({
    siliconflow: localStorage.getItem('siliconflow_work_model') || 'deepseek-ai/DeepSeek-V3',
    aiping: (localStorage.getItem('aiping_work_model') === 'GLM-4.7' || !localStorage.getItem('aiping_work_model')) ? 'DeepSeek-V4-Flash' : localStorage.getItem('aiping_work_model')
  })
  // 设置弹窗是否打开
  const showSettings = ref(false)

  // 默认的数据清洗配置参数定义与持久化
  const getLocalRulesConfig = () => {
    const local = localStorage.getItem('magic_excel_cleaning_rules')
    if (local) {
      try {
        const parsed = JSON.parse(local)
        // 合并默认配置防缺项
        return Object.assign({}, DEFAULT_RULES_CONFIG, parsed)
      } catch (e) {
        console.warn('解析本地清洗配置失败:', e)
      }
    }
    return JSON.parse(JSON.stringify(DEFAULT_RULES_CONFIG))
  }
  const rulesConfig = ref(getLocalRulesConfig())

  watch(rulesConfig, (newVal) => {
    localStorage.setItem('magic_excel_cleaning_rules', JSON.stringify(newVal))
  }, { deep: true })

  // 各平台 API Key 的响应式状态
  const apiKeys = ref({
    siliconflow: localStorage.getItem('siliconflow_api_key') || '',
    aiping: localStorage.getItem('aiping_api_key') || ''
  })

  // AI 并发调用数（持久化）
  const concurrency = ref(parseInt(localStorage.getItem('magic_excel_concurrency')) || 3)
  watch(concurrency, (v) => localStorage.setItem('magic_excel_concurrency', String(v)))

  // 当前平台的完整配置
  const platformConfig = computed(() => API_PLATFORMS[currentPlatform.value])
  // 当前的 API Key
  const apiKey = computed(() => apiKeys.value[currentPlatform.value] || '')
  // 是否已配置
  const isConfigured = computed(() => !!apiKey.value)
  // 当前翻译模型
  const translateModel = computed(() => selectedTranslateModel.value[currentPlatform.value])
  // 当前分析模型
  const workModel = computed(() => selectedWorkModel.value[currentPlatform.value])
  // 是否需要 system prompt
  const useSystemPrompt = computed(() => {
    const model = translateModel.value
    // 腾讯翻译专用模型不需要 system prompt
    if (model === 'Tencent/Hunyuan-MT-7B') return false
    return true
  })

  // 获取完整 API 调用配置
  function getApiConfig() {
    const config = API_PLATFORMS[currentPlatform.value]
    return {
      url: config.url,
      key: apiKey.value,
      translateModel: translateModel.value,
      workModel: workModel.value,
      useSystemPrompt: useSystemPrompt.value
    }
  }

  // 切换平台
  function setPlatform(platform) {
    currentPlatform.value = platform
    localStorage.setItem('api_platform', platform)
  }

  // 保存 API Key
  function saveApiKey(platform, key) {
    localStorage.setItem(`${platform}_api_key`, key)
    apiKeys.value[platform] = key
  }

  // 保存模型选择
  function saveModelSelection(platform, type, modelId) {
    if (type === 'translate') {
      selectedTranslateModel.value[platform] = modelId
      localStorage.setItem(`${platform}_translate_model`, modelId)
    } else {
      selectedWorkModel.value[platform] = modelId
      localStorage.setItem(`${platform}_work_model`, modelId)
    }
  }

  // 导出全局配置备份 JSON
  function exportGlobalConfig() {
    const configData = {
      version: '1.0.0',
      apiPlatform: currentPlatform.value,
      apiKeys: apiKeys.value,
      selectedTranslateModel: selectedTranslateModel.value,
      selectedWorkModel: selectedWorkModel.value,
      rulesConfig: rulesConfig.value
    }
    const dataStr = JSON.stringify(configData, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `magic_excel_config_backup.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // 导入全局配置备份 JSON
  function importGlobalConfig(parsed) {
    if (!parsed) return false
    
    if (parsed.apiPlatform) {
      currentPlatform.value = parsed.apiPlatform
      localStorage.setItem('api_platform', parsed.apiPlatform)
    }
    if (parsed.apiKeys) {
      Object.assign(apiKeys.value, parsed.apiKeys)
      for (const key in parsed.apiKeys) {
        localStorage.setItem(`${key}_api_key`, parsed.apiKeys[key])
      }
    }
    if (parsed.selectedTranslateModel) {
      Object.assign(selectedTranslateModel.value, parsed.selectedTranslateModel)
      for (const p in parsed.selectedTranslateModel) {
        localStorage.setItem(`${p}_translate_model`, parsed.selectedTranslateModel[p])
      }
    }
    if (parsed.selectedWorkModel) {
      Object.assign(selectedWorkModel.value, parsed.selectedWorkModel)
      for (const p in parsed.selectedWorkModel) {
        localStorage.setItem(`${p}_work_model`, parsed.selectedWorkModel[p])
      }
    }
    if (parsed.rulesConfig) {
      rulesConfig.value = Object.assign({}, DEFAULT_RULES_CONFIG, parsed.rulesConfig)
      localStorage.setItem('magic_excel_cleaning_rules', JSON.stringify(rulesConfig.value))
    }
    return true
  }

  // 重置系统所有配置为出厂默认值
  function resetAllConfig() {
    currentPlatform.value = 'aiping'
    localStorage.setItem('api_platform', 'aiping')
    
    apiKeys.value = { siliconflow: '', aiping: '' }
    localStorage.removeItem('siliconflow_api_key')
    localStorage.removeItem('aiping_api_key')
    
    selectedTranslateModel.value = {
      siliconflow: 'deepseek-ai/DeepSeek-V3',
      aiping: 'DeepSeek-V4-Flash'
    }
    localStorage.removeItem('siliconflow_translate_model')
    localStorage.removeItem('aiping_translate_model')
    
    selectedWorkModel.value = {
      siliconflow: 'deepseek-ai/DeepSeek-V3',
      aiping: 'DeepSeek-V4-Flash'
    }
    localStorage.removeItem('siliconflow_work_model')
    localStorage.removeItem('aiping_work_model')
    
    rulesConfig.value = JSON.parse(JSON.stringify(DEFAULT_RULES_CONFIG))
    localStorage.setItem('magic_excel_cleaning_rules', JSON.stringify(rulesConfig.value))
  }

  return {
    currentPlatform, platformConfig, apiKey, isConfigured,
    translateModel, workModel, useSystemPrompt, showSettings,
    selectedTranslateModel, selectedWorkModel, rulesConfig, concurrency,
    API_PLATFORMS, getApiConfig, setPlatform, saveApiKey, saveModelSelection,
    exportGlobalConfig, importGlobalConfig, resetAllConfig
  }
})
