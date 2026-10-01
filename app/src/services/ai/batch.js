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
 * 批量调用 AI，支持并发控制和 429 自动降级
 * @param {Array} tasks - [{content, systemPrompt}] 数组
 * @param {Function} executeTask - (task) 单次任务执行函数
 * @param {Function} onProgress - (index, result, error, meta) 进度回调
 * @param {number} concurrency - 最大并发数，默认 3
 * @returns {Promise<{results: Array, finalConcurrency: number}>}
 */
export async function executeAIBatch(tasks, executeTask, onProgress, concurrency = 3) {
  let currentConcurrency = concurrency
  let sem = createSemaphore(currentConcurrency)
  const results = new Array(tasks.length)
  let consecutiveErrors = 0

  async function runTask(task, i) {
    await sem.acquire()
    try {
      const result = await executeTask(task)
      results[i] = { ok: true, data: result }
      consecutiveErrors = 0
      if (onProgress) onProgress(i, result, null, { concurrency: currentConcurrency })
    } catch (e) {
      results[i] = { ok: false, error: e.message }
      // 429 或网络错误：自动降级并发数
      if (e.message.includes('429') || e.message.includes('rate') || e.message.includes('limit') || e.message.includes('Too Many')) {
        consecutiveErrors++
        if (currentConcurrency > 1 && consecutiveErrors >= 2) {
          currentConcurrency = Math.max(1, Math.ceil(currentConcurrency / 2))
          sem = createSemaphore(currentConcurrency)
          consecutiveErrors = 0
        }
      }
      if (onProgress) onProgress(i, null, e, { concurrency: currentConcurrency })
    } finally {
      sem.release()
    }
  }

  await Promise.all(tasks.map((task, i) => runTask(task, i)))

  return { results, finalConcurrency: currentConcurrency }
}
