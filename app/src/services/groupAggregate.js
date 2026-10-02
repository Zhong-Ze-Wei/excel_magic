/**
 * 分组聚合算子 — 按 A 列分组，对 B 列做 SUM/AVG/COUNT/MIN/MAX
 *
 * 设计原则：
 * - 纯函数，无副作用，易测试（参考 dataProfiler.js 风格）
 * - 输入 rows + 列索引 + 聚合方式，输出 [{group, value}] 排序后的数组
 * - 数值列自动转换（兼容字符串数字），空值和非数值不参与数值聚合（COUNT 除外）
 */

export const AGGREGATE_OPS = [
  { key: 'sum',   label: '求和 (SUM)',   desc: '各组该列的总和',     needNumeric: true },
  { key: 'avg',   label: '均值 (AVG)',   desc: '各组该列的平均值',   needNumeric: true },
  { key: 'count', label: '计数 (COUNT)', desc: '各组的数据行数',     needNumeric: false },
  { key: 'min',   label: '最小 (MIN)',   desc: '各组该列的最小值',   needNumeric: true },
  { key: 'max',   label: '最大 (MAX)',   desc: '各组该列的最大值',   needNumeric: true }
]

/**
 * 把单元格值转为数值。空值/非数字返回 null。
 * @param {*} v
 * @returns {number|null}
 */
function toNumber(v) {
  if (v == null || String(v).trim() === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  return Number.isFinite(n) ? n : null
}

/**
 * 分组聚合主函数。
 *
 * @param {Array<Array>} rows  二维数组（每行是一个原始行）
 * @param {number} groupColIdx 分组列索引（按此列的值分组）
 * @param {number} valueColIdx 值列索引（对此列做聚合）
 * @param {string} op 聚合方式：sum / avg / count / min / max
 * @returns {{ groups: Array<{group:string, value:number, count:number}>, meta: { op, totalGroups, totalRows } }}
 */
export function groupAggregate(rows, groupColIdx, valueColIdx, op) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { groups: [], meta: { op, totalGroups: 0, totalRows: 0 } }
  }

  // 1. 分组：把每行的 (分组键, 值) 收集到 Map 里
  const buckets = new Map() // groupKey → { values: number[], count: number }
  for (const row of rows) {
    const rawGroup = row[groupColIdx]
    const groupKey = rawGroup == null || String(rawGroup).trim() === '' ? '(空)' : String(rawGroup).trim()

    if (!buckets.has(groupKey)) {
      buckets.set(groupKey, { values: [], count: 0 })
    }
    const bucket = buckets.get(groupKey)
    bucket.count++

    // COUNT 不需要值列是数值，其他 op 需要
    if (op !== 'count') {
      const num = toNumber(row[valueColIdx])
      if (num !== null) bucket.values.push(num)
    }
  }

  // 2. 对每个分组计算聚合值
  const groups = []
  for (const [groupKey, bucket] of buckets) {
    let value = 0
    switch (op) {
      case 'sum': {
        value = bucket.values.reduce((s, v) => s + v, 0)
        break
      }
      case 'avg': {
        const scale = bucket.values.reduce((max, current) => Math.max(max, Math.abs(current)), 0)
        value = scale ? bucket.values.reduce((s, v) => s + v / scale, 0) / bucket.values.length * scale : 0
        break
      }
      case 'count': {
        value = bucket.count
        break
      }
      case 'min': {
        value = bucket.values.length > 0 ? bucket.values.reduce((min, current) => Math.min(min, current), Infinity) : 0
        break
      }
      case 'max': {
        value = bucket.values.length > 0 ? bucket.values.reduce((max, current) => Math.max(max, current), -Infinity) : 0
        break
      }
      default: {
        value = 0
      }
    }
    groups.push({ group: groupKey, value: round(value), count: bucket.count })
  }

  // 3. 排序：默认按聚合值降序（对比场景最直观）
  groups.sort((a, b) => b.value - a.value)

  return {
    groups,
    meta: { op, totalGroups: groups.length, totalRows: rows.length }
  }
}

/**
 * 数值四舍五入到 2 位小数（避免浮点精度问题）。
 */
function round(n) {
  if (!Number.isFinite(n)) throw new RangeError('聚合结果超出可表示的数值范围')
  const scaled = n * 100
  return Number.isFinite(scaled) ? Math.round(scaled) / 100 : n
}

/**
 * 格式化聚合值用于展示（大数字加千分位）。
 */
export function formatAggregateValue(value, op) {
  if (op === 'count') return String(Math.round(value))
  if (Number.isInteger(value)) return value.toLocaleString('zh-CN')
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/**
 * 把聚合结果转为可导出的二维表（表头 + 数据行）。
 * @param {Array} groups groupAggregate 返回的 groups
 * @param {string} groupHeader 分组列名
 * @param {string} valueHeader 值列名 + 聚合方式
 * @returns {{ headers: string[], rows: Array<Array> }}
 */
export function aggregateResultToTable(groups, groupHeader, valueHeader) {
  const headers = [groupHeader, valueHeader, '数据行数']
  const rows = groups.map(g => [g.group, g.value, g.count])
  return { headers, rows }
}
