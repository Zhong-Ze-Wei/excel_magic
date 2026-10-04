const stepTabs = [...document.querySelectorAll('[data-step]')]
const screenTabs = [...document.querySelectorAll('[data-screen]')]
const panel = document.querySelector('#demo-panel')
const playButton = document.querySelector('#play-demo')
const stageDetails = [
  ['00 / YOUR ORIGINAL DATA', '先看看，这份表格里有什么。', '耳机、风扇、保温杯的用户评论。评分、点赞、渠道和时间都在同一张表里。', '条原始评论'],
  ['01 / LESS NOISE, MORE SIGNAL', '先过滤噪声，把判断留给你。', '默认规则清洗：重复、空白与广告被过滤。真实售后反馈可能命中关键词，留待人工确认。', '条默认保留'],
  ['02 / FROM WORDS TO STRUCTURE', '评价里的意思，变成三列标签。', '“音质好但戴着疼”是混合评价。“发生过故障”也不代表售后没有解决。', '条预设打标结果'],
  ['03 / MAKE THE DIFFERENCE VISIBLE', '产品之间的差异，一眼看见。', '按产品统计评分均值，保留原文和明细，方便继续追问“为什么”。', '个产品分组'],
  ['04 / A REPORT YOU CAN SHARE', '最后，把发现写成可读的报告。', '带着主题、统计与评论语境生成摘要，帮助你继续讨论和行动。', '条有效反馈']
]
const screenDetails = {
  cleaning: ['数据清洗', '默认保留 24 条、过滤 7 条、待确认 1 条，并可逐行复核', '先自动判断，再人工复核。清洗并不会跳过你的决定。'],
  process: ['智能加工', '为模拟评论补充情感倾向、反馈主题、售后已解决等输出列', '方案与结果一起展示。这张截图使用预设打标结果。'],
  aggregate: ['分组对比', '按产品统计有效评论的评分均值，展示柱状图与明细', '从评分差异出发，再结合评论原文看具体问题。'],
  summary: ['数据摘要', '查看列画像与电商评论报告，报告内容为预设演示文本', '统计为真实规则计算，报告为预设演示，不代表模型实际输出。']
}
const sampleIds = ['R004', 'R009', 'R016', 'R025', 'R027', 'R032']
const processedSampleIds = ['R004', 'R009', 'R010', 'R015', 'R016', 'R024']
let demoData
let currentStep = 0
let timer = null
let playing = false

function cell(text, className = '') {
  const td = document.createElement('td')
  td.textContent = text
  if (className) td.className = className
  return td
}

function tag(text, tone) {
  const span = document.createElement('span')
  span.className = `status-pill ${tone}`
  span.textContent = text
  return span
}

function renderTable(step) {
  const table = document.querySelector('.demo-table')
  const head = document.querySelector('#demo-table-head')
  const body = document.querySelector('#demo-table-body')
  const processing = step === 2
  const columns = processing ? ['记录', '评论内容', '情感倾向', '反馈主题', '售后已解决'] : ['记录', '产品', '评论内容', step === 1 ? '清洗决策' : '评分']
  const tr = document.createElement('tr')
  columns.forEach(name => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = name; tr.append(th) })
  head.replaceChildren(tr)
  table.classList.toggle('tags-table', processing)
  const ids = processing ? processedSampleIds : sampleIds
  const rows = ids.map(id => {
    const row = demoData.rows.find(row => row[0] === id)
    const item = document.createElement('tr')
    item.append(cell(id))
    if (processing) {
      const label = demoData.labels.find(label => label.id === id)
      item.append(cell(row[2], 'comment-cell'))
      const sentiment = cell('')
      const tones = { '正向': 'positive', '负向': 'negative', '中性': 'neutral', '褒贬混合': 'mixed' }
      sentiment.append(tag(label.sentiment, tones[label.sentiment]))
      item.append(sentiment, cell(label.topic), cell(label.resolved ? '已解决' : '未提及解决'))
    } else {
      item.append(cell(row[3]), cell(row[2].trim() || '（空白评论）', 'comment-cell' + (!row[2].trim() ? ' muted-text' : '')))
      if (step === 1) {
        const decision = demoData.decisions.find(result => result.id === id).decision
        const states = { keep: ['保留', 'positive'], delete: ['过滤', 'negative'], suspect: ['待确认', 'pending'] }
        const status = cell('')
        status.append(tag(...states[decision]))
        item.append(status)
        if (decision !== 'keep') item.className = decision === 'delete' ? 'demo-deleted' : 'demo-pending'
      } else item.append(cell(row[4] == null ? '未评分' : `${row[4]} / 5`))
    }
    return item
  })
  body.replaceChildren(...rows)
}

function renderBars() {
  const bars = demoData.productRatings.map(product => {
    const row = document.createElement('div')
    row.className = 'demo-bar'
    const name = document.createElement('span')
    name.textContent = product.group
    const track = document.createElement('div')
    track.className = 'demo-bar-track'
    const fill = document.createElement('div')
    fill.className = 'demo-bar-fill'
    fill.style.width = `${product.value / 5 * 100}%`
    track.append(fill)
    const value = document.createElement('span')
    value.className = 'demo-bar-value'
    value.textContent = product.value.toFixed(2)
    row.append(name, track, value)
    return row
  })
  document.querySelector('#demo-bars').replaceChildren(...bars)
}

function setStep(step) {
  currentStep = step
  stepTabs.forEach((tab, index) => {
    tab.setAttribute('aria-selected', String(index === step))
    tab.tabIndex = index === step ? 0 : -1
  })
  panel.setAttribute('aria-labelledby', `step-${step}`)
  const [kicker, title, description, metricLabel] = stageDetails[step]
  document.querySelector('#demo-kicker').textContent = kicker
  document.querySelector('#demo-stage-title').textContent = title
  document.querySelector('#demo-stage-copy').textContent = description
  const metrics = [demoData.rows.length, demoData.counts.keep, demoData.labels.length, demoData.productRatings.length, demoData.counts.keep]
  document.querySelector('#demo-metric-value').textContent = metrics[step]
  document.querySelector('#demo-metric-label').textContent = metricLabel
  document.querySelector('#demo-table-wrap').hidden = step >= 3
  document.querySelector('#demo-comparison').hidden = step !== 3
  document.querySelector('#demo-report').hidden = step !== 4
  if (step < 3) renderTable(step)
  if (step === 3) renderBars()
  const notes = [
    '无需 API Key。演示中的标签与摘要为预设结果，不发送 AI 请求。',
    `${demoData.counts.keep} 条保留 · ${demoData.counts.delete} 条过滤 · ${demoData.counts.suspect} 条待确认。规则结果由项目实际清洗逻辑计算。`,
    '标签为预设演示结果。实际加工请在工作台配置自己的模型服务。',
    '评分统计来自默认保留的数据。模拟样本不代表真实产品或渠道表现。',
    '这是一份预设摘要。实际 AI 报告会根据所选数据、主题和模型生成。'
  ]
  document.querySelector('#demo-result-note').textContent = notes[step]
  panel.classList.remove('panel-enter')
  void panel.offsetWidth
  panel.classList.add('panel-enter')
}

function pausePlayback() {
  clearTimeout(timer)
  timer = null
  playing = false
  playButton.querySelector('.play-symbol').textContent = '▶'
  playButton.querySelector('.play-label').textContent = currentStep === 4 ? '再播放一次' : '播放流程'
}

function scheduleNextStep() {
  timer = setTimeout(() => {
    if (currentStep === 4) { pausePlayback(); return }
    setStep(currentStep + 1)
    scheduleNextStep()
  }, 2900)
}

playButton.addEventListener('click', () => {
  if (playing) { pausePlayback(); return }
  if (currentStep === 4) setStep(0)
  playing = true
  playButton.querySelector('.play-symbol').textContent = 'Ⅱ'
  playButton.querySelector('.play-label').textContent = '暂停演示'
  scheduleNextStep()
})

stepTabs.forEach(tab => tab.addEventListener('click', () => {
  if (!demoData) return
  pausePlayback()
  setStep(Number(tab.dataset.step))
}))
document.querySelector('#reset-demo').addEventListener('click', () => {
  if (!demoData) return
  pausePlayback()
  setStep(0)
})
document.addEventListener('visibilitychange', () => { if (document.hidden) pausePlayback() })

function keyboardTabs(tabs) {
  tabs.forEach((tab, index) => tab.addEventListener('keydown', event => {
    let next
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = tabs.length - 1
    if (next === undefined) return
    event.preventDefault()
    tabs[next].focus()
    tabs[next].click()
  }))
}
keyboardTabs(stepTabs)
keyboardTabs(screenTabs)

screenTabs.forEach(tab => tab.addEventListener('click', () => {
  screenTabs.forEach(item => {
    item.setAttribute('aria-selected', String(item === tab))
    item.tabIndex = item === tab ? 0 : -1
  })
  const key = tab.dataset.screen
  const [title, alt, caption] = screenDetails[key]
  document.querySelector('#screen-panel').setAttribute('aria-labelledby', tab.id)
  document.querySelector('#screen-window-title').textContent = `MagicExcel / ${title}`
  const img = document.querySelector('#screen-image')
  img.src = `./assets/screens/${key}.png`
  img.alt = `${title}界面：${alt}`
  document.querySelector('#screen-caption').textContent = caption
  document.querySelector('#zoom-screen').setAttribute('aria-label', `放大${title}界面截图`)
}))

const dialog = document.querySelector('#screenshot-dialog')
document.querySelector('#zoom-screen').addEventListener('click', () => {
  const current = document.querySelector('#screen-image')
  const image = document.querySelector('#dialog-image')
  image.src = current.src
  image.alt = current.alt
  document.querySelector('#screenshot-dialog-title').textContent = document.querySelector('#screen-window-title').textContent
  dialog.showModal()
})
document.querySelector('#close-screenshot').addEventListener('click', () => dialog.close())
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })

fetch('./assets/demo-data.json')
  .then(response => { if (!response.ok) throw new Error('演示数据加载失败'); return response.json() })
  .then(data => { demoData = data; setStep(0); playButton.disabled = false })
  .catch(() => {
    const row = document.createElement('tr')
    const message = cell('演示数据暂时无法加载，请刷新页面，或下载示例 CSV 体验工作台。')
    message.colSpan = 4
    row.append(message)
    document.querySelector('#demo-table-body').replaceChildren(row)
    document.querySelector('#demo-result-note').textContent = '演示暂不可用；产品介绍、截图和工作台入口仍可使用。'
  })
