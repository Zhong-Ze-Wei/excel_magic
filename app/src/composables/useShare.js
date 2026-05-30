import { useRouter } from 'vue-router'
import { useDataShareStore } from '../stores/dataShare'
import { useToast } from '../services/toast'

/**
 * 共享 composable
 * 封装 setSharedData + 跳转 / 应用到全局的通用模式
 *
 * @param {{ rows: Ref<Array>, headers: Ref<Array>, importGlobalExcel?: Function }} params
 * @returns {{ shareTo, applyToGlobal }}
 */
export function useShare({ rows, headers, importGlobalExcel }) {
  const router = useRouter()
  const dataShare = useDataShareStore()
  const toast = useToast()

  function shareTo(getData, targetPath, sourceName) {
    if (!rows.value.length) return
    const { headers: h, rows: r } = getData()
    dataShare.setSharedData(h, r, sourceName || '共享数据')
    router.push(targetPath)
  }

  function applyToGlobal(getData, sourceName) {
    if (!rows.value.length) return
    const { headers: h, rows: r } = getData()
    dataShare.setSharedData(h, r, sourceName || dataShare.sourceName || '已处理数据')
    if (importGlobalExcel) importGlobalExcel()
    toast.success('数据已应用到全局')
  }

  return { shareTo, applyToGlobal }
}
