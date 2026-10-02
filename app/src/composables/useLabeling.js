import { ref, computed, watch, onScopeDispose } from 'vue'
import { callAIBatch } from '../services/ai'
import { compileLabelingPrompt } from '../services/prompts'
import { validateLabelingPlan, normalizeRowResult, normalizeInputColumns } from '../services/labelingPlan'
import { parseRobustJSON } from '../services/jsonParser'
import { useSettingsStore } from '../stores/settings'
import { useDataShareStore } from '../stores/dataShare'
import { useToast } from '../services/toast'

/**
 * 智能加工（打标）编排 composable
 *
 * 封装「批量调 AI 给每行打标 + 进度管理 + 结果回写」的通用模式，
 * 供 AnalysisSimpleView（简易）与 AnalysisView（专家）共用。
 *
 * 各 view 独有的配置 UI（模板选择、列编辑、高级 Prompt 区）不在此封装。
 *
 * @param {{
 *   headers: Ref<Array>,
 *   rows: Ref<Array>,
 *   labelingPlan: Ref<object>,
 *   rangeStart: Ref<number>,
 *   rangeEnd: Ref<number>,
 *   selectedInputColumns: Ref<Array>,
 *   analysisMap: Ref<object>
 * }} params
 * @returns {{
 *   isLabeling, processed, totalToProcess, percentFinished, stats, chartData,
 *   actualConcurrency, currentProcessingRowIdx,
 *   runLabeling
 * }}
 */
export function useLabeling({ headers, rows, labelingPlan, rangeStart, rangeEnd, selectedInputColumns, analysisMap }) {
  const toast = useToast()
  const dataShare = useDataShareStore()
  let activeController = null
  let activeRunId = null

  function resetResults() {
    activeController?.abort()
    activeController = null
    dataShare.cancelLabelingRun()
    currentProcessingRowIdx.value = -1
    analysisMap.value = {}
  }
  watch(() => dataShare.datasetVersion, resetResults, { flush: 'sync' })
  watch(() => JSON.stringify(labelingPlan.value), () => {
    resetResults()
    dataShare.clearLabelingResults()
  }, { flush: 'sync' })
  watch(() => JSON.stringify(selectedInputColumns.value), (current, previous) => {
    const previousColumns = normalizeInputColumns(JSON.parse(previous), headers.value)
    const currentColumns = normalizeInputColumns(JSON.parse(current), headers.value)
    if (!previousColumns.length && !activeController) return
    if (JSON.stringify(previousColumns) === JSON.stringify(currentColumns)) return
    resetResults()
    dataShare.clearLabelingResults()
  }, { flush: 'sync' })
  watch(() => dataShare.labelingStatus.runId, runId => {
    if (activeController && activeRunId !== runId) {
      activeController.abort()
      activeController = null
      activeRunId = null
      analysisMap.value = {}
      currentProcessingRowIdx.value = -1
    } else if (!activeController) {
      analysisMap.value = {}
    }
  }, { flush: 'sync' })
  onScopeDispose(() => {
    if (activeController) {
      activeController.abort()
      dataShare.cancelLabelingRun()
    }
  })

  // 运行状态
  const isLabeling = computed(() => dataShare.labelingStatus.running)
  const processed = computed({ get: () => dataShare.labelingStatus.processed, set: value => { dataShare.labelingStatus.processed = value } })
  const totalToProcess = computed(() => dataShare.labelingStatus.total)
  const actualConcurrency = computed({ get: () => dataShare.labelingStatus.concurrency, set: value => { dataShare.labelingStatus.concurrency = value } })
  const currentProcessingRowIdx = ref(-1)
  watch(() => dataShare.labelingResults, result => {
    if (!isLabeling.value) analysisMap.value = result ? JSON.parse(JSON.stringify(result.analysisMap)) : {}
  }, { immediate: true })

  // 派生统计
  const percentFinished = computed(() => {
    if (totalToProcess.value <= 0) return 0
    return Math.round((processed.value / totalToProcess.value) * 100)
  })

  const stats = computed(() => {
    let done = 0, error = 0
    for (let i = 0; i < rows.value.length; i++) {
      const res = analysisMap.value[i]
      if (res?.status === 'done') done++
      else if (res?.status === 'error') error++
    }
    return { done, error }
  })

  const chartData = computed(() => {
    const pending = rows.value.length - stats.value.done - stats.value.error
    return [
      { name: '已分析', value: stats.value.done, color: '#10b981' },
      { name: '错误', value: stats.value.error, color: '#f43f5e' },
      { name: '待处理', value: Math.max(0, pending), color: '#94a3b8' }
    ]
  })

  /**
   * 批量打标主流程：校验 → 构建任务 → 并发调 AI → 写 analysisMap → 回写 dataShare
   */
  async function runLabeling() {
    if (isLabeling.value || !rows.value.length) return
    const settings = useSettingsStore()
    const config = settings.getApiConfig()
    if (!config.key) { settings.showSettings = true; toast.warn('请先配置 API 密钥'); return }

    const plan = JSON.parse(JSON.stringify(labelingPlan.value))
    const validationErr = validateLabelingPlan(plan)
    if (validationErr) { toast.warn(validationErr); return }

    const inputCols = normalizeInputColumns(selectedInputColumns.value.length > 0 ? selectedInputColumns.value : plan.inputColumns, headers.value)
    if (inputCols.length === 0) { toast.warn('请选择至少一个 AI 参考列'); return }

    if (selectedInputColumns.value.length === 1) {
      const onlyIdx = selectedInputColumns.value[0]
      if (onlyIdx !== dataShare.coreColumn && onlyIdx >= 0 && onlyIdx < headers.value.length) {
        dataShare.setCoreColumn(onlyIdx)
        toast.info(`核心列已同步为「${headers.value[onlyIdx]}」`)
      }
    }

    let start = parseInt(rangeStart.value) || 1
    let end = parseInt(rangeEnd.value) || rows.value.length
    if (start < 1) start = 1
    if (end > rows.value.length) end = rows.value.length
    if (start > end || end < 1) { toast.warn('开始行不能大于结束行'); return }

    const controller = new AbortController()
    activeController = controller
    activeRunId = dataShare.labelingStatus.runId + 1
    const runId = dataShare.beginLabelingRun(end - start + 1, settings.concurrency)
    if (runId === null) {
      activeController = null
      activeRunId = null
      return
    }
    activeRunId = runId
    const version = dataShare.datasetVersion
    const isCurrent = () => activeController === controller && dataShare.datasetVersion === version && dataShare.labelingStatus.runId === runId
    dataShare.clearLabelingResults()

    currentProcessingRowIdx.value = -1

    for (let k = start - 1; k < end; k++) {
      analysisMap.value[k] = { status: 'pending', values: {}, errorMessage: '' }
    }

    const systemPrompt = plan.promptDirty
      ? plan.compiledPrompt
      : compileLabelingPrompt(plan)

    // 构建任务列表（空内容行直接跳过）
    const tasks = []
    for (let i = start - 1; i < end; i++) {
      const rowInput = Object.create(null)
      inputCols.forEach(ci => {
        rowInput[headers.value[ci]] = rows.value[i][ci] ?? ''
      })
      const hasContent = Object.values(rowInput).some(v => String(v).trim().length > 0)
      if (!hasContent) {
        const emptyValues = {}
        plan.outputColumns.forEach(c => { emptyValues[c.key] = null })
        analysisMap.value[i] = { status: 'done', values: emptyValues, errorMessage: '' }
        processed.value++
      } else {
        tasks.push({ content: JSON.stringify(rowInput), systemPrompt, index: i })
      }
    }

    tasks.forEach(t => { analysisMap.value[t.index].status = 'processing' })

    // 并发调用 AI
    actualConcurrency.value = settings.concurrency
    try {
    const { finalConcurrency } = await callAIBatch(
      tasks.map(t => ({ content: t.content, systemPrompt: t.systemPrompt })),
      (batchIdx, result, error, meta) => {
        if (!isCurrent()) return
        const rowIdx = tasks[batchIdx].index
        if (error) {
          analysisMap.value[rowIdx] = { status: 'error', values: {}, errorMessage: error.message }
        } else {
          const parsed = parseRobustJSON(result)
          const normalized = normalizeRowResult(parsed, plan.outputColumns)
          if (normalized) {
            analysisMap.value[rowIdx] = { status: 'done', values: normalized, errorMessage: '' }
          } else {
            analysisMap.value[rowIdx] = { status: 'error', values: {}, errorMessage: 'AI 返回 JSON 格式不规范' }
          }
        }
        processed.value++
        actualConcurrency.value = meta.concurrency
      },
      settings.concurrency, undefined, { signal: controller.signal }
    )
    if (!isCurrent()) return
      if (finalConcurrency < settings.concurrency) {
        toast.warn(`API 限流，已自动降级并发数: ${settings.concurrency} → ${finalConcurrency}`)
      }

    if (stats.value.error) toast.warn(`打标完成：${stats.value.done} 行成功，${stats.value.error} 行失败`)
    else toast.success('AI 打标完成！')
    } catch (error) {
      if (!isCurrent() || error.name === 'AbortError') return
      for (const task of tasks) {
        if (analysisMap.value[task.index]?.status === 'processing') {
          analysisMap.value[task.index] = { status: 'error', values: {}, errorMessage: error.message }
        }
      }
      processed.value = totalToProcess.value
      toast.error('打标失败：' + error.message)
    } finally {
      if (activeController === controller) {
        // 批次意外中断也保留成功行，供另一模式和摘要页继续使用。
        if (Object.values(analysisMap.value).some(result => result.status === 'done')) {
          dataShare.setLabelingResults(plan.outputColumns, analysisMap.value, version)
        }
        activeController = null
        activeRunId = null
        dataShare.finishLabelingRun(runId)
        currentProcessingRowIdx.value = -1
      }
    }
  }

  return {
    isLabeling,
    processed,
    totalToProcess,
    percentFinished,
    stats,
    chartData,
    actualConcurrency,
    currentProcessingRowIdx,
    runLabeling
  }
}
