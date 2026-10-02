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
    desc += col.required !== false ? ' [必填]' : ' [可选]'

    if (col.type === 'enum' && col.options?.length) {
      desc += `\n   必须从以下值中选择: ${col.options.join('、')}`
    } else if (col.type === 'multi_enum' && col.options?.length) {
      desc += `\n   从以下值中选择0~多个（返回数组）: ${col.options.join('、')}`
    } else if (col.type === 'hierarchical_enum' && col.options && typeof col.options === 'object') {
      desc += '\n   从以下二级分类中匹配最合适的路径，格式: "一级 > 二级"，无匹配返回 null'
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
enum 必须从给定选项中选择，hierarchical_enum 返回 "一级 > 二级" 格式，multi_enum 返回数组。
无法确定的字段返回 null，禁止猜测或编造。必填字段为 null 时客户端会把该行标记为失败；可选字段允许 null。`
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
