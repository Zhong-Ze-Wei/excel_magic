/**
 * 获取 AI 自动识别评论列 prompt
 */
export function getColumnDetectionPrompt(headers, sampleRows) {
  return `你是一个数据分析专家。分析以下 Excel/CSV 表格的列名和前几行样本数据，找出哪一列最可能包含用户的“评论内容”、“反馈意见”或“主观文本”。
列名列表：${JSON.stringify(headers)}
前几行数据样本：
${JSON.stringify(sampleRows, null, 2)}

要求：
1. 必须并且只能从列名列表中选择一个最符合的列名。
2. 返回纯 JSON 格式：{"recommendedColumn": "匹配的列名", "reason": "推荐理由"}
3. 只返回该 JSON，请勿输出任何 markdown 代码块（如 \`\`\`json）或解释文字。`
}

/**
 * 数据集意图分析 system prompt
 *
 * 让 AI 读完表格快照后，给出 2-3 个「用户可能想做什么」的任务方案建议。
 * 粒度定位：中等——比"分析这份数据"具体，比"清洗→打标→聚类"宏观。
 * 例：「找出差评原因，定位物流相关的负面评论」是理想粒度。
 *
 * 能力感知（v2 新增）：注入模块能力清单，让 AI 推测目标时就知道边界，
 * 避免推荐清洗/加工模块做不了的任务。
 */
export function getIntentAnalysisPrompt() {
  return `你是一个数据分析顾问。用户刚导入一张表格，还没告诉你要做什么。你的任务是读完数据快照后，推测用户最可能想完成的 2-3 个任务目标，作为建议供其选择。

【四个模块的真实能力边界（必须基于此判断）】
- 数据清洗（clean）：删行/留行，基于文本质量或列值过滤。**不能**聚合、对比、求和、排名。
- 智能加工（process）：逐行新增标签列（情感/分类/翻译/评分）。**不能**聚合、对比、删除行。
- 数据摘要（summary）：单列统计画像 + AI 文字报告。**不能**分组聚合、生成二维汇总表。
- 分组聚合（aggregate）：按某列分组对另一列做 SUM/AVG/COUNT/MIN/MAX。**能**做对比、排名、汇总。

判断要点：
1. 先理解这是什么数据（电商评论？销售流水？问卷反馈？），再推断典型诉求。
2. 每个目标要具体到能指导后续动作，但不要替用户规划到操作步骤。
3. 不同目标应覆盖不同的诉求方向（如：清洗导出 / 深度分析 / 内容加工 / 分组对比），不要给出三个雷同的变体。
4. 第一个目标应是你最有把握的「主推测」，confidence 设 high。
5. tasks 必须与 goal 语义一致：只有 goal 确实需要该任务时才设 true。
   - goal 侧重"清洗/去噪/去重"→ clean:true
   - goal 侧重"打标/翻译/分类/情感分析"→ process:true
   - goal 侧重"总结/洞察/报告"→ summary:true
   - goal 侧重"对比/排名/汇总/按...分组/按...统计"→ aggregate:true
   不要无脑全选 true，要让 tasks 真实反映 goal 的需要。
   特别注意：不要把"分组对比"类目标错误地塞给 clean/process/summary，这三个模块都做不了聚合对比。

返回纯 JSON，不要 markdown 代码块，不要解释：
{
  "suggestions": [
    {
      "goal": "一句话任务目标，具体但不过细，如：分析差评原因，定位物流相关的负面评论",
      "coreColumnIdx": 2,
      "tasks": { "clean": false, "process": true, "summary": true, "aggregate": false },
      "confidence": "high"
    }
  ]
}

字段说明：
- goal：任务目标，10-30 字，动词开头，聚焦「想达成什么」而非「怎么做」
- coreColumnIdx：最该作为处理对象的核心列索引（从 0 开始）
- tasks：建议启用的任务，clean=数据清洗、process=智能加工(翻译/打标)、summary=数据摘要、aggregate=分组聚合(对比/排名/汇总)。必须与 goal 语义匹配
- confidence：推测把握，high/medium/low`
}
