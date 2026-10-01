/**
 * AI 服务兼容入口：从 settings 取得配置，再委托给独立请求和批处理模块。
 */
import { useSettingsStore } from '../stores/settings'
import { requestCompletion, requestStreamingCompletion, testApiConnection } from './ai/client'
import { executeAIBatch } from './ai/batch'

export { createSemaphore } from './ai/batch'

export async function callAI(content, systemPrompt, modelOverride) {
  const config = useSettingsStore().getApiConfig()
  return requestCompletion(config, content, systemPrompt, modelOverride)
}

export async function callStreamingAI(systemPrompt, userPrompt, onChunk, modelOverride) {
  const config = useSettingsStore().getApiConfig()
  return requestStreamingCompletion(config, systemPrompt, userPrompt, onChunk, modelOverride)
}

export async function callAIBatch(tasks, onProgress, concurrency = 3, modelOverride) {
  // 每个任务实际开始请求时再读取设置，保持原有配置读取时机。
  return executeAIBatch(
    tasks,
    task => callAI(task.content, task.systemPrompt, modelOverride),
    onProgress,
    concurrency
  )
}

export async function testConnection(platform, key) {
  const config = useSettingsStore().API_PLATFORMS[platform]
  return testApiConnection(config, key)
}
