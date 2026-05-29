# 0003 — AI 打标的 labelingPlan 数据模型

## 状态

接受

## 背景

AnalysisView 需要从"固定的情感+分类双列分析"升级为"用户自定义的任意列打标"。需要一个灵活的数据模型来描述"AI 应该新增哪些列、每列的类型和选项是什么"。

## 决策

采用 `labelingPlan` 模型，核心结构：

```js
labelingPlan = {
  taskName: '',           // 任务名称
  goal: '',               // 分析目标描述
  inputColumns: [],       // 参考列名数组
  outputColumns: [        // 新增列定义
    {
      key: 'sentiment',   // 英文字段 key
      name: '情感倾向',    // 中文显示名
      type: 'enum',       // 列类型（见下方 6 种）
      description: '',    // 判断说明
      options: [...],     // enum/multi_enum/hierarchical_enum 必填
      required: true      // 是否必填
    }
  ],
  compiledPrompt: '',     // 编译后的 system prompt
  promptDirty: false      // 用户是否手动修改过 prompt
}
```

## 6 种输出列类型

| 类型 | 返回值 | 必须有 options | 说明 |
|------|--------|---------------|------|
| enum | 字符串（从 options 选一个） | 是 | 单选标签 |
| multi_enum | 数组（从 options 选多个） | 是 | 多选标签 |
| hierarchical_enum | 字符串 "一级 > 二级" | 是（对象格式） | 二级分类 |
| boolean | true / false / null | 否 | 是否判断 |
| text | 字符串 | 否 | 自由文本、摘要、证据短句 |
| number | 数字 / null | 否 | 数值评分 |

## Prompt 编译/反编译

三个核心函数形成双向通道：

1. `getLabelingPlanGenerationPrompt()` — 用户自然语言 → AI 生成 labelingPlan
2. `compileLabelingPrompt(plan)` — labelingPlan → system prompt（逐行分析用）
3. `getPlanFromPromptPrompt()` — 用户手写 prompt → 反向解析回 outputColumns

为什么需要双向：用户可能对 AI 生成的方案不满意，手动编辑 prompt 后需要同步回列配置；也可能直接手写 prompt，需要系统能识别其中的字段定义。

## analysisMap 结构

```js
analysisMap = {
  [rowIndex]: {
    status: 'pending' | 'processing' | 'done' | 'error',
    values: { [columnKey]: value },  // done 时有值
    errorMessage: ''                  // error 时有值
  }
}
```

## 为什么需要 parseRobustJSON

AI 返回的 JSON 经常不规范：包裹在 markdown 代码块中、前后有多余文字、嵌套在更大的文本里。`parseRobustJSON`（`services/jsonParser.js`）做三步处理：
1. 剥离 markdown 代码围栏
2. 找到最外层 `{}` 或 `[]` 的边界
3. 调用 `JSON.parse`，失败返回 null

所有 AI 返回的 JSON 都走这个函数，不直接 `JSON.parse`。
