/**
 * AI 数据摘要 — 分析主题推荐：根据用户输入的主题，AI 推荐重点分析列和分析角度
 */
export function getAnalysisThemePrompt(theme, columnProfiles, labelingColumnInfo) {
  const labelingNote = labelingColumnInfo
    ? `\n\n【已有 AI 打标结果列】\n${labelingColumnInfo}`
    : ''

  return `你是一个数据分析策略专家。用户希望围绕特定主题对数据集做深度分析。
请根据用户提供的分析主题和各列的统计画像，推荐最值得关注的列以及分析策略。

【分析主题】
"${theme}"

【全表列画像】
${columnProfiles}${labelingNote}

【返回格式】
必须返回纯 JSON，不要 markdown 代码块，不要解释。
{
  "theme": "对用户主题的精炼重述",
  "focusColumns": [
    { "columnIndex": 0, "reason": "推荐理由" }
  ],
  "analysisAngles": ["分析角度1", "分析角度2", "分析角度3"]
}

规则：
1. focusColumns 从列画像中选择 3-6 个最相关的列，columnIndex 对应列在画像中的顺序。
2. 如果有 AI 打标结果列，优先纳入。
3. analysisAngles 给出 3-5 个围绕主题的分析切入点。
4. 必须输出可被 JSON.parse 解析的有效 JSON。`
}

/**
 * AI 数据摘要 — 基于列级统计画像的深度分析 Prompt
 */
export function getDataSummaryPrompt(profilesText, datasetMeta, sampleText, theme, analysisAngles) {
  const themeSection = theme
    ? `\n6. 报告必须紧密围绕主题"${theme}"展开`
    : ''
  const anglesSection = analysisAngles?.length
    ? `\n\n【核心分析角度】\n${analysisAngles.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n请确保报告覆盖以上分析角度。`
    : ''

  return {
    systemPrompt: `你是一位资深数据分析师。你将收到一份完整的数据集统计画像（非原始行数据），包含每列的类型、分布、统计指标和少量样本。
请基于这份画像撰写一份专业的中文数据分析报告。

报告要求：
1. 用 Markdown 格式输出（使用 ## 标题、**加粗**、- 列表等）
2. 报告结构：
   - ## 数据集概览（总行数、总列数、列类型分布、数据质量评价）
   - ## 列级洞察（按列类型分组，每类给出关键发现）
   - ## 数据分布特征（异常值、偏态、集中趋势）
   - ## 数据质量评估（缺失值、异常值、一致性问题）
   - ## 业务建议（基于数据特征给出 actionable 建议）${themeSection}
3. 用具体数字说话，不要泛泛而谈
4. 指出数据中的潜在问题和机会
5. 语言专业但不晦涩，适合业务人员阅读`,

    userPrompt: `请分析以下数据集：

【数据集概况】
${datasetMeta}

${profilesText}
【分层样本（头/中/尾）】
${sampleText}${anglesSection}

请基于以上统计画像撰写深度分析报告。`
  }
}
