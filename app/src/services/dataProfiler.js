/**
 * 数据画像引擎 — 列级统计分析、交叉分析、分层抽样
 */

// ── 列类型检测 ──

const DATE_REGEX = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/
const BOOL_VALUES = new Set(['true', 'false', '是', '否', 'yes', 'no', '0', '1'])

export function detectColumnType(values) {
  const nonNull = values.filter(v => v != null && String(v).trim() !== '')
  if (nonNull.length === 0) return 'empty'

  const total = nonNull.length
  const strValues = nonNull.map(v => String(v).trim())

  // 布尔
  const boolCount = strValues.filter(v => BOOL_VALUES.has(v.toLowerCase())).length
  if (boolCount / total > 0.8 && new Set(strValues.map(v => v.toLowerCase())).size <= 3) return 'boolean'

  // 数值
  const numValues = strValues.filter(v => !isNaN(Number(v)) && v !== '')
  if (numValues.length / total > 0.8) return 'number'

  // 日期
  const dateCount = strValues.filter(v => DATE_REGEX.test(v)).length
  if (dateCount / total > 0.8) return 'date'

  // 标识符
  const unique = new Set(strValues)
  if (unique.size === total && total > 5) return 'identifier'

  // 枚举
  if (unique.size <= 20 && unique.size / total <= 0.3) return 'enum'

  return 'text'
}

// ── 单列画像 ──

export function computeColumnProfile(header, values) {
  const nonNull = values.filter(v => v != null && String(v).trim() !== '')
  const total = values.length
  const fillRate = total > 0 ? (nonNull.length / total * 100) : 0
  const type = detectColumnType(values)
  const strValues = nonNull.map(v => String(v).trim())

  const profile = {
    header,
    type,
    fillRate: Math.round(fillRate * 10) / 10,
    totalCount: total,
    nonNullCount: nonNull.length,
    uniqueCount: new Set(strValues).size
  }

  if (type === 'number') {
    const nums = strValues.map(Number).filter(n => !isNaN(n))
    if (nums.length > 0) {
      nums.sort((a, b) => a - b)
      profile.min = nums[0]
      profile.max = nums[nums.length - 1]
      profile.mean = Math.round(nums.reduce((s, n) => s + n, 0) / nums.length * 100) / 100
      profile.median = nums.length % 2 === 0
        ? (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2
        : nums[Math.floor(nums.length / 2)]
      const variance = nums.reduce((s, n) => s + Math.pow(n - profile.mean, 2), 0) / nums.length
      profile.stddev = Math.round(Math.sqrt(variance) * 100) / 100
      // 分位数分布
      const buckets = 5
      profile.distribution = {}
      for (let i = 0; i < buckets; i++) {
        const lo = profile.min + (profile.max - profile.min) * i / buckets
        const hi = profile.min + (profile.max - profile.min) * (i + 1) / buckets
        const count = nums.filter(n => i === buckets - 1 ? (n >= lo && n <= hi) : (n >= lo && n < hi)).length
        profile.distribution[`${Math.round(lo)}~${Math.round(hi)}`] = count
      }
    }
  }

  if (type === 'enum' || type === 'boolean') {
    const freq = {}
    strValues.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
    profile.valueDistribution = {}
    sorted.slice(0, 15).forEach(([k, v]) => {
      profile.valueDistribution[k] = Math.round(v / nonNull.length * 100)
    })
    profile.topValues = sorted.slice(0, 10).map(([k, v]) => `${k}(${Math.round(v / nonNull.length * 100)}%)`)
  }

  if (type === 'text') {
    const lengths = strValues.map(v => v.length)
    if (lengths.length > 0) {
      profile.minLength = Math.min(...lengths)
      profile.maxLength = Math.max(...lengths)
      profile.avgLength = Math.round(lengths.reduce((s, l) => s + l, 0) / lengths.length)
    }
    // 高频词（简单中文分词：按标点/空格切分，取 2-4 字的片段）
    const words = {}
    strValues.forEach(v => {
      const segments = v.split(/[\s,，。.!！?？、；;：:""''\"'\n\r\t]+/).filter(s => s.length >= 2 && s.length <= 8)
      segments.forEach(w => { words[w] = (words[w] || 0) + 1 })
    })
    profile.topWords = Object.entries(words)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w, c]) => `${w}(${c})`)
  }

  if (type === 'date') {
    const dates = strValues.filter(v => DATE_REGEX.test(v)).sort()
    if (dates.length > 0) {
      profile.dateRange = `${dates[0].substring(0, 10)} ~ ${dates[dates.length - 1].substring(0, 10)}`
    }
  }

  // 样例值（去重后取前 3 个）
  const uniqueSamples = [...new Set(strValues)].slice(0, 3)
  profile.samples = uniqueSamples

  return profile
}

// ── 全表画像 ──

export function computeAllProfiles(headers, rows, selectedCols = null) {
  const colIndexes = selectedCols || headers.map((_, i) => i)
  return colIndexes.map(ci => {
    const values = rows.map(r => r[ci])
    return computeColumnProfile(headers[ci], values)
  })
}

// ── 交叉统计 ──

export function computeCrossTabs(headers, rows, dimColIndexes, valueColIndexes) {
  if (!dimColIndexes || dimColIndexes.length === 0) return []
  const results = []

  for (const dimCI of dimColIndexes) {
    const dimHeader = headers[dimCI]
    // 按维度列分组
    const groups = {}
    rows.forEach(row => {
      const dimVal = String(row[dimCI] ?? '').trim() || '(空)'
      if (!groups[dimVal]) groups[dimVal] = []
      groups[dimVal].push(row)
    })

    for (const valCI of valueColIndexes) {
      if (valCI === dimCI) continue
      const valHeader = headers[valCI]
      const valType = detectColumnType(rows.map(r => r[valCI]))
      const crossTab = { dimension: dimHeader, metric: valHeader, metricType: valType, groups: {} }

      for (const [dimVal, groupRows] of Object.entries(groups)) {
        const vals = groupRows.map(r => r[valCI]).filter(v => v != null && String(v).trim() !== '')

        if (valType === 'number') {
          const nums = vals.map(Number).filter(n => !isNaN(n))
          if (nums.length > 0) {
            crossTab.groups[dimVal] = {
              count: nums.length,
              mean: Math.round(nums.reduce((s, n) => s + n, 0) / nums.length * 100) / 100
            }
          }
        } else {
          // 枚举/文本：值分布
          const freq = {}
          vals.forEach(v => { freq[String(v)] = (freq[String(v)] || 0) + 1 })
          const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
          crossTab.groups[dimVal] = {
            count: vals.length,
            distribution: top.map(([k, v]) => `${k}(${Math.round(v / vals.length * 100)}%)`)
          }
        }
      }
      results.push(crossTab)
    }
  }

  return results
}

// ── 分层抽样（头/中/尾） ──

export function stratifiedSample(headers, rows, count = 6) {
  if (rows.length <= count) {
    return rows.map(r => headers.reduce((acc, h, i) => { acc[h] = r[i] ?? ''; return acc }, {}))
  }

  const headN = Math.ceil(count / 3)
  const midN = Math.ceil(count / 3)
  const tailN = count - headN - midN

  const mid = Math.floor(rows.length / 2)

  const head = rows.slice(0, headN)
  const midRows = rows.slice(mid - Math.floor(midN / 2), mid + Math.ceil(midN / 2))
  const tail = rows.slice(rows.length - tailN)

  return [...head, ...midRows, ...tail].map(r =>
    headers.reduce((acc, h, i) => { acc[h] = r[i] ?? ''; return acc }, {})
  )
}

// ── 格式化为 AI 可读文本 ──

export function formatProfilesForAI(profiles, crossTabs = []) {
  let text = ''

  text += '【列级统计画像】\n'
  for (const p of profiles) {
    text += `\n列 "${p.header}"\n`
    text += `  类型: ${typeLabel(p.type)}\n`
    text += `  非空率: ${p.fillRate}%\n`

    if (p.type === 'number') {
      if (p.min != null) {
        text += `  范围: [${p.min}, ${p.max}]\n`
        text += `  均值: ${p.mean} | 中位数: ${p.median} | 标准差: ${p.stddev}\n`
      }
      if (p.distribution) {
        text += `  分布: ${Object.entries(p.distribution).map(([k, v]) => `${k}(${v})`).join(' ')}\n`
      }
    } else if (p.type === 'enum' || p.type === 'boolean') {
      text += `  唯一值: ${p.uniqueCount}\n`
      if (p.topValues) text += `  值分布: ${p.topValues.join(' ')}\n`
    } else if (p.type === 'text') {
      if (p.minLength != null) text += `  文本长度: 最短 ${p.minLength} 字 | 最长 ${p.maxLength} 字 | 平均 ${p.avgLength} 字\n`
      if (p.topWords?.length) text += `  高频词: ${p.topWords.join(', ')}\n`
    } else if (p.type === 'date') {
      if (p.dateRange) text += `  日期范围: ${p.dateRange}\n`
    } else if (p.type === 'identifier') {
      text += `  唯一值: ${p.uniqueCount} / ${p.totalCount} (${Math.round(p.uniqueCount / p.totalCount * 100)}%)\n`
    }

    if (p.samples?.length) {
      text += `  样例: ${p.samples.map(s => s.length > 50 ? s.substring(0, 50) + '...' : s).join(' | ')}\n`
    }
  }

  if (crossTabs.length > 0) {
    text += '\n【交叉分析】\n'
    for (const ct of crossTabs) {
      text += `\n按"${ct.dimension}"分组的"${ct.metric}"统计:\n`
      const entries = Object.entries(ct.groups).slice(0, 10)
      for (const [dimVal, stat] of entries) {
        if (ct.metricType === 'number') {
          text += `  ${dimVal}: 均值=${stat.mean} (n=${stat.count})\n`
        } else {
          text += `  ${dimVal}: ${stat.distribution?.join(' ') || '-'} (n=${stat.count})\n`
        }
      }
    }
  }

  return text
}

function typeLabel(type) {
  const map = {
    number: '数值', text: '文本', enum: '枚举', boolean: '布尔',
    date: '日期', identifier: '标识符', empty: '空列'
  }
  return map[type] || type
}

// ── 格式化分层样本 ──

export function formatSampleRows(sampleRows) {
  return sampleRows.map((row, i) => `${i + 1}. ${Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', ')}`).join('\n')
}
