import { describe, it, expect } from 'vitest'
import {
  formatIntentContext,
  compileLabelingPrompt,
  getDataSummaryPrompt,
  getPresetPlan
} from '../services/prompts'

describe('意图上下文', () => {
  it('没有整体意图时，不为当前步骤添加内容', () => {
    expect(formatIntentContext(undefined, '数据清洗')).toBe('')
    expect(formatIntentContext('  ', '数据清洗')).toBe('')
  })

  it('整体任务以参考段追加，保留打标步骤自身的目标', () => {
    const plan = getPresetPlan('translate_zh', 0)
    const prompt = plan.compiledPrompt + formatIntentContext('分析海外客户反馈', '为表格新增列')

    expect(prompt).toContain(`【分析目标】\n${plan.goal}`)
    expect(prompt).toContain('【数据集整体任务（参考）】分析海外客户反馈')
    expect(prompt).toContain('本步骤请聚焦：为表格新增列。')
  })
})

describe('打标方案编译', () => {
  it('没有输出列时，不产生执行提示词', () => {
    expect(compileLabelingPrompt(null)).toBe('')
    expect(compileLabelingPrompt({ outputColumns: [] })).toBe('')
  })

  it('为六种字段类型生成有效的 JSON 示例，并保留方案内容', () => {
    const plan = {
      goal: '分析售后体验',
      outputColumns: [
        { key: 'sentiment', name: '情感', type: 'enum', options: ['正面', '负面'], required: true },
        { key: 'tags', name: '标签', type: 'multi_enum', options: ['质量', '物流'] },
        { key: 'category', name: '分类', type: 'hierarchical_enum', options: { 商品: ['质量', '外观'] } },
        { key: 'valid', name: '有效', type: 'boolean' },
        { key: 'score', name: '得分', type: 'number' },
        { key: 'note', name: '说明', type: 'text' }
      ]
    }
    const original = structuredClone(plan)
    const prompt = compileLabelingPrompt(plan)
    const example = JSON.parse(prompt.match(/返回纯 JSON：(.*)/)[1])

    expect(example).toEqual({
      sentiment: '正面',
      tags: ['质量'],
      category: '商品 > 质量',
      valid: true,
      score: 0,
      note: '文本内容'
    })
    expect(prompt).toContain('禁止新增未知字段，禁止遗漏必填字段')
    expect(plan).toEqual(original)
  })

  it('预设按所选输入列创建方案，修改列名称不影响下一次使用', () => {
    const plan = getPresetPlan('sentiment', 2)
    plan.outputColumns[0].name = '自定义情感列'

    expect(plan.inputColumns).toEqual([2])
    expect(plan.promptDirty).toBe(false)
    expect(plan.compiledPrompt).toContain('Positive、Negative、Neutral')
    expect(getPresetPlan('sentiment', 3).outputColumns[0].name).toBe('情感')
    expect(getPresetPlan('unknown', 0)).toBeNull()
  })
})

describe('摘要提示词', () => {
  it('主题约束报告，分析角度与统计资料一起传入', () => {
    const prompt = getDataSummaryPrompt('列统计画像', '20 行', '分层样本', '售后体验', ['负面原因', '改进建议'])

    expect(prompt.systemPrompt).toContain('报告必须紧密围绕主题"售后体验"展开')
    expect(prompt.userPrompt).toContain('20 行')
    expect(prompt.userPrompt).toContain('列统计画像')
    expect(prompt.userPrompt).toContain('1. 负面原因\n2. 改进建议')
  })

  it('未指定主题和角度时，仍可基于统计资料生成通用报告', () => {
    const prompt = getDataSummaryPrompt('列统计画像', '20 行', '分层样本')

    expect(prompt.systemPrompt).not.toContain('报告必须紧密围绕主题')
    expect(prompt.userPrompt).not.toContain('【核心分析角度】')
    expect(prompt.userPrompt).toContain('列统计画像')
    expect(prompt.userPrompt).toContain('分层样本')
  })
})
