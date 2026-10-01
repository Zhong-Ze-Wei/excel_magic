import { compileLabelingPrompt } from './labeling.js'

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
