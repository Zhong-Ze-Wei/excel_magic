/**
 * Excel/CSV 浏览器文件读写：适配 FileReader 与文件下载。
 */
import * as XLSX from 'xlsx'
import { createWorkbook, decodeWorkbook, parseSheet } from './excel/workbook'

export { DEMO_DATA } from '../data/demoData'

/**
 * 读取浏览器文件并解码；两种入口保留各自的解析错误前缀。
 */
function readWorkbook(file, errorPrefix) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        resolve(decodeWorkbook(e.target.result, file.name))
      } catch (err) {
        reject(new Error(errorPrefix + err.message))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 读取上传的文件，返回 { headers, rows, sheetNames, currentSheet }。
 */
export async function readFile(file) {
  if (!file) throw new Error('没有文件')
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    throw new Error('请上传 Excel (.xlsx, .xls) 或 CSV 文件')
  }

  const workbook = await readWorkbook(file, '文件解析失败: ')
  let data
  try {
    const sheetNames = workbook.SheetNames
    const currentSheet = sheetNames[0]
    const { headers, rows } = parseSheet(workbook, currentSheet)
    data = { headers, rows, sheetNames, currentSheet }
  } catch (err) {
    throw new Error('文件解析失败: ' + err.message)
  }
  if (data.headers.length === 0 && data.rows.length === 0) throw new Error('文件为空')
  return data
}

/**
 * 读取指定文件的指定 Sheet
 */
export async function readSheet(file, sheetName) {
  if (!file) throw new Error('没有文件')

  const workbook = await readWorkbook(file, 'Sheet 解析失败: ')
  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" 不存在`)
  }
  try {
    const { headers, rows } = parseSheet(workbook, sheetName)
    return { headers, rows, sheetNames: workbook.SheetNames, currentSheet: sheetName }
  } catch (err) {
    throw new Error('Sheet 解析失败: ' + err.message)
  }
}

/**
 * 导出数据为 xlsx
 */
export function exportToXlsx(headers, rows, filename = '导出结果.xlsx', sheetName = 'Sheet1') {
  XLSX.writeFile(createWorkbook(headers, rows, sheetName), filename)
}
