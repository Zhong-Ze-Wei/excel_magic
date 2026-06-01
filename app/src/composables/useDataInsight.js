/**
 * 数据洞察 composable — 双引擎（启发式 / AI）
 * 上传数据后自动分析：表格类型、核心列、列概览、模块推荐
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

// ── 表格类型检测 ──

function detectTableType(headers) {
  const h = headers.join(' ')
  if (/评论|回复|comment|review|feedback/.test(h))
    return { label: '评论/反馈数据', desc: '包含用户评论、回复和反馈内容' }
  if (/订单|交易|购买|销售|order|transaction/.test(h))
    return { label: '订单/交易数据', desc: '包含交易记录和销售数据' }
  if (/问卷|调查|survey/.test(h))
    return { label: '问卷/调查数据', desc: '包含调查问卷回复' }
  if (/产品|商品|库存|product|inventory|sku/.test(h))
    return { label: '产品/商品数据', desc: '包含产品信息和库存数据' }
  if (/日志|log|记录|trace/.test(h))
    return { label: '日志/记录数据', desc: '包含系统或业务日志' }
  return { label: '综合数据表', desc: '包含多种数据类型的混合表格' }
}

// ── 核心列信息密度评分 ──

function scoreColumnForCore(p) {
  if (p.type === 'empty') return -1
  let score = 0
  // 文本列最可能是核心
  if (p.type === 'text') score += 50
  else if (p.type === 'enum') score += 10
  else if (p.type === 'number') score += 5
  // 信息密度：文本越长信息越多
  if (p.avgLength) score += Math.min(p.avgLength, 150) * 0.4
  // 填充率
  score += (p.fillRate || 0) * 0.15
  // 非标识列的唯一性有价值
  if (p.type !== 'identifier') {
    const ratio = p.totalCount > 0 ? p.uniqueCount / p.totalCount : 0
    score += ratio * 15
  }
  return score
}

export function useDataInsight() {
  const dataShare = useDataShareStore()
  const settings = useSettingsStore()
  const toast = useToast()

  const profiles = ref([])
  const aiResult = ref(null)
  const isAnalyzing = ref(false)

  // 表格类型
  const tableType = computed(() => {
    if (aiResult.value?.tableType) {
      return { label: aiResult.value.tableType, desc: aiResult.value.tableTypeDesc || '' }
    }
    return detectTableType(dataShare.headers)
  })

  // 推荐核心列索引（按信息密度评分）
  const recommendedCoreIdx = computed(() => {
    if (aiResult.value?.recommendedCoreColumn != null) {
      return aiResult.value.recommendedCoreColumn
    }
    let bestIdx = 0, bestScore = -1
    profiles.value.forEach((p, i) => {
      const s = scoreColumnForCore(p)
      if (s > bestScore) { bestScore = s; bestIdx = i }
    })
    return bestIdx
  })

  // 核心列理由
  const coreReason = computed(() => {
    const idx = recommendedCoreIdx.value
    const p = profiles.value[idx]
    if (!p) return ''
    if (aiResult.value?.coreReason) return aiResult.value.coreReason

    const parts = []
    if (p.type === 'text') {
      parts.push(`文本列，信息密度最高`)
      if (p.avgLength) parts.push(`平均 ${p.avgLength} 字`)
      if (p.uniqueCount && p.totalCount) {
        const ratio = Math.round(p.uniqueCount / p.totalCount * 100)
        parts.push(`${ratio}% 内容不重复`)
      }
      if (p.fillRate != null) parts.push(`${p.fillRate}% 填充`)
    } else if (p.type === 'enum') {
      parts.push(`枚举列，${p.uniqueCount} 个类别`)
      if (p.topValues?.length) parts.push(`如: ${p.topValues.slice(0, 3).join('、')}`)
    } else if (p.type === 'number') {
      parts.push('数值列')
      if (p.min != null) parts.push(`范围 ${p.min}~${p.max}`)
    } else {
      parts.push(TYPE_LABELS[p.type] || p.type)
    }
    return parts.join('，')
  })

  // 列分组概览
  const columnOverview = computed(() => {
    const groups = {}
    profiles.value.forEach(p => {
      if (!groups[p.type]) {
        groups[p.type] = { type: p.type, label: TYPE_LABELS[p.type] || p.type, color: TYPE_COLORS[p.type] || '', columns: [] }
      }
      let stat = ''
      if (p.type === 'text') stat = p.avgLength ? `${p.avgLength}字` : `${p.uniqueCount}唯一`
      else if (p.type === 'number') stat = p.min != null ? `${p.min}~${p.max}` : ''
      else if (p.type === 'enum' || p.type === 'boolean') stat = `${p.uniqueCount}类`
      else if (p.type === 'identifier') stat = `${p.uniqueCount}唯一`
      else if (p.type === 'date') stat = p.dateRange || ''
      groups[p.type].columns.push({ header: p.header, stat, isCore: false })
    })
    // 标记核心列
    const coreIdx = recommendedCoreIdx.value
    Object.values(groups).forEach(g => {
      g.columns.forEach((c, i) => {
        const globalIdx = profiles.value.findIndex(p => p.header === c.header)
        c.isCore = globalIdx === coreIdx
      })
    })
    // 排序：文本优先，然后按数量降序
    const order = { text: 0, enum: 1, number: 2, boolean: 3, date: 4, identifier: 5, empty: 6 }
    return Object.values(groups).sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))
  })

  // 列类型分布（紧凑分组）
  const typeSummary = computed(() => {
    const groups = {}
    profiles.value.forEach(p => {
      const label = TYPE_LABELS[p.type] || p.type
      if (!groups[label]) groups[label] = { type: p.type, label, count: 0 }
      groups[label].count++
    })
    return Object.values(groups).map(g => ({ ...g, color: TYPE_COLORS[g.type] || TYPE_COLORS.text }))
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
    const coreIdx = recommendedCoreIdx.value
    const coreP = profiles.value[coreIdx]
    if (!coreP) return recs

    if (coreP.type === 'text' && (coreP.avgLength ?? 0) > 10) {
      recs.push({ route: '/optimize', reason: `「${coreP.header}」文本丰富（均${coreP.avgLength}字），适合 AI 一句话清洗` })
    }
    if (coreP.type === 'text' && coreP.totalCount > 0 && coreP.uniqueCount / coreP.totalCount > 0.3) {
      recs.push({ route: '/analysis', reason: `「${coreP.header}」内容多样，适合 AI 智能分析打标` })
    }
    if (profiles.value.some(p => p.type === 'enum' || p.type === 'boolean')) {
      recs.push({ route: '/summary', reason: '含分类列，适合生成统计摘要报告' })
    }
    if (profiles.value.filter(p => p.type === 'text').length > 1) {
      recs.push({ route: '/translate', reason: '多列文本数据，可批量翻译' })
    }
    if (recs.length === 0) {
      recs.push({ route: '/optimize', reason: '一句话描述目标，AI 自动配置处理' })
    }
    return recs.slice(0, 3)
  }

  // ── 分析入口 ──

  function runAnalysis() {
    const headers = dataShare.headers
    const rows = dataShare.rows
    if (!headers.length || !rows.length) {
      profiles.value = []
      aiResult.value = null
      return
    }

    // 始终先算规则画像（瞬时）
    profiles.value = computeAllProfiles(headers, rows.slice(0, 50))

    // AI 模式 + 已配置 → 异步调 AI
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
  watch(() => settings.dataInsightMode, () => runAnalysis())

  return {
    profiles, tableType, recommendedCoreIdx, coreReason,
    columnOverview, typeSummary,
    recommendations, recommendedRoutes, isAnalyzing,
    TYPE_LABELS, TYPE_COLORS
  }
}
