/**
 * Excel/CSV 文件读写服务 — 封装 SheetJS
 */
import * as XLSX from 'xlsx'

/**
 * 检测 CSV 文件编码：UTF-8 (含 BOM) 或 GBK
 * - BOM 检测：\xEF\xBB\xxBF = UTF-8
 * - 启发式：扫描前 8KB，存在 UTF-8 多字节序列 → UTF-8，否则 → GBK
 */
function detectCSVEncoding(bytes) {
  // BOM 检测
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'utf-8'
  }

  // 启发式检测：遍历前 8KB
  const len = Math.min(bytes.length, 8192)
  let utf8Score = 0
  let i = 0
  while (i < len) {
    const b = bytes[i]
    if (b <= 0x7F) {
      // ASCII
      i++
    } else if (b >= 0xC2 && b <= 0xDF) {
      // 2-byte UTF-8 sequence
      if (i + 1 < len && bytes[i + 1] >= 0x80 && bytes[i + 1] <= 0xBF) {
        utf8Score++
        i += 2
      } else {
        return 'gbk'
      }
    } else if (b >= 0xE0 && b <= 0xEF) {
      // 3-byte UTF-8 sequence (Chinese characters)
      if (i + 2 < len && bytes[i + 1] >= 0x80 && bytes[i + 1] <= 0xBF && bytes[i + 2] >= 0x80 && bytes[i + 2] <= 0xBF) {
        utf8Score += 2
        i += 3
      } else {
        return 'gbk'
      }
    } else if (b >= 0xF0 && b <= 0xF4) {
      // 4-byte UTF-8 sequence
      if (i + 3 < len && bytes[i + 1] >= 0x80 && bytes[i + 1] <= 0xBF && bytes[i + 2] >= 0x80 && bytes[i + 2] <= 0xBF && bytes[i + 3] >= 0x80 && bytes[i + 3] <= 0xBF) {
        utf8Score += 3
        i += 4
      } else {
        return 'gbk'
      }
    } else {
      // Invalid UTF-8 start byte → likely GBK
      return 'gbk'
    }
  }

  return utf8Score > 0 ? 'utf-8' : 'gbk'
}

/**
 * 读取上传的文件，返回 { headers: string[], rows: any[][] }
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
        const opts = { type: 'array' }
        if (isCSV) {
          const encoding = detectCSVEncoding(data)
          if (encoding === 'gbk') opts.codepage = 936
        }
        const workbook = XLSX.read(data, opts)
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

        if (jsonData.length === 0) return reject(new Error('文件为空'))

        const headers = jsonData[0]
        // 补齐每行长度与表头列数一致，防止尾部空单元格被 SheetJS 截断导致后续新增列错位
        const rows = jsonData.slice(1).map(row => {
          const padded = Array.isArray(row) ? [...row] : []
          while (padded.length < headers.length) padded.push('')
          return padded
        })

        resolve({ headers, rows })
      } catch (err) {
        reject(new Error('文件解析失败: ' + err.message))
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
