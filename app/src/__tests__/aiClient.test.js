// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestCompletion, requestStreamingCompletion, testApiConnection } from '../services/ai/client'
import { callAI, callAIBatch, callStreamingAI, testConnection } from '../services/ai'

const { settings } = vi.hoisted(() => ({
  settings: { getApiConfig: vi.fn(), API_PLATFORMS: {} }
}))

vi.mock('../stores/settings', () => ({ useSettingsStore: () => settings }))

const config = {
  url: 'https://example.invalid/chat/completions',
  key: 'test-key',
  workModel: 'work-model',
  useSystemPrompt: true
}

function completionResponse(content = ' result ') {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }))
}

function streamResponse() {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"第一段"}}]}\n\n'))
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"第二段"}}]}\n\ndata: [DONE]\n\n'))
      controller.close()
    }
  }))
}

beforeEach(() => {
  settings.getApiConfig.mockReset().mockReturnValue(config)
  settings.API_PLATFORMS = {
    test: { url: config.url, translateModels: [{ id: 'translation-model' }] }
  }
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => vi.unstubAllGlobals())

describe('独立 AI HTTP 客户端', () => {
  it.each([
    { useSystemPrompt: true, modelOverride: undefined, model: 'work-model' },
    { useSystemPrompt: false, modelOverride: 'override-model', model: 'override-model' }
  ])('使用传入的配置构造请求：$useSystemPrompt / $model', async ({ useSystemPrompt, modelOverride, model }) => {
    fetch.mockResolvedValue(completionResponse())

    const result = await requestCompletion({ ...config, useSystemPrompt }, 'input', 'instruction', modelOverride)

    expect(result).toBe('result')
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe(config.url)
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json'
    })
    expect(JSON.parse(options.body)).toEqual({
      model,
      messages: useSystemPrompt
        ? [{ role: 'system', content: 'instruction' }, { role: 'user', content: 'input' }]
        : [{ role: 'user', content: 'input' }],
      temperature: 0.3,
      max_tokens: 2048
    })
    expect(settings.getApiConfig).not.toHaveBeenCalled()
  })

  it('缺少密钥时不发起普通或流式请求', async () => {
    const missingKey = { ...config, key: '' }
    await expect(requestCompletion(missingKey, 'input', 'instruction')).rejects.toThrow('请先配置 API 密钥')
    await expect(requestStreamingCompletion(missingKey, 'instruction', 'input', vi.fn())).rejects.toThrow('请先配置 API 密钥')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['{"error":{"message":"provider error"}}', 'provider error'],
    ['not JSON', 'API Error 503']
  ])('保留普通请求的错误文案：%s', async (body, message) => {
    fetch.mockResolvedValue(new Response(body, { status: 503 }))
    await expect(requestCompletion(config, 'input', 'instruction')).rejects.toThrow(message)
  })

  it('保持流式请求参数、system prompt 策略和逐段回调', async () => {
    fetch.mockResolvedValue(streamResponse())
    const onChunk = vi.fn()

    await requestStreamingCompletion({ ...config, useSystemPrompt: false }, 'instruction', 'input', onChunk, 'stream-model')

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      model: 'stream-model',
      messages: [{ role: 'system', content: 'instruction' }, { role: 'user', content: 'input' }],
      temperature: 0.7,
      max_tokens: 4096,
      stream: true
    })
    expect(onChunk.mock.calls).toEqual([['第一段'], ['第二段']])
  })

  it('保留流式请求错误文案及响应截断', async () => {
    fetch.mockResolvedValue(new Response('x'.repeat(120), { status: 502 }))
    await expect(requestStreamingCompletion(config, 'instruction', 'input', vi.fn()))
      .rejects.toThrow(`API Error: 502 - ${'x'.repeat(100)}`)
  })

  it('连通性测试使用传入平台的首个翻译模型和密钥', async () => {
    fetch.mockResolvedValue(new Response(''))
    expect(await testApiConnection(settings.API_PLATFORMS.test, 'probe-key')).toBe(true)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe(config.url)
    expect(options.headers.Authorization).toBe('Bearer probe-key')
    expect(JSON.parse(options.body)).toEqual({
      model: 'translation-model',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5
    })
  })
})

describe('现有 AI 服务入口兼容性', () => {
  it('普通、流式和连通性入口与独立客户端发出相同请求', async () => {
    fetch.mockImplementation(() => Promise.resolve(completionResponse()))
    expect(await callAI('input', 'instruction', 'override')).toBe('result')
    await requestCompletion(config, 'input', 'instruction', 'override')
    expect(fetch.mock.calls[0]).toEqual(fetch.mock.calls[1])

    fetch.mockClear().mockImplementation(() => Promise.resolve(streamResponse()))
    const adapterChunks = vi.fn()
    const clientChunks = vi.fn()
    await callStreamingAI('instruction', 'input', adapterChunks, 'override')
    await requestStreamingCompletion(config, 'instruction', 'input', clientChunks, 'override')
    expect(fetch.mock.calls[0]).toEqual(fetch.mock.calls[1])
    expect(adapterChunks.mock.calls).toEqual(clientChunks.mock.calls)

    fetch.mockClear().mockImplementation(() => Promise.resolve(new Response('')))
    expect(await testConnection('test', 'probe-key')).toBe(true)
    await testApiConnection(settings.API_PLATFORMS.test, 'probe-key')
    expect(fetch.mock.calls[0]).toEqual(fetch.mock.calls[1])
    expect(settings.getApiConfig).toHaveBeenCalledTimes(2)
  })

  it('批处理在每个任务开始请求时读取配置，并保留进度和结果契约', async () => {
    fetch.mockImplementation(() => Promise.resolve(completionResponse()))
    const onProgress = vi.fn(() => {
      settings.getApiConfig.mockReturnValue({ ...config, key: 'changed-key', workModel: 'changed-model' })
    })

    const result = await callAIBatch([
      { content: 'row 1', systemPrompt: 'instruction' },
      { content: 'row 2', systemPrompt: 'instruction' }
    ], onProgress, 1, 'batch-model')

    expect(settings.getApiConfig).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls.map(([, options]) => options.headers.Authorization))
      .toEqual(['Bearer test-key', 'Bearer changed-key'])
    expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body).model))
      .toEqual(['batch-model', 'batch-model'])
    expect(onProgress.mock.calls).toEqual([
      [0, 'result', null, { concurrency: 1 }],
      [1, 'result', null, { concurrency: 1 }]
    ])
    expect(result).toEqual({
      results: [{ ok: true, data: 'result' }, { ok: true, data: 'result' }],
      finalConcurrency: 1
    })
  })
})
