import { ref } from 'vue'
import { useDataShareStore } from '../stores/dataShare'
import { readFile } from '../services/excel'
import { useToast } from '../services/toast'

/**
 * 文件上传 composable
 * 封装 readFile + setSharedData + 错误处理
 *
 * @param {Object} options
 * @param {Function} options.onFileLoaded - 文件加载后的回调 (data) => void
 *   data 包含 { headers, rows, sheetNames, currentSheet }
 * @returns {{ handleFile }}
 */
export function useFileUpload(options = {}) {
  const dataShare = useDataShareStore()
  const toast = useToast()
  const isUploading = ref(false)

  async function handleFile(file) {
    try {
      isUploading.value = true
      const data = await readFile(file)
      const mappedHeaders = data.headers.map(String)

      dataShare.setSharedData(mappedHeaders, data.rows, file.name, true, {
        sheetNames: data.sheetNames,
        currentSheet: data.currentSheet,
        file
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
