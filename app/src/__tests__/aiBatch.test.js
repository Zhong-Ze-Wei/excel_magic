import { describe, it, expect, vi } from 'vitest'
import { createSemaphore, executeAIBatch } from '../services/ai/batch'

describe('createSemaphore', () => {
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
