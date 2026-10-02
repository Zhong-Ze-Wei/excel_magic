/**
 * Prompt 模板的公共入口，具体模板按业务模块维护。
 */
export { formatIntentContext } from './prompts/context.js'
export { getColumnDetectionPrompt, getIntentAnalysisPrompt } from './prompts/intent.js'
export { getSmartFilterPrompt } from './prompts/cleaning.js'
export {
  getLabelingPlanGenerationPrompt,
  compileLabelingPrompt,
  getPlanFromPromptPrompt
} from './prompts/labeling.js'
export { getAnalysisThemePrompt, getDataSummaryPrompt } from './prompts/summary.js'
export { PRESET_TEMPLATES, getPresetPlan } from './prompts/presets.js'
export { MODULE_CAPABILITIES, getCapabilityConstraint } from './prompts/capabilities.js'
