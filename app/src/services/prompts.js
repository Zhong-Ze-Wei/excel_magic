/**
 * Prompt 模板管理 — 从 v2 HTML 的各种 prompt 逻辑迁移
 */

// 翻译场景选项
export const TRANSLATE_SCENARIOS = [
  { value: 'ecommerce_spec', label: '产品参数 (准确/术语)' },
  { value: 'ecommerce_comment', label: '用户评论 (情感/口语)' },
  { value: 'ecommerce_title', label: '竞品标题 (SEO优化)' },
  { value: 'email', label: '邮件沟通 (正式商务)' },
  { value: 'general', label: '通用翻译' }
]

// 语言方向选项
export const LANGUAGE_DIRECTIONS = [
  { value: 'auto_to_zh', label: '自动检测 -> 中文' },
  { value: 'zh_to_en', label: '中文 -> 英文' },
  { value: 'en_to_zh', label: '英文 -> 中文' },
  { value: 'zh_to_jp', label: '中文 -> 日文' }
]

/**
 * 获取翻译 system prompt
 */
export function getTranslatePrompt(scenario, direction) {
  let targetLang = 'Chinese (Simplified)'
  if (direction === 'zh_to_en') targetLang = 'English'
  if (direction === 'zh_to_jp') targetLang = 'Japanese'

  const prompts = {
    ecommerce_spec: `You are a product translator. Translate specs into ${targetLang}. Keep technical terms (e.g., mAh, IP68) and numbers unchanged. Be concise.`,
    ecommerce_comment: `Translate user review into ${targetLang}. Keep the original sentiment. Use natural, colloquial language.`,
    ecommerce_title: `Translate product title into ${targetLang}. Keep key model numbers/brands unchanged. Optimize for search.`,
    email: `Translate email into ${targetLang}. Maintain a formal, professional business tone.`,
    general: `Translate text into ${targetLang} accurately. Only return the translation, no explanation.`
  }
  return prompts[scenario] || prompts.general
}

/**
 * 获取评论分析 prompt (废弃/向下兼容)
 */
export function getAnalysisPrompt(categories) {
  return getAnalysisSystemPrompt(categories)
}

/**
 * 获取评论分析详细 System Prompt (支持自定义)
 */
export function getAnalysisSystemPrompt(taxonomy) {
  let taxonomyStr = ''
  if (taxonomy && typeof taxonomy === 'object' && !Array.isArray(taxonomy)) {
    for (const [parent, children] of Object.entries(taxonomy)) {
      taxonomyStr += `- ${parent}\n`
      if (Array.isArray(children)) {
        children.forEach(child => {
          taxonomyStr += `  - ${child}\n`
        })
      }
    }
  } else if (Array.isArray(taxonomy)) {
    taxonomyStr = taxonomy.map(c => `- ${c}`).join('\n')
  } else {
    taxonomyStr = String(taxonomy || '')
  }

  return `你是一个评论分析专家。请分析用户提供的评论内容，提取出评论的“情感倾向 (sentiment)”和最匹配的“分类标签路径 (category)”。
可选分类体系如下：
${taxonomyStr}

【分析规则】
1. 情感倾向 (sentiment) 必须是以下三者之一: Positive (正面), Negative (负面), Neutral (中性)。
2. 分类标签路径 (category) 必须严格按照可选分类体系中的路径进行选择，路径格式为：“一级分类 > 二级分类”。例如：“质量 > 很好”。
3. 如果评论中完全没有涉及分类体系中的内容，或者无法匹配，分类标签路径 (category) 请返回 "-"。
4. 必须且只能返回纯 JSON 格式，如：{"sentiment": "Positive", "category": "质量 > 很好"}。请勿输出任何 markdown 代码块（如 \`\`\`json）或任何额外的解释。`
}

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
 * 获取 AI 自动生成标签 prompt
 */
export function getTagGenerationPrompt(samples, taxonomyGoal = '') {
  const sampleList = samples.map((s, i) => `${i + 1}. ${s}`).join('\n')
  let goalPrompt = ''
  if (taxonomyGoal && taxonomyGoal.trim() !== '') {
    goalPrompt = `\n【核心生成目标与分类侧重】：\n用户对这套分类体系的期望是：“${taxonomyGoal.trim()}”。请你务必围绕该模糊意图，结合样本评论，生成最匹配的分类维度。\n`
  }
  return `你是一个评论分类专家。请根据以下用户评论数据样本，以及用户的分类偏好，提炼出一套二级分类标签体系（包含 3 至 5 个一级大类，以及每个大类下对应的 2 至 4 个二级子分类标签）。
${goalPrompt}
样本评论：
${sampleList}

要求：
1. 分类标签要简短贴切，符合用户设定的期望目标，同时结合样本数据场景（如电商、客户反馈、售后处理等）。
2. 必须直接返回一个标准的 JSON 对象，格式如下，请勿使用 markdown 代码块包裹，也不要提供任何额外解释：
{
  "一级大类1": ["子标签1", "子标签2"],
  "一级大类2": ["子标签3", "子标签4"]
}
3. 必须输出有效的、可被标准 JSON.parse 解析的内容。`
}

/**
 * 获取根据分析目标优化 System Prompt 的 prompt
 */
export function getPromptOptimizerPrompt(goal, taxonomy) {
  let taxonomyStr = ''
  if (taxonomy && typeof taxonomy === 'object' && !Array.isArray(taxonomy)) {
    for (const [parent, children] of Object.entries(taxonomy)) {
      taxonomyStr += `- ${parent}\n`
      if (Array.isArray(children)) {
        children.forEach(child => {
          taxonomyStr += `  - ${child}\n`
        })
      }
    }
  } else if (Array.isArray(taxonomy)) {
    taxonomyStr = taxonomy.map(c => `- ${c}`).join('\n')
  } else {
    taxonomyStr = String(taxonomy || '')
  }

  return `你是一个大模型 Prompt 优化专家。用户想要为评论分析工具配置一个 System Prompt。
用户当前的模糊分析目标为："${goal}"
可选分类体系如下：
${taxonomyStr}

请为大模型生成一段精炼、结构化、极具指引性的 System Prompt，用来让大模型更好地对评论运行情感极性和二级分类路径判断。
要求：
1. 生成的 System Prompt 中必须明确指导大模型优先侧重分析用户的目标 "${goal}"。
2. 必须要求大模型在返回结果时严格遵循 JSON 格式，结构为：{"sentiment": "Positive/Negative/Neutral", "category": "一级分类 > 二级分类 (若完全无匹配则为 '-')"}。
3. 必须在生成的 Prompt 中明文写出当前的分类体系，指导大模型必须在体系路径中挑选。
4. 仅返回生成的 System Prompt 正文本身，不要包裹 markdown 代码块，也不要包含任何额外解释。`
}

/**
 * 获取公式生成 prompt
 */
export function getFormulaPrompt() {
  return `你是一个Excel公式专家。根据用户需求生成Excel公式。
要求：
1. 返回JSON格式：{"formula": "=公式", "explanation": "使用说明"}
2. 公式要准确可用
3. 只返回JSON，不要其他内容`
}

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
  ]
}

当 strategy 为 "builtin" 时仅填充 builtinConfig，为 "custom" 时仅填充 customFilters，为 "mixed" 时两者都填充。`
}
