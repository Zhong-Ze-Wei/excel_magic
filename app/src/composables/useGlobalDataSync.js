import { ref, onMounted, watch, computed } from 'vue'
import { useDataShareStore } from '../stores/dataShare'

/**
 * 全局数据同步 composable
 * 封装 onMounted + watch(rows.length) + importGlobalExcel + disconnectGlobalExcel
 *
 * @param {Object} options
 * @param {Function} options.onInit - 从 store 导入数据后的初始化回调 (headers, rows) => void
 * @returns {{ headers, rows, hasData, importGlobalExcel, disconnectGlobalExcel }}
 */
export function useGlobalDataSync(options = {}) {
  const dataShare = useDataShareStore()
  const headers = ref([])
  const rows = ref([])

  const hasData = computed(() => rows.value.length > 0)

  function importGlobalExcel() {
    headers.value = [...dataShare.headers]
    rows.value = dataShare.rows.map(r => [...r])
    if (options.onInit) options.onInit(headers.value, rows.value)
  }

  function disconnectGlobalExcel() {
    dataShare.clearSharedData()
    headers.value = []
    rows.value = []
    if (options.onInit) options.onInit([], [])
  }

  onMounted(() => {
    if (dataShare.hasData && rows.value.length === 0) {
      importGlobalExcel()
    }
  })

  // store 数据变化时自动同步（解决 keep-alive 下 onMounted 只触发一次的问题）
  // 同时监听 rows.length 和 headers.length：清洗改行数、加工改列数，都要触发同步
  watch(() => [dataShare.rows.length, dataShare.headers.length], ([newRowLen]) => {
    if (newRowLen > 0) {
      importGlobalExcel()
    }
  })

  return { headers, rows, hasData, importGlobalExcel, disconnectGlobalExcel }
}
