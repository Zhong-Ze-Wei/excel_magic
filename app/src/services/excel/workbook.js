/**
 * Excel/CSV 编解码核心：只处理内存中的字节和工作簿，不读取文件或触发下载。
 */
import * as XLSX from 'xlsx'

/**
 * 解码 CSV 文本：UTF-8 优先，GBK 兜底。
 * BOM → UTF-8；无 BOM 时遇到替换字符 U+FFFD → GBK。
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
 * 从文件字节解码工作簿，文件名仅用于识别 CSV。
 */
export function decodeWorkbook(buffer, filename) {
  const data = new Uint8Array(buffer)
  return /\.csv$/i.test(filename)
    ? XLSX.read(decodeCSVText(data), { type: 'string' })
    : XLSX.read(data, { type: 'array' })
}

/**
 * 解析工作簿中指定 Sheet 的数据。
 */
export function parseSheet(workbook, sheetName) {
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
 * 从表头和数据行构建用于导出的工作簿。
 */
export function createWorkbook(headers, rows, sheetName = 'Sheet1') {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  return workbook
}
