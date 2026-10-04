import { cp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { DEMO_DATA } from '../app/src/data/demoData.js'
import { DEFAULT_RULES_CONFIG } from '../app/src/config/defaultSettings.js'
import { runCleaningPipeline } from '../app/src/services/cleaningRules.js'
import { groupAggregate } from '../app/src/services/groupAggregate.js'
import { DEMO_LABELS, DEMO_OUTPUT_COLUMNS } from '../site/demo-labels.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(projectRoot, '.pages-dist')
const appBuild = path.join(projectRoot, 'app/dist')
const appHtml = await readFile(path.join(appBuild, 'index.html'), 'utf8')
if (/(?:src|href)="\/assets\//.test(appHtml)) {
  throw new Error('工作台资源路径需要支持子目录，请先运行 npm --prefix app run build:pages')
}
await mkdir(output, { recursive: true })
await cp(path.join(projectRoot, 'site'), output, {
  recursive: true,
  filter: source => !['README.md', 'demo-labels.mjs'].includes(path.basename(source))
})
await cp(appBuild, path.join(output, 'app'), { recursive: true })

const demo = DEMO_DATA.comments
const audit = runCleaningPipeline(demo.rows, demo.headers, demo.coreColumn, DEFAULT_RULES_CONFIG)
const decisions = audit.map((row, index) => ({ id: demo.rows[index][0], decision: row.decision, reason: row.reason, hitRule: row.hitRule }))
const cleanRows = demo.rows.filter((_, index) => audit[index].decision === 'keep')
const counts = audit.reduce((stats, row) => { stats[row.decision]++; return stats }, { keep: 0, delete: 0, suspect: 0 })
const labels = cleanRows.map(row => {
  const values = DEMO_LABELS[row[0]]
  if (!values) throw new Error(`缺少 ${row[0]} 的产品页演示结果，请同步更新 site/demo-labels.mjs`)
  return { id: row[0], sentiment: values[0], topic: values[1], resolved: values[2] }
})
const demoPayload = {
  name: demo.name, headers: demo.headers, rows: demo.rows, counts, decisions, labels,
  outputColumns: DEMO_OUTPUT_COLUMNS,
  productRatings: groupAggregate(cleanRows, demo.headers.indexOf('产品'), demo.headers.indexOf('评分'), 'avg').groups
}
await writeFile(path.join(output, 'assets/demo-data.json'), JSON.stringify(demoPayload))
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`
const csv = '\uFEFF' + [demo.headers, ...demo.rows].map(row => row.map(csvCell).join(',')).join('\r\n')
await writeFile(path.join(output, 'assets/demo-comments.csv'), csv)
await writeFile(path.join(output, '.nojekyll'), '')
console.log(`产品页已生成：${output}（${demo.rows.length} 行演示数据，${labels.length} 条预设结果）`)
