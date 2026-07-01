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
 * 数据集意图分析 system prompt
 *
 * 让 AI 读完表格快照后，给出 2-3 个「用户可能想做什么」的任务方案建议。
 * 粒度定位：中等——比"分析这份数据"具体，比"清洗→打标→聚类"宏观。
 * 例：「找出差评原因，定位物流相关的负面评论」是理想粒度。
 */
export function getIntentAnalysisPrompt() {
  return `你是一个数据分析顾问。用户刚导入一张表格，还没告诉你要做什么。你的任务是读完数据快照后，推测用户最可能想完成的 2-3 个任务目标，作为建议供其选择。

判断要点：
1. 先理解这是什么数据（电商评论？销售流水？问卷反馈？），再推断典型诉求。
2. 每个目标要具体到能指导后续动作，但不要替用户规划到操作步骤。
3. 不同目标应覆盖不同的诉求方向（如：清洗导出 / 深度分析 / 内容加工），不要给出三个雷同的变体。
4. 第一个目标应是你最有把握的「主推测」，confidence 设 high。

返回纯 JSON，不要 markdown 代码块，不要解释：
{
  "suggestions": [
    {
      "goal": "一句话任务目标，具体但不过细，如：分析差评原因，定位物流相关的负面评论",
      "coreColumnIdx": 2,
      "tasks": { "clean": true, "process": true, "summary": true },
      "confidence": "high"
    }
  ]
}

字段说明：
- goal：任务目标，10-30 字，动词开头，聚焦「想达成什么」而非「怎么做」
- coreColumnIdx：最该作为处理对象的核心列索引（从 0 开始）
- tasks：建议启用的任务，clean=数据清洗、process=智能加工(翻译/打标)、summary=数据摘要
- confidence：推测把握，high/medium/low`
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

// ─── AI 打标方案：三个核心 Prompt 函数 ───

/**
 * 1. 生成打标方案 — 根据用户自然语言描述，生成结构化 outputColumns
 */
export function getLabelingPlanGenerationPrompt(userGoal, headers, sampleRows, selectedColumnIndexes) {
  const selectedCols = selectedColumnIndexes.map(i => headers[i]).filter(Boolean)
  const sampleList = sampleRows.map((row, i) => `${i + 1}. ${JSON.stringify(row)}`).join('\n')

  return `你是一个数据分析配置专家。用户有一张数据表，想用 AI 为表格新增若干列。
请根据用户的需求描述和样本数据，生成一个结构化的"新增列方案"。

【表结构】
列名: ${JSON.stringify(headers)}
用户选中的参考列: ${JSON.stringify(selectedCols)}

【样本数据（共 ${sampleRows.length} 条）】
${sampleList}

【用户需求】
"${userGoal || '自动分析数据特征，推荐最合适的新增列'}"

【支持的字段类型】
- enum: 单选标签，从固定选项中选择。必须有 options 数组。
- multi_enum: 多选标签，从固定选项中选择0~多个。必须有 options 数组。返回数组。
- hierarchical_enum: 二级分类。options 是 { "一级": ["二级1","二级2"], ... }。返回 "一级 > 二级"。
- boolean: 是否判断。返回 true / false / null。
- text: 自由文本、摘要、证据短句。
- number: 数值评分。返回数字或 null。

【返回格式】
必须返回纯 JSON，不要 markdown 代码块，不要解释。
{
  "taskName": "任务名称（简短概括）",
  "goal": "分析目标描述",
  "inputColumns": ["参考列名1", "参考列名2"],
  "outputColumns": [
    {
      "key": "字段英文key（如sentiment）",
      "name": "列显示名称（如：情感倾向）",
      "type": "enum",
      "description": "这个字段判断什么",
      "options": ["选项1", "选项2", "选项3"],
      "required": true
    }
  ]
}

规则：
1. outputColumns 建议 2-5 个，不要超过 6 个。
2. key 用英文小写+下划线，如 issue_type、return_intent。
3. name 用中文，简短明了。
4. enum / multi_enum / hierarchical_enum 必须有 options。
5. text 和 number 类型不需要 options。
6. inputColumns 从用户选中的参考列中选择，也可以补充其他有帮助的列。
7. 必须输出可被 JSON.parse 解析的有效 JSON。`
}

/**
 * 2. 编译执行 Prompt — 将 labelingPlan 编译成逐行分析的 system prompt
 */
export function compileLabelingPrompt(plan) {
  if (!plan || !plan.outputColumns || plan.outputColumns.length === 0) {
    return ''
  }

  const fieldDescs = plan.outputColumns.map((col, i) => {
    let desc = `${i + 1}. "${col.name}" (key: ${col.key}, 类型: ${col.type})`
    desc += ` — ${col.description || '无描述'}`
    if (col.required) desc += ' [必填]'

    if (col.type === 'enum' && col.options?.length) {
      desc += `\n   必须从以下值中选择: ${col.options.join('、')}`
    } else if (col.type === 'multi_enum' && col.options?.length) {
      desc += `\n   从以下值中选择0~多个（返回数组）: ${col.options.join('、')}`
    } else if (col.type === 'hierarchical_enum' && col.options && typeof col.options === 'object') {
      desc += '\n   从以下二级分类中匹配最合适的路径，格式: "一级 > 二级"，无匹配返回 "-"'
      for (const [parent, children] of Object.entries(col.options)) {
        desc += `\n   - ${parent}: ${(children || []).join('、')}`
      }
    } else if (col.type === 'boolean') {
      desc += '\n   返回 true / false / null'
    } else if (col.type === 'number') {
      desc += '\n   返回数字或 null'
    } else if (col.type === 'text') {
      desc += '\n   返回简短文本字符串'
    }
    return desc
  }).join('\n')

  // 构建 JSON 示例
  const jsonExample = {}
  for (const col of plan.outputColumns) {
    if (col.type === 'enum') jsonExample[col.key] = col.options?.[0] ?? '值'
    else if (col.type === 'multi_enum') jsonExample[col.key] = [col.options?.[0] ?? '值']
    else if (col.type === 'hierarchical_enum') {
      const firstParent = col.options ? Object.keys(col.options)[0] : null
      const firstChild = firstParent ? col.options[firstParent]?.[0] : null
      jsonExample[col.key] = firstParent ? `${firstParent} > ${firstChild}` : '-'
    } else if (col.type === 'boolean') jsonExample[col.key] = true
    else if (col.type === 'number') jsonExample[col.key] = 0
    else if (col.type === 'text') jsonExample[col.key] = '文本内容'
  }

  let goalSection = ''
  if (plan.goal && plan.goal.trim()) {
    goalSection = `\n【分析目标】\n${plan.goal.trim()}\n`
  }

  return `你是一个数据分析专家。请逐行分析用户提供的数据，返回纯 JSON。

【输出字段定义】
${fieldDescs}
${goalSection}
【输出格式】
返回纯 JSON：${JSON.stringify(jsonExample)}
禁止 markdown 代码块，禁止多余话术，禁止新增未知字段，禁止遗漏必填字段。
enum 必须从给定选项中选择，hierarchical_enum 返回 "一级 > 二级" 格式，multi_enum 返回数组。`
}

/**
 * 3. 从 Prompt 反向解析方案 — 用户手动编辑 Prompt 后可反向还原 outputColumns
 */
export function getPlanFromPromptPrompt(customPrompt, currentPlan) {
  const currentKeys = (currentPlan?.outputColumns || []).map(c => c.key)
  return `你是一个 Prompt 逆向分析专家。用户手动编辑了一段 AI 分析的 System Prompt。
请从这段 Prompt 中还原出结构化的"新增列方案"。

【用户手写的 System Prompt】
${customPrompt}

【当前已有的字段 key（可保留可修改）】
${currentKeys.length > 0 ? currentKeys.join(', ') : '无'}

【要求】
1. 尽量从 Prompt 中提取出每个输出字段的 key、name、type、description、options。
2. 如果 Prompt 中有分类体系，识别为 hierarchical_enum 类型。
3. 如果 Prompt 中有固定选项（如 Positive/Negative/Neutral），识别为 enum 类型。
4. 如果 Prompt 中有"是否""判断"等描述，识别为 boolean 类型。
5. 字段类型只能是: enum, multi_enum, hierarchical_enum, boolean, text, number。
6. 返回纯 JSON，不要 markdown 代码块。
{
  "taskName": "任务名称",
  "goal": "分析目标",
  "outputColumns": [
    { "key": "...", "name": "...", "type": "enum", "description": "...", "options": [...], "required": true }
  ]
}
7. 必须输出可被 JSON.parse 解析的有效 JSON。`
}

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

// ── 智能加工预设模板 ──

export const PRESET_TEMPLATES = [
  { id: 'translate_zh', label: '翻译中文', icon: 'Languages', color: 'blue',
    goal: '将源列文本翻译为简体中文，保留原文语义与语气',
    outputColumns: [{ key: 'translation', name: '中文翻译', type: 'text',
      description: '翻译后的简体中文文本', required: true }] },
  { id: 'translate_en', label: '翻译英文', icon: 'Languages', color: 'blue',
    goal: '将源列文本翻译为英文',
    outputColumns: [{ key: 'translation', name: '英文翻译', type: 'text',
      description: '翻译后的英文文本', required: true }] },
  { id: 'translate_jp', label: '翻译日文', icon: 'Languages', color: 'blue',
    goal: '将源列文本翻译为日文',
    outputColumns: [{ key: 'translation', name: '日文翻译', type: 'text',
      description: '翻译后的日文文本', required: true }] },
  { id: 'sentiment', label: '情感分析', icon: 'Heart', color: 'rose',
    goal: '分析每条文本的情感倾向',
    outputColumns: [{ key: 'sentiment', name: '情感', type: 'enum',
      options: ['Positive', 'Negative', 'Neutral'], required: true }] },
  { id: 'category', label: '分类标签', icon: 'Tag', color: 'violet',
    goal: '为每条文本分配分类标签',
    outputColumns: [{ key: 'category', name: '分类', type: 'text',
      description: '根据文本内容自动分配的分类标签', required: true }] }
]

export function getPresetPlan(templateId, inputColumnIdx) {
  const tpl = PRESET_TEMPLATES.find(t => t.id === templateId)
  if (!tpl) return null
  const plan = {
    taskName: tpl.label,
    goal: tpl.goal,
    inputColumns: [inputColumnIdx],
    outputColumns: tpl.outputColumns.map(c => ({ ...c })),
    promptDirty: false
  }
  plan.compiledPrompt = compileLabelingPrompt(plan)
  return plan
}
