/**
 * 创建信号量，用于限制并发数
 */
export function createSemaphore(max) {
  validateConcurrency(max)
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
export async function executeAIBatch(tasks, executeTask, onProgress, concurrency = 3, { signal } = {}) {
  validateConcurrency(concurrency)
  signal?.throwIfAborted()
  let currentConcurrency = concurrency
  const results = new Array(tasks.length)
  let consecutiveErrors = 0
  let nextIndex = 0
  let active = 0
  let completed = 0

  return new Promise((resolve, reject) => {
    let settled = false

    function finish(error) {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      if (error) reject(error)
      else resolve({ results, finalConcurrency: currentConcurrency })
    }

    function onAbort() {
      finish(signal.reason)
    }

    function schedule() {
      if (settled) return
      if (completed === tasks.length) {
        finish()
        return
      }
      // 降低容量只影响后续派发，已运行任务和等待任务始终属于同一队列。
      while (!settled && active < currentConcurrency && nextIndex < tasks.length) {
        const index = nextIndex++
        active++
        runTask(index).catch(finish)
      }
    }

    async function runTask(index) {
      let result, error
      try {
        result = await executeTask(tasks[index])
      } catch (failure) {
        error = failure
      }
      active--
      if (settled) return
      if (error?.name === 'AbortError') {
        finish(error)
        return
      }

      if (error) {
        results[index] = { ok: false, error: error.message }
        if (error.status === 429 || /429|rate|limit|too many/i.test(error.message)) {
          consecutiveErrors++
          if (currentConcurrency > 1 && consecutiveErrors >= 2) {
            currentConcurrency = Math.max(1, Math.ceil(currentConcurrency / 2))
            consecutiveErrors = 0
          }
        }
      } else {
        results[index] = { ok: true, data: result }
        consecutiveErrors = 0
      }

      try {
        if (onProgress) onProgress(index, error ? null : result, error || null, { concurrency: currentConcurrency })
      } catch (failure) {
        finish(failure)
        return
      }
      completed++
      schedule()
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    schedule()
  })
}

function validateConcurrency(value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError('并发数必须是大于 0 的整数')
  }
}
