import { ref } from 'vue'
import { useDataShareStore } from '../stores/dataShare'
import { useImportIntentStore } from '../stores/importIntent'
import { readFile } from '../services/excel'
import { useToast } from '../services/toast'

/**
 * 文件上传 composable
 * 封装 readFile + setSharedData + 错误处理 + 触发意图弹窗
 *
 * @param {Object} options
 * @param {Function} options.onFileLoaded - 文件加载后的回调 (data) => void
 *   data 包含 { headers, rows, sheetNames, currentSheet }
 * @returns {{ handleFile, isUploading }}
 */
export function useFileUpload(options = {}) {
  const dataShare = useDataShareStore()
  const intent = useImportIntentStore()
  const toast = useToast()
  const isUploading = ref(false)

  async function handleFile(file) {
    try {
      isUploading.value = true
      const data = await readFile(file)
      const mappedHeaders = data.headers.map(String)

      dataShare.setSharedData(mappedHeaders, data.rows, file.name, false, {
        sheetNames: data.sheetNames,
        currentSheet: data.currentSheet,
        file
      })

      // 新文件重置旧意图，然后打开意图弹窗
      if (intent.pendingFileMeta?.name !== file.name) {
        intent.reset()
      }
      intent.open({
        name: file.name,
        rowCount: data.rows.length,
        colCount: mappedHeaders.length,
        headers: [...mappedHeaders]
      })

      if (options.onFileLoaded) {
        options.onFileLoaded(data)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      isUploading.value = false
    }
  }

  return { handleFile, isUploading }
}
