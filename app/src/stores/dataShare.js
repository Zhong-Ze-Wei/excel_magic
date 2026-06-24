import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useDataShareStore = defineStore('dataShare', () => {
  const headers = ref([])
  const rows = ref([])
  const sourceName = ref('') // 例如: '清洗后数据.xlsx'
  const coreColumn = ref(0) // 全局共享的核心处理列索引
  const labelingResults = ref(null) // { outputColumns: [...], analysisMap: { [rowIdx]: { values: {...} } } }
  const translatedColumns = ref([]) // [{ originalIdx, translatedIdx, translatedName }]

  // 多 Sheet 支持
  const sheetNames = ref([])
  const currentSheet = ref('')
  const file = ref(null) // 原始 File 对象，用于切换 Sheet 时重新读取

  const hasData = computed(() => rows.value.length > 0)
  const hasMultipleSheets = computed(() => sheetNames.value.length > 1)

  // 存入共享数据
  // autoDetect 参数保留兼容性，但已不再做启发式判断；越界时兜底为 0（首列）
  function setSharedData(newHeaders, newRows, name = '已清洗的数据', autoDetect = false, options = {}) {
    headers.value = [...newHeaders]
    rows.value = newRows.map(r => [...r])
    sourceName.value = name
    if (options.sheetNames) sheetNames.value = options.sheetNames
    if (options.currentSheet) currentSheet.value = options.currentSheet
    if (options.file) file.value = options.file
    // 越界保护：列数缩减或未设置时，兜底为 0（首列）
    if (coreColumn.value == null || coreColumn.value >= newHeaders.length) {
      coreColumn.value = 0
    }
  }

  // 修改全局核心列
  function setCoreColumn(colIdx) {
    coreColumn.value = Number(colIdx)
  }

  // 载入数据并立刻清空总线，防范重复载入干扰
  function getAndClearSharedData() {
    const data = {
      headers: [...headers.value],
      rows: rows.value.map(r => [...r]),
      sourceName: sourceName.value,
      coreColumn: coreColumn.value
    }
    clearSharedData()
    return data
  }

  // 存入 AI 打标结果
  function setLabelingResults(outputColumns, map) {
    labelingResults.value = { outputColumns, analysisMap: { ...map } }
  }

  function clearLabelingResults() {
    labelingResults.value = null
  }

  // 记录翻译列元信息
  function addTranslatedColumn(originalIdx, translatedIdx, name) {
    translatedColumns.value.push({ originalIdx, translatedIdx, translatedName: name })
  }

  // 切换 Sheet
  async function setSheet(sheetName) {
    if (!file.value || sheetName === currentSheet.value) return
    const { readSheet } = await import('../services/excel')
    const data = await readSheet(file.value, sheetName)
    headers.value = data.headers
    rows.value = data.rows
    currentSheet.value = sheetName
    // 越界保护：切换 Sheet 后若原核心列越界，兜底为 0
    if (coreColumn.value == null || coreColumn.value >= data.headers.length) {
      coreColumn.value = 0
    }
  }

  // 清理
  function clearSharedData() {
    headers.value = []
    rows.value = []
    sourceName.value = ''
    coreColumn.value = 0
    labelingResults.value = null
    translatedColumns.value = []
    sheetNames.value = []
    currentSheet.value = ''
    file.value = null
  }

  return {
    headers, rows, sourceName, coreColumn, hasData, labelingResults, translatedColumns,
    sheetNames, currentSheet, hasMultipleSheets, file,
    setSharedData, setCoreColumn, getAndClearSharedData, clearSharedData,
    setLabelingResults, clearLabelingResults, addTranslatedColumn, setSheet
  }
})
