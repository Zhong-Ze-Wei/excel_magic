/**
 * Excel/CSV 文件读写服务 — 封装 SheetJS
 */
import * as XLSX from 'xlsx'

/**
 * 解码 CSV 文本：UTF-8 优先，GBK 兜底
 * BOM → UTF-8；无 BOM 则尝试 UTF-8，出现替换字符 U+FFFD → GBK
 */
function decodeCSVText(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes)
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return text.includes('�')
    ? new TextDecoder('gbk').decode(bytes)
    : text
}

/**
 * 解析 workbook 中指定 Sheet 的数据
 */
function parseSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  if (jsonData.length === 0) return { headers: [], rows: [] }

  const headers = jsonData[0]
  const rows = jsonData.slice(1).map(row => {
    const padded = Array.isArray(row) ? [...row] : []
    while (padded.length < headers.length) padded.push('')
    return padded
  })
  return { headers, rows }
}

/**
 * 读取上传的文件，返回 { headers, rows, sheetNames, currentSheet }
 */
export function readFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('没有文件'))
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      return reject(new Error('请上传 Excel (.xlsx, .xls) 或 CSV 文件'))
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const isCSV = /\.csv$/i.test(file.name)

        const workbook = isCSV
          ? XLSX.read(decodeCSVText(data), { type: 'string' })
          : XLSX.read(data, { type: 'array' })

        const sheetNames = workbook.SheetNames
        const currentSheet = sheetNames[0]
        const { headers, rows } = parseSheet(workbook, currentSheet)

        if (headers.length === 0 && rows.length === 0) return reject(new Error('文件为空'))

        resolve({ headers, rows, sheetNames, currentSheet })
      } catch (err) {
        reject(new Error('文件解析失败: ' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 读取指定文件的指定 Sheet
 */
export function readSheet(file, sheetName) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('没有文件'))

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const isCSV = /\.csv$/i.test(file.name)

        const workbook = isCSV
          ? XLSX.read(decodeCSVText(data), { type: 'string' })
          : XLSX.read(data, { type: 'array' })

        if (!workbook.SheetNames.includes(sheetName)) {
          return reject(new Error(`Sheet "${sheetName}" 不存在`))
        }
        const { headers, rows } = parseSheet(workbook, sheetName)
        resolve({ headers, rows, sheetNames: workbook.SheetNames, currentSheet: sheetName })
      } catch (err) {
        reject(new Error('Sheet 解析失败: ' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 导出数据为 xlsx
 */
export function exportToXlsx(headers, rows, filename = '导出结果.xlsx', sheetName = 'Sheet1') {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

/**
 * 内置示例数据
 */
export const DEMO_DATA = {
  specs: {
    headers: ['产品名称', '规格描述', '价格'],
    rows: [
      ['Wireless Mouse', 'Connectivity: 2.4GHz & Bluetooth 5.0, DPI: 1600, Battery: 1 AA', '$15'],
      ['Mechanical Keyboard', 'Switch: Blue, Layout: 87 Keys, Backlight: RGB, Material: PBT', '$45'],
      ['Gaming Headset', 'Driver: 50mm Neodymium, Mic: Noise Cancelling, Cable: 2m Braided', '$30'],
      ['USB-C Hub', 'Ports: 7-in-1 (HDMI 4K, USB3.0x3, SD, MicroSD, PD100W), Material: Aluminum', '$28'],
      ['Webcam', 'Resolution: 1080P/30fps, FOV: 90 deg, Autofocus: Yes, Microphone: Built-in Noise Cancel', '$35']
    ]
  },
  comments: {
    headers: ['用户ID', '评分', '评论内容'],
    rows: [
      ['User_001', '3', 'The delivery was fast, but the packaging was damaged. Product works fine though.'],
      ['User_002', '1', 'Terrible quality. It stopped working after 2 days. Do not buy!'],
      ['User_003', '5', 'Absolutely love it! Best value for money. Highly recommended.'],
      ['User_004', '4', 'Good product overall. Color slightly different from pictures but quality is solid.'],
      ['User_005', '2', 'Customer service was unhelpful when I had issues. Product is mediocre at best.'],
      ['User_006', '5', 'Exceeded my expectations! Fast shipping, great packaging, amazing product.'],
      ['User_007', '1', 'Complete waste of money. Broke on first use. The seller is unresponsive.'],
      ['User_008', '4', 'Pretty good value. Minor scratches on arrival but nothing serious. Works perfectly.']
    ]
  }
}
