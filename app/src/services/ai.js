/**
 * AI API 调用服务 — 从 v2 的 callAI / callStreamingAPI 迁移
 */
import { useSettingsStore } from '../stores/settings'

/**
 * 创建信号量，用于限制并发数
 */
export function createSemaphore(max) {
  let current = 0
  const queue = []

  function acquire() {
    return new Promise(resolve => {
      if (current < max) {
        current++
        resolve()
      } else {
        queue.push(resolve)
      }
    })
  }

  function release() {
    if (queue.length > 0) {
      const next = queue.shift()
      next()
    } else {
      current--
    }
  }

  return { acquire, release }
}

/**
 * 批量调用 AI，支持并发控制
 * @param {Array} tasks - [{content, systemPrompt}] 数组
 * @param {Function} onProgress - (index, result) 进度回调
 * @param {number} concurrency - 最大并发数，默认 3
 * @param {string} modelOverride - 模型覆盖
 * @returns {Promise<Array>} 每个任务的结果
 */
export async function callAIBatch(tasks, onProgress, concurrency = 3, modelOverride) {
  const sem = createSemaphore(concurrency)
  const results = new Array(tasks.length)

  await Promise.all(tasks.map(async (task, i) => {
    await sem.acquire()
    try {
      const result = await callAI(task.content, task.systemPrompt, modelOverride)
      results[i] = { ok: true, data: result }
      if (onProgress) onProgress(i, result)
    } catch (e) {
      results[i] = { ok: false, error: e.message }
      if (onProgress) onProgress(i, null, e)
    } finally {
      sem.release()
    }
  }))

  return results
}

/**
 * 调用 AI 模型（非流式）
 */
export async function callAI(content, systemPrompt, modelOverride) {
  const store = useSettingsStore()
  const config = store.getApiConfig()

  if (!config.key) throw new Error('请先配置 API 密钥')

  const messages = config.useSystemPrompt
    ? [{ role: 'system', content: systemPrompt }, { role: 'user', content }]
    : [{ role: 'user', content }]

  const resp = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelOverride || config.translateModel,
      messages,
      temperature: 0.3,
      max_tokens: 2048
    })
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `API Error ${resp.status}`)
  }

  const json = await resp.json()
  return json.choices[0].message.content.trim()
}

/**
 * 调用 AI 模型（流式）
 */
export async function callStreamingAI(systemPrompt, userPrompt, onChunk, modelOverride) {
  const store = useSettingsStore()
  const config = store.getApiConfig()

  if (!config.key) throw new Error('请先配置 API 密钥')

  const resp = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelOverride || config.workModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4096,
      stream: true
    })
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`API Error: ${resp.status} - ${errText.slice(0, 100)}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const content = json.choices[0]?.delta?.content || ''
          if (content) onChunk(content)
        } catch {}
      }
    }
  }
}

/**
 * 测试 API 连通性
 */
export async function testConnection(platform, key) {
  const store = useSettingsStore()
  const config = store.API_PLATFORMS[platform]

  const messages = [{ role: 'user', content: 'Hi' }]

  const resp = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.translateModels[0].id,
      messages,
      max_tokens: 5
    })
  })

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({}))
    throw new Error(error.error?.message || `${resp.status}`)
  }
  return true
}
