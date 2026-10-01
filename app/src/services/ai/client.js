/**
 * AI HTTP 客户端。配置由调用方传入，不读取 Vue、Pinia 或本地存储。
 */

/**
 * 调用 AI 模型（非流式）
 * @param {object} config - { url, key, workModel, useSystemPrompt }
 */
export async function requestCompletion(config, content, systemPrompt, modelOverride) {
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
      model: modelOverride || config.workModel,
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
 * @param {object} config - { url, key, workModel }
 */
export async function requestStreamingCompletion(config, systemPrompt, userPrompt, onChunk, modelOverride) {
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
 * @param {object} config - { url, translateModels }
 */
export async function testApiConnection(config, key) {
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
