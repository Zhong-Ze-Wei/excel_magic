import { describe, it, expect, vi } from 'vitest'
import { createSemaphore, executeAIBatch } from '../services/ai/batch'

describe('createSemaphore', () => {
  it.each([0, -1, 1.5, NaN, Infinity, '2'])('拒绝非法并发数 %s', max => {
    expect(() => createSemaphore(max)).toThrow('并发数必须是大于 0 的整数')
  })
  it('限制并发数', async () => {
    const sem = createSemaphore(2)
    const running = []
    const maxConcurrent = []

    const task = async (id) => {
      await sem.acquire()
      running.push(id)
      maxConcurrent.push(running.length)
      await new Promise(r => setTimeout(r, 10))
      running.splice(running.indexOf(id), 1)
      sem.release()
    }

    await Promise.all([task(1), task(2), task(3), task(4)])
    // 最大并发不应超过 2
    expect(Math.max(...maxConcurrent)).toBeLessThanOrEqual(2)
  })

  it('acquire/release 正确配对', async () => {
    const sem = createSemaphore(1)
    await sem.acquire()
    // 第二次 acquire 应该阻塞
    let resolved = false
    const p = sem.acquire().then(() => { resolved = true })
    // 立即检查，应该还没 resolve
    await new Promise(r => setTimeout(r, 5))
    expect(resolved).toBe(false)
    sem.release()
    await p
    expect(resolved).toBe(true)
  })
})

describe('executeAIBatch', () => {
  it('连续 429 降并发后仍完成所有等待任务', async () => {
    const progress = vi.fn()
    let timer
    const batch = executeAIBatch(Array.from({ length: 8 }, (_, i) => i), async index => {
      if (index < 2) throw new Error('429 Too Many Requests')
      return index
    }, progress, 2)
    const result = await Promise.race([batch, new Promise(resolve => { timer = setTimeout(() => resolve('stalled'), 200) })])
    clearTimeout(timer)
    expect(result).not.toBe('stalled')
    expect(result.finalConcurrency).toBe(1)
    expect(result.results.map(r => r.ok)).toEqual([false, false, true, true, true, true, true, true])
    expect(progress).toHaveBeenCalledTimes(8)
  })

  it('按 HTTP 状态识别限流，降并发后等待已有请求释放容量', async () => {
    let active = 0, limit = 4
    const starts = []
    const result = await executeAIBatch(Array.from({ length: 10 }, (_, i) => i), async index => {
      active++
      starts.push({ index, active, limit })
      await new Promise(resolve => setTimeout(resolve, index < 2 ? 1 : 5))
      active--
      if (index < 2) throw Object.assign(new Error('请求过于频繁'), { status: 429 })
      return index
    }, (_index, _result, _error, meta) => { limit = meta.concurrency }, 4)
    expect(result.finalConcurrency).toBe(2)
    expect(starts).toHaveLength(10)
    expect(starts.filter(s => s.index >= 4).every(s => s.active <= s.limit)).toBe(true)
  })

  it.each([0, -2, 0.5, NaN, Infinity])('批次拒绝非法并发数 %s 而不是挂起', async concurrency => {
    const execute = vi.fn()
    let timer
    const outcome = await Promise.race([
      executeAIBatch([1], execute, null, concurrency).then(() => 'resolved', error => error.message),
      new Promise(resolve => { timer = setTimeout(() => resolve('stalled'), 100) })
    ])
    clearTimeout(timer)
    expect(outcome).toBe('并发数必须是大于 0 的整数')
    expect(execute).not.toHaveBeenCalled()
  })

  it('取消后停止排队任务，不再回调已过时的结果', async () => {
    const controller = new AbortController()
    let finish
    const execute = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const progress = vi.fn()
    const batch = executeAIBatch([1, 2, 3], execute, progress, 1, { signal: controller.signal })
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    const rejection = expect(batch).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    finish('late result')
    await rejection
    expect(execute).toHaveBeenCalledTimes(1)
    expect(progress).not.toHaveBeenCalled()
  })

  it('已经取消的批次不执行任何任务', async () => {
    const controller = new AbortController()
    controller.abort()
    const execute = vi.fn()
    await expect(executeAIBatch([1], execute, null, 1, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('执行函数同步取消时不会继续派发初始并发槽', async () => {
    const controller = new AbortController()
    const execute = vi.fn(() => { controller.abort(); return 'late' })
    await expect(executeAIBatch([1, 2, 3], execute, null, 3, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('进度回调抛错时整体拒绝且不把成功项重复回调为失败', async () => {
    const error = new Error('progress failed')
    const progress = vi.fn(() => { throw error })
    await expect(executeAIBatch([1, 2], async n => n, progress, 1)).rejects.toBe(error)
    expect(progress).toHaveBeenCalledTimes(1)
  })

  it('单个任务失败后继续执行其余任务，并按输入顺序返回结果', async () => {
    const failure = new Error('invalid result')
    const executeTask = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce('second result')
    const onProgress = vi.fn()
    const tasks = [{ content: 'first' }, { content: 'second' }]

    const result = await executeAIBatch(tasks, executeTask, onProgress, 1)

    expect(executeTask.mock.calls).toEqual([[tasks[0]], [tasks[1]]])
    expect(result).toEqual({
      results: [{ ok: false, error: 'invalid result' }, { ok: true, data: 'second result' }],
      finalConcurrency: 1
    })
    expect(onProgress.mock.calls).toEqual([
      [0, null, failure, { concurrency: 1 }],
      [1, 'second result', null, { concurrency: 1 }]
    ])
  })
})
