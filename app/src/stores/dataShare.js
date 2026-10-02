import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useImportIntentStore } from './importIntent'

export const useDataShareStore = defineStore('dataShare', () => {
  const headers = ref([])
  const rows = ref([])
  const sourceName = ref('') // 例如: '清洗后数据.xlsx'
  const datasetVersion = ref(0)
  const uploadRequestId = ref(0)
  const labelingStatus = ref({ running: false, runId: 0, processed: 0, total: 0, concurrency: 0 })
  let sheetRequest = 0
  const coreColumn = ref(0) // 全局共享的核心处理列索引
  const labelingResults = ref(null) // { outputColumns: [...], analysisMap: { [rowIdx]: { values: {...} } } }
  const intentNote = ref('') // 数据集意图的任务说明，作为 AI 模块的共享上下文
  // 打标方案（单一真源）：简易/专家视图共享，切换零迁移
  const labelingPlan = ref({
    taskName: '', goal: '', inputColumns: [], outputColumns: [], compiledPrompt: '', promptDirty: false
  })

  // 多 Sheet 支持
  const sheetNames = ref([])
  const currentSheet = ref('')
  const file = ref(null) // 原始 File 对象，用于切换 Sheet 时重新读取

  const hasData = computed(() => rows.value.length > 0)
  const hasMultipleSheets = computed(() => sheetNames.value.length > 1)

  // 存入共享数据
  // autoDetect 参数保留兼容性，但已不再做启发式判断；越界时兜底为 0（首列）
  function setSharedData(newHeaders, newRows, name = '已清洗的数据', autoDetect = false, options = {}) {
    sheetRequest++
    cancelLabelingRun()
    labelingResults.value = null
    if (!options.preserveIntent) {
      intentNote.value = ''
      labelingPlan.value = { taskName: '', goal: '', inputColumns: [], outputColumns: [], compiledPrompt: '', promptDirty: false }
      useImportIntentStore().reset()
      coreColumn.value = 0
    }
    headers.value = [...newHeaders]
    rows.value = newRows.map(r => [...r])
    sourceName.value = name
    sheetNames.value = [...(options.sheetNames || [])]
    currentSheet.value = options.currentSheet || ''
    file.value = options.file || null
    // 越界保护：列数缩减或未设置时，兜底为 0（首列）
    if (!Number.isInteger(coreColumn.value) || coreColumn.value < 0 || coreColumn.value >= newHeaders.length) {
      coreColumn.value = 0
    }
    datasetVersion.value++
  }

  // 修改全局核心列
  function setCoreColumn(colIdx) {
    const index = Number(colIdx)
    if (Number.isInteger(index) && index >= 0 && index < headers.value.length) coreColumn.value = index
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
  function setLabelingResults(outputColumns, map, expectedVersion = datasetVersion.value) {
    if (expectedVersion !== datasetVersion.value) return false
    labelingResults.value = JSON.parse(JSON.stringify({ outputColumns, analysisMap: map }))
    return true
  }

  function clearLabelingResults() {
    labelingResults.value = null
  }

  function beginUpload() {
    return ++uploadRequestId.value
  }

  function beginLabelingRun(total, concurrency) {
    if (labelingStatus.value.running) return null
    const runId = labelingStatus.value.runId + 1
    labelingStatus.value = { running: true, runId, processed: 0, total, concurrency }
    return runId
  }

  function finishLabelingRun(runId) {
    if (labelingStatus.value.runId === runId) labelingStatus.value.running = false
  }

  function cancelLabelingRun() {
    labelingStatus.value = { running: false, runId: labelingStatus.value.runId + 1, processed: 0, total: 0, concurrency: 0 }
  }

  // 切换 Sheet
  async function setSheet(sheetName) {
    if (!file.value || !sheetNames.value.includes(sheetName)) return
    const request = ++sheetRequest
    if (sheetName === currentSheet.value) return
    const sourceFile = file.value
    const sourceSheets = [...sheetNames.value]
    const name = sourceName.value
    const { readSheet } = await import('../services/excel')
    const data = await readSheet(sourceFile, sheetName)
    if (request !== sheetRequest || sourceFile !== file.value) return
    setSharedData(data.headers.map(String), data.rows, name, false, {
      file: sourceFile, sheetNames: sourceSheets, currentSheet: sheetName
    })
  }

  // 清理
  function clearSharedData() {
    sheetRequest++
    cancelLabelingRun()
    headers.value = []
    rows.value = []
    sourceName.value = ''
    coreColumn.value = 0
    labelingResults.value = null
    sheetNames.value = []
    currentSheet.value = ''
    file.value = null
    intentNote.value = ''
    labelingPlan.value = { taskName: '', goal: '', inputColumns: [], outputColumns: [], compiledPrompt: '', promptDirty: false }
    useImportIntentStore().reset()
    datasetVersion.value++
  }

  // 写入数据集意图的任务说明（共享上下文）
  function setIntentNote(note) {
    intentNote.value = String(note || '').slice(0, 500)
  }

  return {
    headers, rows, sourceName, datasetVersion, uploadRequestId, labelingStatus, coreColumn, hasData, labelingResults, intentNote, labelingPlan,
    sheetNames, currentSheet, hasMultipleSheets, file,
    setSharedData, setCoreColumn, getAndClearSharedData, clearSharedData,
    setLabelingResults, clearLabelingResults, beginUpload, beginLabelingRun, finishLabelingRun, cancelLabelingRun, setSheet, setIntentNote
  }
})
