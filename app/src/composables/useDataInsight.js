/**
 * 数据洞察 composable — 双引擎（启发式 / AI）
 * 上传数据后自动分析列类型、核心列理由、模块推荐
 */
import { ref, computed, watch } from 'vue'
import { computeAllProfiles, formatProfilesForAI } from '../services/dataProfiler'
import { getDataInsightPrompt } from '../services/prompts'
import { callAI } from '../services/ai'
import { parseRobustJSON } from '../services/jsonParser'
import { useDataShareStore } from '../stores/dataShare'
import { useSettingsStore } from '../stores/settings'
import { useToast } from '../services/toast'

const TYPE_LABELS = {
  number: '数值', text: '文本', enum: '枚举', boolean: '布尔',
  date: '日期', identifier: '标识', empty: '空列'
}

const TYPE_COLORS = {
  number: 'bg-green-100 text-green-700 border-green-200',
  text: 'bg-blue-100 text-blue-700 border-blue-200',
  enum: 'bg-orange-100 text-orange-700 border-orange-200',
  boolean: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  date: 'bg-purple-100 text-purple-700 border-purple-200',
  identifier: 'bg-slate-100 text-slate-600 border-slate-200',
  empty: 'bg-slate-50 text-slate-400 border-slate-100'
}

export function useDataInsight() {
  const dataShare = useDataShareStore()
  const settings = useSettingsStore()
  const toast = useToast()

  const profiles = ref([])
  const aiResult = ref(null)
  const isAnalyzing = ref(false)

  // 列类型分布
  const typeSummary = computed(() => {
    if (aiResult.value?.columnAnalysis) {
      // AI 模式：按 AI 返回的语义类型统计
      const typeMap = {}
      profiles.value.forEach((p, i) => {
        const sem = aiResult.value.columnAnalysis.find(c => c.index === i)
        const label = sem?.semanticType || TYPE_LABELS[p.type] || p.type
        typeMap[label] = (typeMap[label] || 0) + 1
      })
      return Object.entries(typeMap).map(([label, count]) => {
        const pType = profiles.value.find(p => TYPE_LABELS[p.type] === label)?.type || 'text'
        return { type: pType, label, count, color: TYPE_COLORS[pType] || TYPE_COLORS.text }
      })
    }
    // 规则模式
    const groups = {}
    profiles.value.forEach(p => {
      const label = TYPE_LABELS[p.type] || p.type
      if (!groups[label]) groups[label] = { type: p.type, label, count: 0 }
      groups[label].count++
    })
    return Object.values(groups).map(g => ({ ...g, color: TYPE_COLORS[g.type] || TYPE_COLORS.text }))
  })

  // 核心列理由
  const coreReason = computed(() => {
    if (aiResult.value?.coreReason) return aiResult.value.coreReason
    const coreIdx = dataShare.coreColumn
    const p = profiles.value[coreIdx]
    if (!p) return ''
    const parts = [TYPE_LABELS[p.type] || p.type]
    if (p.type === 'text' && p.avgLength != null) parts.push(`平均 ${p.avgLength} 字`)
    if (p.fillRate != null) parts.push(`${p.fillRate}% 填充率`)
    return `「${p.header}」${parts.join('，')}`
  })

  // 推荐列表
  const recommendations = computed(() => {
    if (aiResult.value?.recommendations?.length) {
      return aiResult.value.recommendations.slice(0, 3)
    }
    return heuristicRecommendations()
  })

  const recommendedRoutes = computed(() => new Set(recommendations.value.map(r => r.route)))

  function heuristicRecommendations() {
    const recs = []
    const coreIdx = dataShare.coreColumn
    const coreP = profiles.value[coreIdx]
    if (!coreP) return recs

    // 规则 1：核心列是文本且较长 → 数据优化
    if (coreP.type === 'text' && (coreP.avgLength ?? 0) > 10) {
      recs.push({ route: '/optimize', reason: '核心列文本丰富，适合 AI 一句话清洗优化' })
    }
    // 规则 2：核心列文本 unique 多 → 数据分析
    const uniqueRatio = coreP.totalCount > 0 ? coreP.uniqueCount / coreP.totalCount : 0
    if (coreP.type === 'text' && uniqueRatio > 0.6) {
      recs.push({ route: '/analysis', reason: '文本内容多样，适合 AI 智能分析打标' })
    }
    // 规则 3：有枚举/布尔列 → 数据摘要
    if (profiles.value.some(p => p.type === 'enum' || p.type === 'boolean')) {
      recs.push({ route: '/summary', reason: '含分类列，适合生成统计摘要报告' })
    }
    // 规则 4：多个文本列 → 翻译
    if (profiles.value.filter(p => p.type === 'text').length > 1) {
      recs.push({ route: '/translate', reason: '多列文本数据，可批量翻译' })
    }
    // 兜底
    if (recs.length === 0) {
      recs.push({ route: '/optimize', reason: '一句话描述目标，AI 自动配置处理' })
    }
    return recs.slice(0, 3)
  }

  // 分析入口
  function runAnalysis() {
    const headers = dataShare.headers
    const rows = dataShare.rows
    if (!headers.length || !rows.length) {
      profiles.value = []
      aiResult.value = null
      return
    }

    // 始终先算规则画像（瞬时，供 UI 基础展示）
    profiles.value = computeAllProfiles(headers, rows.slice(0, 50))

    // 如果是 AI 模式且有 API 配置，异步调 AI
    if (settings.dataInsightMode === 'ai' && settings.isConfigured) {
      runAiAnalysis(headers, rows)
    } else {
      aiResult.value = null
    }
  }

  async function runAiAnalysis(headers, rows) {
    isAnalyzing.value = true
    try {
      const profilesText = formatProfilesForAI(profiles.value)
      const sampleRows = rows.slice(0, 5).map(r =>
        headers.reduce((acc, h, i) => { acc[h] = r[i] ?? ''; return acc }, {})
      )
      const prompt = getDataInsightPrompt(headers, profilesText, sampleRows)
      const raw = await callAI(prompt, '你是一个数据分析专家。', settings.getApiConfig().workModel)
      const parsed = parseRobustJSON(raw)
      if (parsed) {
        aiResult.value = parsed
        // AI 推荐核心列
        if (typeof parsed.recommendedCoreColumn === 'number' &&
          parsed.recommendedCoreColumn >= 0 && parsed.recommendedCoreColumn < headers.length) {
          dataShare.setCoreColumn(parsed.recommendedCoreColumn)
        }
      }
    } catch (err) {
      toast.warn('AI 洞察分析失败，已降级到规则分析')
      aiResult.value = null
    } finally {
      isAnalyzing.value = false
    }
  }

  // 响应数据变化
  watch(() => dataShare.rows.length, () => runAnalysis())
  watch(() => dataShare.coreColumn, () => {
    if (profiles.value.length && !aiResult.value) return // 规则模式核心列变化只影响 computed
  })
  watch(() => settings.dataInsightMode, () => runAnalysis())

  return {
    profiles, typeSummary, coreReason,
    recommendations, recommendedRoutes, isAnalyzing,
    TYPE_LABELS, TYPE_COLORS
  }
}
