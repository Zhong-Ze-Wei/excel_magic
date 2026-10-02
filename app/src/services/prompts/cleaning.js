/**
 * AI 智能筛选提示词 — 分析全表结构，识别目标列，生成精确匹配规则
 */
export function getSmartFilterPrompt(userInput, headers, sourceColIdx, allColumnSamples, existingRulesMeta) {
  const rulesDesc = existingRulesMeta.map(r =>
    `- ${r.key}: ${r.title} — ${r.description}`
  ).join('\n')

  // 构建全表列信息：每列的列名、样例值、unique 值
  const colInfo = headers.map((h, i) => {
    const samples = (allColumnSamples[i] || []).slice(0, 15)
    const unique = [...new Set(samples.filter(v => v != null && v !== '').map(String))]
    return {
      index: i,
      name: h,
      sampleValues: samples,
      uniqueValues: unique.slice(0, 20),
      isSourceColumn: i === sourceColIdx
    }
  })

  return `你是一个数据分析与清洗专家。用户有一张数据表，想用自然语言描述来筛选/过滤数据行。
你的核心任务是：**先理解全表结构，找到与用户意图最相关的列，然后生成精确的列级匹配规则。**

【全表结构与各列样例数据】
${colInfo.map(c =>
`列[${c.index}] "${c.name}"${c.isSourceColumn ? ' (当前清洗目标列)' : ''}
  样例值: ${JSON.stringify(c.sampleValues)}
  去重值: ${JSON.stringify(c.uniqueValues)}`
).join('\n\n')}

【已有的内置原子规则 (仅针对清洗目标列的文本质量)】
${rulesDesc}

【用户的筛选意图】
"${userInput}"

【策略指南 — 按优先级】
1. **优先做列级精确匹配**：扫描所有列，找到与用户意图最匹配的列（如情感、评分、状态、分类等结构化列），用 columnEquals 做精确值匹配。
   - 例如用户说"过滤掉负面评论"，如果发现某列（如列[3]情感倾向）的 uniqueValues 包含"正面/负面/中性"，则用 columnEquals { column: 3, value: "负面" }
   - 如果目标列有多个值需要过滤（如"差评"和"中评"），生成多条 columnEquals 规则，每条匹配一个值
2. **只有当表中没有相关结构化列时**，才对清洗目标列使用文本匹配（textContains / regexMatch）
3. 如果涉及文本质量问题（太短、乱码、广告等），可混合使用内置原子规则

【可用的自定义规则类型】
- columnEquals: 列精确匹配 { column: number, value: string } — 适用于枚举/分类列
- columnGt: 数值列大于 { column: number, value: number } — 适用于数值列
- columnLt: 数值列小于 { column: number, value: number } — 适用于数值列
- textContains: 目标列包含关键词 { keywords: string[], matchAll: boolean, caseSensitive: boolean }
- textNotContains: 目标列不包含关键词 { keywords: string[], matchAll: boolean, caseSensitive: boolean }
- textEquals: 目标列文本精确匹配 { value: string, caseSensitive: boolean }
- regexMatch: 目标列正则匹配 { pattern: string }
- textLength: 目标列文本长度 { operator: "lt"|"gt"|"eq"|"lte"|"gte", value: number }

【返回格式】
必须返回纯JSON，不要markdown代码块，不要解释。
{
  "analysis": "简要说明你找到了哪个列、基于什么判断",
  "strategy": "builtin" 或 "custom" 或 "mixed",
  "builtinConfig": {
    "rulesToEnable": [],
    "rulesToDisable": [],
    "paramOverrides": {}
  },
  "customFilters": [
    {
      "name": "规则名称",
      "type": "columnEquals",
      "policy": "delete",
      "config": { "column": 3, "value": "负面" }
    }
  ],
  "recommendedCoreColumn": 2
}

当 strategy 为 "builtin" 时仅填充 builtinConfig，为 "custom" 时仅填充 customFilters，为 "mixed" 时两者都填充。
recommendedCoreColumn 为可选字段：如果当前清洗目标列不适合用户的意图，推荐更合适的列索引（0-based）；如果不需更换则省略。`
}
