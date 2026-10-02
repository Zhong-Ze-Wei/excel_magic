/**
 * 把「数据集整体意图」格式化为可拼进任意 prompt 的参考前缀。
 *
 * 设计原则：意图上下文是「参考」而非「覆盖」。
 * 各模块保留自己的目标字段（如智能加工的 userGoal、摘要的 theme），
 * intentNote 仅作为背景信息以分层方式注入，让 AI 区分宏观任务与本步目标。
 *
 * @param {string} intentNote 数据集意图的任务说明（来自数据集意图弹窗）
 * @param {string} stepFocus 本步骤聚焦点（如「数据清洗」「为表格新增列」），可省
 * @returns {string} 拼接好的参考段；intentNote 为空则返回空串
 */
export function formatIntentContext(intentNote, stepFocus = '') {
  const note = String(intentNote || '').trim()
  if (!note) return ''
  const focus = stepFocus ? `本步骤请聚焦：${stepFocus}。` : ''
  return `\n【数据集整体任务（参考）】${note}\n${focus}`
}
