// ─── 模块能力清单（Capability Manifest）───
// 设计动机：AI 规划器曾被"只给正向工具箱清单、不给反向能力边界"，
// 导致面对"比较不同站点互动量差异"这类聚合任务时，
// 仍硬凑"清洗：总互动量"这种与对比语义无关的方案。
// 本清单作为硬约束注入每个规划函数的 systemPrompt，让 AI 诚实判断可行性。

export const MODULE_CAPABILITIES = {
  clean: {
    name: '数据清洗',
    canDo: [
      '行级过滤：删除/保留/标记可疑行',
      '基于文本质量去噪（空值、重复、乱码、广告等）',
      '基于列值精确匹配过滤（等于/大于/小于某值、关键词包含、正则）'
    ],
    cannotDo: [
      '跨行聚合（求和 / 均值 / 计数）',
      '分组对比（按某列分组对另一列统计）',
      '修改或新增列的数据值（只能删行，不能改值）',
      '排序、排名、Top N'
    ],
    positioning: '本质是"过滤器"：决定每行留还是删，输出仍是逐行明细，绝不产生汇总值。'
  },
  process: {
    name: '智能加工',
    canDo: [
      '为每一行新增 1~N 个标签列（情感、分类、翻译、评分等）',
      '逐行 AI 分析，输出该行的标签值'
    ],
    cannotDo: [
      '跨行聚合（求和 / 均值 / 计数）',
      '分组对比',
      '修改原始列的数据值（只能新增列）',
      '删除行'
    ],
    positioning: '本质是"打标器"：每行进、每行出，新增标签列，输出仍是逐行明细，绝不产生汇总值。'
  },
  summary: {
    name: '数据摘要',
    canDo: [
      '对每列做统计画像（min / max / mean / 分布 / 频率）',
      '基于画像生成 AI 文字分析报告'
    ],
    cannotDo: [
      '按 A 列分组对 B 列做 sum / avg / count（分组聚合）',
      '生成可交互的聚合数据表',
      '生成柱状对比图'
    ],
    positioning: '本质是"画像器"：对单列做统计分布，输出 AI 文字报告，不产生"分组×聚合值"的二维表。'
  },
  aggregate: {
    name: '分组对比',
    canDo: [
      '按某列分组，对另一列做 SUM / AVG / COUNT / MIN / MAX',
      '生成分组×聚合值的二维对比表',
      '生成柱状对比图（按值降序）'
    ],
    cannotDo: [
      '修改或新增原始行的数据',
      '删除行',
      '生成 AI 文字分析报告'
    ],
    positioning: '本质是"聚合器"：把多行按组归并成每 组一个汇总值，输出对比图表，不保留逐行明细。'
  }
}

/**
 * 把某个模块的能力边界格式化为可拼进 systemPrompt 的硬约束片段。
 * @param {string} moduleKey clean / process / summary
 * @returns {string} 能力约束文本；moduleKey 无效则返回空串
 */
export function getCapabilityConstraint(moduleKey) {
  const cap = MODULE_CAPABILITIES[moduleKey]
  if (!cap) return ''
  return `\n\n【${cap.name}模块的能力边界（必须遵守）】
本模块能做：
${cap.canDo.map(x => '  - ' + x).join('\n')}
本模块不能做：
${cap.cannotDo.map(x => '  - ' + x).join('\n')}
能力定位：${cap.positioning}
如果用户的任务目标超出本模块能力（如需要"分组 / 对比 / 汇总 / 排名 / Top N"），请在 analysis 字段中明确标注"本步骤无法完成该任务"，不要硬凑规则假装能做。`
}
