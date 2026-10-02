import { ref } from 'vue'
import { runCleaningPipeline } from '../services/cleaningRules'

/**
 * 清洗管道 composable
 *
 * 封装「调 runCleaningPipeline + 管理 cleanedRows + 统计 + 导出」的通用模式，
 * 供 CleaningView（专家模式，预览+全量统计）与 OptimizeView（简易模式，全量）共用。
 *
 * 各 view 独有的展示逻辑（如 OptimizeView 的 displayDecision、CleaningView 的用户覆写）
 * 不在此封装，避免职责膨胀。
 *
 * @param {{
 *   headers: Ref<Array>,
 *   rows: Ref<Array>,
 *   sourceCol: Ref<number>,
 *   getConfig: () => object,
 *   getLabelingResults?: () => object,
 *   previewLimit?: number
 * }} params
 *   - getConfig：返回当前 rulesConfig（可能来自 settings 或 AI 方案）
 *   - getLabelingResults：返回打标结果，默认不传
 *   - previewLimit：预览行数，默认 0 表示不启用预览（全量跑）
 * @returns {{
 *   cleanedRows: Ref<Array>,
 *   fullStats: Ref<{keep:number,delete:number,suspect:number}>,
 *   runPipeline: () => void,
 *   getCleanedFullResult: () => Array,
 *   getCleanRows: () => Array
 * }}
 */
export function useCleaningPipeline({ headers, rows, sourceCol, getConfig, getLabelingResults, previewLimit = 0 }) {
  const cleanedRows = ref([])
  const fullStats = ref({ keep: 0, delete: 0, suspect: 0 })

  // 先对全表判定，预览只截取结果，确保频次规则与统计、导出一致。
  function runPipeline() {
    if (!rows.value.length) {
      cleanedRows.value = []
      fullStats.value = { keep: 0, delete: 0, suspect: 0 }
      return
    }
    const labeling = getLabelingResults ? getLabelingResults() : undefined
    const fullResult = runCleaningPipeline(rows.value, headers.value, sourceCol.value, getConfig(), labeling)
    fullStats.value = countDecisions(fullResult)
    cleanedRows.value = previewLimit > 0 ? fullResult.slice(0, previewLimit) : fullResult
  }

  // 运行全量清洗 Pipeline（供导出/共享使用）
  function getCleanedFullResult() {
    return runCleaningPipeline(rows.value, headers.value, sourceCol.value, getConfig(), getLabelingResults ? getLabelingResults() : undefined)
  }

  // 仅保留 decision === 'keep' 的原始行（供导出/共享使用）
  function getCleanRows() {
    return getCleanedFullResult()
      .filter(r => r.decision === 'keep')
      .map(r => r.originalRow)
  }

  // 清空结果（数据被清空时调用）
  function clear() {
    cleanedRows.value = []
    fullStats.value = { keep: 0, delete: 0, suspect: 0 }
  }

  return {
    cleanedRows,
    fullStats,
    runPipeline,
    getCleanedFullResult,
    getCleanRows,
    clear
  }
}

function countDecisions(result) {
  let keep = 0, del = 0, suspect = 0
  result.forEach(r => {
    if (r.decision === 'keep') keep++
    else if (r.decision === 'delete') del++
    else if (r.decision === 'suspect') suspect++
  })
  return { keep, delete: del, suspect }
}
