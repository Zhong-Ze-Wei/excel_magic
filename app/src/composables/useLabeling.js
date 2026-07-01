import { ref, computed } from 'vue'
import { callAIBatch } from '../services/ai'
import { compileLabelingPrompt } from '../services/prompts'
import { validateLabelingPlan, normalizeRowResult } from '../services/labelingPlan'
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

  // 运行状态
  const isLabeling = ref(false)
  const processed = ref(0)
  const totalToProcess = ref(0)
  const actualConcurrency = ref(0)
  const currentProcessingRowIdx = ref(-1)

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
    const dataShare = useDataShareStore()
    const config = settings.getApiConfig()
    if (!config.key) { settings.showSettings = true; toast.warning('请先配置 API 密钥'); return }

    const plan = labelingPlan.value
    const validationErr = validateLabelingPlan(plan)
    if (validationErr) { toast.warning(validationErr); return }

    const inputCols = selectedInputColumns.value.length > 0 ? selectedInputColumns.value
      : (plan.inputColumns.map(name => headers.value.indexOf(name)).filter(i => i >= 0))
    if (inputCols.length === 0) { toast.warning('请选择至少一个 AI 参考列'); return }

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
    if (start > end) { toast.warning('开始行不能大于结束行'); return }

    isLabeling.value = true
    processed.value = 0
    totalToProcess.value = end - start + 1
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
      const rowInput = {}
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
    await callAIBatch(
      tasks.map(t => ({ content: t.content, systemPrompt: t.systemPrompt })),
      (batchIdx, result, error, meta) => {
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
      settings.concurrency
    ).then(({ finalConcurrency }) => {
      if (finalConcurrency < settings.concurrency) {
        toast.warning(`API 限流，已自动降级并发数: ${settings.concurrency} → ${finalConcurrency}`)
      }
    })

    isLabeling.value = false
    currentProcessingRowIdx.value = -1

    // 将打标结果写入全局共享，供数据摘要页使用
    const doneCount = Object.values(analysisMap.value).filter(r => r.status === 'done').length
    if (doneCount > 0) {
      dataShare.setLabelingResults(plan.outputColumns, analysisMap.value)
    }

    toast.success('AI 打标完成！')
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
