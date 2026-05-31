import { exportToXlsx } from '../services/excel'

/**
 * 导出 composable
 * 封装"无数据则 return + exportToXlsx"的通用模式
 *
 * @param {{ rows: Ref<Array>, headers: Ref<Array> }} params
 * @returns {{ exportData }}
 */
export function useExport({ rows, headers }) {
  function exportData(getRows, filename, getHeaders) {
    if (!rows.value.length) return
    const expHeaders = getHeaders ? getHeaders() : [...headers.value]
    const expRows = getRows()
    exportToXlsx(expHeaders, expRows, filename)
  }

  return { exportData }
}
