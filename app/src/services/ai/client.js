/**
 * AI HTTP 客户端。配置由调用方传入，不读取 Vue、Pinia 或本地存储。
 */

/**
 * 调用 AI 模型（非流式）
 * @param {object} config - { url, key, workModel, useSystemPrompt }
 */
export async function requestCompletion(config, content, systemPrompt, modelOverride, { signal } = {}) {
  if (!config.key) throw new Error('请先配置 API 密钥')
  signal?.throwIfAborted()

  const messages = config.useSystemPrompt
    ? [{ role: 'system', content: systemPrompt }, { role: 'user', content }]
    : [{ role: 'user', content }]

  const resp = await fetch(config.url, {
    method: 'POST',
    signal,
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
    signal?.throwIfAborted()
    throw Object.assign(new Error(err.error?.message || `API Error ${resp.status}`), { status: resp.status })
  }

  const json = await resp.json()
  signal?.throwIfAborted()
  return json.choices[0].message.content.trim()
}

/**
 * 调用 AI 模型（流式）
 * @param {object} config - { url, key, workModel }
 */
export async function requestStreamingCompletion(config, systemPrompt, userPrompt, onChunk, modelOverride, { signal } = {}) {
  if (!config.key) throw new Error('请先配置 API 密钥')
  signal?.throwIfAborted()

  const resp = await fetch(config.url, {
    method: 'POST',
    signal,
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
    signal?.throwIfAborted()
    throw Object.assign(new Error(`API Error: ${resp.status} - ${errText.slice(0, 100)}`), { status: resp.status })
  }

  if (!resp.body) throw new Error('AI 流式响应缺少可读取内容')
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  const parser = createStreamParser(chunk => {
    signal?.throwIfAborted()
    onChunk(chunk)
    signal?.throwIfAborted()
  })
  let reachedEOF = false
  let cancellation

  function cancelReader() {
    // 已失败的流在取消时可能再次拒绝；保留原读取、解析或回调错误。
    cancellation ??= reader.cancel().catch(() => {})
    return cancellation
  }

  signal?.addEventListener('abort', cancelReader, { once: true })
  try {
    signal?.throwIfAborted()
    while (true) {
      const { done, value } = await reader.read()
      signal?.throwIfAborted()
      if (done) {
        reachedEOF = true
        parser.push(decoder.decode(), true)
        break
      }
      if (parser.push(decoder.decode(value, { stream: true }))) break
    }
  } finally {
    signal?.removeEventListener('abort', cancelReader)
    if (!reachedEOF) await cancelReader()
    reader.releaseLock()
  }
}

/** 按 SSE 事件边界解析，独立保留未完成的行和同一事件中的多行 data。 */
function createStreamParser(onChunk) {
  let buffer = ''
  let dataLines = []
  let eventName = ''

  function dispatch() {
    const data = dataLines.join('\n')
    const event = eventName
    dataLines = []
    eventName = ''
    if (!data) return false
    if (data.trim() === '[DONE]') return true

    let json
    try {
      json = JSON.parse(data)
    } catch (cause) {
      throw new Error('AI 流式响应不是有效的 JSON', { cause })
    }
    if (event === 'error' || json.error) {
      throw new Error(json.error?.message || json.message || data)
    }
    const content = json.choices?.[0]?.delta?.content
    if (content) onChunk(content)
    return false
  }

  function readLine(line) {
    if (!line) return dispatch()
    if (line.startsWith(':')) return false
    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    let value = separator === -1 ? '' : line.slice(separator + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') dataLines.push(value)
    else if (field === 'event') eventName = value
    return false
  }

  function push(text, final = false) {
    buffer += text
    let separator
    while ((separator = /\r\n|\r|\n/.exec(buffer))) {
      // CRLF 可被分在两个网络 chunk；保留末尾 CR 等待下一个字节。
      if (!final && separator[0] === '\r' && separator.index === buffer.length - 1) break
      const line = buffer.slice(0, separator.index)
      buffer = buffer.slice(separator.index + separator[0].length)
      if (readLine(line)) return true
    }
    if (final) {
      if (buffer && readLine(buffer)) return true
      buffer = ''
      return dispatch()
    }
    return false
  }

  return { push }
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
