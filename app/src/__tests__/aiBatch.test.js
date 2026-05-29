import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSemaphore } from '../services/ai'

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
