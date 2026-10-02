import { ref, watch, onScopeDispose } from 'vue'
import { useDataShareStore } from '../stores/dataShare'

// 一个异步操作只属于启动时的数据集；取消后不再提交结果。
export function useDatasetTask() {
  const dataShare = useDataShareStore()
  const isRunning = ref(false)
  let activeController = null

  function cancel() {
    activeController?.abort()
    activeController = null
    isRunning.value = false
  }

  async function run(callback) {
    cancel()
    const controller = new AbortController()
    const version = dataShare.datasetVersion
    activeController = controller
    isRunning.value = true
    try {
      const result = await callback({ signal: controller.signal })
      if (activeController === controller && version === dataShare.datasetVersion) return result
    } catch (error) {
      if (activeController === controller && !controller.signal.aborted) throw error
    } finally {
      if (activeController === controller) {
        activeController = null
        isRunning.value = false
      }
    }
  }

  watch(() => dataShare.datasetVersion, cancel, { flush: 'sync' })
  onScopeDispose(cancel)
  return { isRunning, run, cancel }
}
