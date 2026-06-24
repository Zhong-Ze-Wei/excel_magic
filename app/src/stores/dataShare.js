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

  // 启发式选择核心列的方法（基于字数长度）
  function heuristicDetectCoreColumn(headersList, rowsList) {
    if (!rowsList || rowsList.length === 0) return 0
    let bestColIdx = 0
    let maxAvgLength = 0
    const colCount = headersList.length
    const sampleRows = rowsList.slice(0, 15)
    
    for (let c = 0; c < colCount; c++) {
      let totalLen = 0
      let nonNullCount = 0
      sampleRows.forEach(row => {
        const val = row[c]
        if (val != null && val !== '') {
          totalLen += String(val).trim().length
          nonNullCount++
        }
      })
      const avgLen = nonNullCount > 0 ? (totalLen / nonNullCount) : 0
      if (avgLen > maxAvgLength) {
        maxAvgLength = avgLen
        bestColIdx = c
      }
    }
    return bestColIdx
  }

  // 存入共享数据
  function setSharedData(newHeaders, newRows, name = '已清洗的数据', autoDetect = false, options = {}) {
    headers.value = [...newHeaders]
    rows.value = newRows.map(r => [...r])
    sourceName.value = name
    if (options.sheetNames) sheetNames.value = options.sheetNames
    if (options.currentSheet) currentSheet.value = options.currentSheet
    if (options.file) file.value = options.file
    if (autoDetect) {
      // 自动判断并推荐最佳核心处理列
      coreColumn.value = heuristicDetectCoreColumn(newHeaders, newRows)
    } else {
      // 安全防范：当列数发生缩减导致之前的核心列越界时，安全修正为第 0 列
      if (coreColumn.value >= newHeaders.length) {
        coreColumn.value = 0
      }
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
    coreColumn.value = heuristicDetectCoreColumn(data.headers, data.rows)
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
