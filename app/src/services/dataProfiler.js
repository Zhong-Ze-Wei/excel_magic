/**
 * 数据画像引擎 — 列级统计分析、分层抽样
 */

// ── 列类型检测 ──

const DATE_REGEX = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?=$|[T\s])/
const BOOL_VALUES = new Set(['true', 'false', '是', '否', 'yes', 'no', '0', '1'])

function parseDate(value) {
  const match = DATE_REGEX.exec(value)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { time: date.getTime(), text: match[0] }
}

function roundStatistic(number) {
  const scaled = number * 100
  return Number.isFinite(scaled) ? Math.round(scaled) / 100 : number
}

export function detectColumnType(values) {
  const nonNull = values.filter(v => v != null && String(v).trim() !== '')
  if (nonNull.length === 0) return 'empty'

  const total = nonNull.length
  const strValues = nonNull.map(v => String(v).trim())

  // 布尔
  const boolCount = strValues.filter(v => BOOL_VALUES.has(v.toLowerCase())).length
  if (boolCount / total > 0.8 && new Set(strValues.map(v => v.toLowerCase())).size <= 3) return 'boolean'

  // 数值
  const numValues = strValues.filter(v => Number.isFinite(Number(v)) && v !== '')
  if (numValues.length / total > 0.8) return 'number'

  // 日期
  const dateCount = strValues.filter(v => parseDate(v) !== null).length
  if (dateCount / total > 0.8) return 'date'

  // 标识符 — 高唯一性 + 短值（排除长文本内容列）
  const unique = new Set(strValues)
  const avgLen = strValues.reduce((s, v) => s + v.length, 0) / total
  if (unique.size === total && total > 5 && avgLen < 30) return 'identifier'

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
    const nums = strValues.map(Number).filter(Number.isFinite)
    if (nums.length > 0) {
      nums.sort((a, b) => a - b)
      profile.min = nums[0]
      profile.max = nums[nums.length - 1]
      const scale = Math.max(Math.abs(profile.min), Math.abs(profile.max))
      const scaledMean = scale ? nums.reduce((s, n) => s + n / scale, 0) / nums.length : 0
      const mean = scaledMean * scale
      profile.mean = roundStatistic(mean)
      profile.median = nums.length % 2 === 0
        ? nums[nums.length / 2 - 1] / 2 + nums[nums.length / 2] / 2
        : nums[Math.floor(nums.length / 2)]
      // 先缩放再计算方差，避免有限大数在平方时溢出。
      const variance = scale ? nums.reduce((s, n) => s + Math.pow(n / scale - scaledMean, 2), 0) / nums.length : 0
      // 缩放值均在 [-1, 1]，总体标准差上限为 1；消除边界舍入引起的溢出。
      profile.stddev = roundStatistic(Math.min(Math.sqrt(variance), 1) * scale)
      // 等宽分布；常量列只有一个桶，小数边界保留精度。
      const buckets = 5
      profile.distribution = {}
      if (profile.min === profile.max) {
        profile.distribution[`${profile.min}~${profile.max}`] = nums.length
      } else {
        const boundaries = Array.from({ length: buckets + 1 }, (_, i) =>
          profile.min * (1 - i / buckets) + profile.max * (i / buckets))
        for (let i = 0; i < buckets; i++) {
          const lo = boundaries[i], hi = boundaries[i + 1]
          const count = nums.filter(n => i === buckets - 1 ? n >= lo && n <= hi : n >= lo && n < hi).length
          const key = `${lo}~${hi}`
          profile.distribution[key] = (profile.distribution[key] || 0) + count
        }
      }
    }
  }

  if (type === 'enum' || type === 'boolean') {
    const freq = Object.create(null)
    strValues.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
    profile.valueDistribution = Object.fromEntries(sorted.slice(0, 15).map(([k, v]) => [k, Math.round(v / nonNull.length * 100)]))
    profile.topValues = sorted.slice(0, 10).map(([k, v]) => `${k}(${Math.round(v / nonNull.length * 100)}%)`)
  }

  if (type === 'text') {
    if (strValues.length > 0) {
      let minLength = Infinity, maxLength = 0, totalLength = 0
      for (const value of strValues) {
        minLength = Math.min(minLength, value.length)
        maxLength = Math.max(maxLength, value.length)
        totalLength += value.length
      }
      profile.minLength = minLength
      profile.maxLength = maxLength
      profile.avgLength = Math.round(totalLength / strValues.length)
    }
    // 高频词（简单中文分词：按标点/空格切分，取 2-4 字的片段）
    const words = Object.create(null)
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
    const dates = strValues.map(parseDate).filter(Boolean).sort((a, b) => a.time - b.time)
    if (dates.length > 0) {
      profile.dateRange = `${dates[0].text} ~ ${dates[dates.length - 1].text}`
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

// ── 分层抽样（头/中/尾） ──

export function stratifiedSample(headers, rows, count = 6) {
  if (!Number.isFinite(count) || count <= 0) return []
  count = Math.floor(count)
  const toRecord = row => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? '']))
  if (rows.length <= count) {
    return rows.map(toRecord)
  }

  const headN = Math.ceil(count / 3)
  const midN = Math.min(Math.ceil(count / 3), count - headN)
  const tailN = count - headN - midN

  const mid = Math.floor(rows.length / 2)

  const head = rows.slice(0, headN)
  const midRows = rows.slice(mid - Math.floor(midN / 2), mid + Math.ceil(midN / 2))
  const tail = rows.slice(rows.length - tailN)

  return [...head, ...midRows, ...tail].map(toRecord)
}

// ── 格式化为 AI 可读文本 ──

export function formatProfilesForAI(profiles) {
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
