import { afterEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { readFile, readSheet, exportToXlsx } from '../services/excel'
import { createWorkbook, decodeWorkbook, parseSheet } from '../services/excel/workbook'

vi.mock('xlsx', async (importOriginal) => ({
  ...await importOriginal(),
  writeFile: vi.fn()
}))

function workbookFile(sheets, filename = '数据.xlsx') {
  const workbook = XLSX.utils.book_new()
  for (const [name, data] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), name)
  }
  return new File([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], filename)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Excel 文件读写契约', () => {
  it('编解码核心在没有 FileReader 和 DOM 时仍可完成工作簿往返', () => {
    vi.stubGlobal('FileReader', undefined)
    vi.stubGlobal('document', undefined)
    const workbook = createWorkbook(['名称', '数量'], [['苹果', 0]], '数据')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    expect(parseSheet(decodeWorkbook(bytes, '数据.xlsx'), '数据')).toEqual({
      headers: ['名称', '数量'], rows: [['苹果', 0]]
    })
  })

  it('默认读取首个工作表，切换时保留完整工作表列表', async () => {
    const file = workbookFile({
      商品: [['名称', '库存', '备注'], ['苹果', 0], ['梨', 12, '本周补货']],
      统计: [['指标', '数值'], ['总库存', 12]]
    })

    expect(await readFile(file)).toEqual({
      headers: ['名称', '库存', '备注'],
      rows: [['苹果', 0, ''], ['梨', 12, '本周补货']],
      sheetNames: ['商品', '统计'],
      currentSheet: '商品'
    })
    expect(await readSheet(file, '统计')).toEqual({
      headers: ['指标', '数值'],
      rows: [['总库存', 12]],
      sheetNames: ['商品', '统计'],
      currentSheet: '统计'
    })
  })

  it.each(['', '\uFEFF'])('读取带或不带 BOM 的 UTF-8 CSV（BOM: %j）', async (bom) => {
    const file = new File([`${bom}名称,数量\n苹果,0\n梨,12`], '数据.CSV')
    const data = await readFile(file)
    expect(data.headers).toEqual(['名称', '数量'])
    expect(data.rows).toEqual([['苹果', 0], ['梨', 12]])
  })

  it('读取 GBK CSV 并保留中文与数字零', async () => {
    // GBK 编码的“名称,数量\n中文,0”。
    const bytes = new Uint8Array([
      0xC3, 0xFB, 0xB3, 0xC6, 0x2C, 0xCA, 0xFD, 0xC1, 0xBF, 0x0A,
      0xD6, 0xD0, 0xCE, 0xC4, 0x2C, 0x30
    ])
    const data = await readFile(new File([bytes], '数据.csv'))
    expect(data.headers).toEqual(['名称', '数量'])
    expect(data.rows).toEqual([['中文', 0]])
  })

  it('上传空工作表报错，但切换到空工作表返回空数据', async () => {
    const file = workbookFile({ 空表: [], 数据: [['名称'], ['苹果']] })
    await expect(readFile(file)).rejects.toThrow('文件为空')
    expect(await readSheet(file, '空表')).toEqual({
      headers: [], rows: [], sheetNames: ['空表', '数据'], currentSheet: '空表'
    })
  })

  it('允许只有表头的工作表，并保留非字符串表头', async () => {
    const data = await readFile(workbookFile({ 数据: [[2026, '名称']] }))
    expect(data.headers).toEqual([2026, '名称'])
    expect(data.rows).toEqual([])
  })

  it('请求不存在的工作表时返回原有错误文案', async () => {
    await expect(readSheet(workbookFile({ 数据: [['名称']] }), '缺失'))
      .rejects.toThrow('Sheet "缺失" 不存在')
  })

  it('缺少文件或上传不支持的扩展名时返回原有错误文案', async () => {
    await expect(readFile()).rejects.toThrow('没有文件')
    await expect(readSheet(undefined, '数据')).rejects.toThrow('没有文件')
    await expect(readFile(new File(['名称'], '数据.txt')))
      .rejects.toThrow('请上传 Excel (.xlsx, .xls) 或 CSV 文件')
  })

  it('读取指定工作表不增加上传扩展名校验', async () => {
    const file = workbookFile({ 数据: [['名称'], ['苹果']] }, '数据.bin')
    expect((await readSheet(file, '数据')).rows).toEqual([['苹果']])
  })

  it('损坏文件的解析错误保留两种调用入口的前缀', async () => {
    const file = new File([new Uint8Array([0x50, 0x4B, 0x03, 0x04])], '损坏.xlsx')
    await expect(readFile(file)).rejects.toThrow(/^文件解析失败: /)
    await expect(readSheet(file, '数据')).rejects.toThrow(/^Sheet 解析失败: /)
  })

  it('浏览器文件读取失败不会包装成解析失败', async () => {
    vi.stubGlobal('FileReader', class {
      readAsArrayBuffer() {
        this.onerror()
      }
    })
    const file = new File(['名称'], '数据.csv')
    await expect(readFile(file)).rejects.toThrow(/^文件读取失败$/)
    await expect(readSheet(file, 'Sheet1')).rejects.toThrow(/^文件读取失败$/)
  })

  it('导出后重新读取保留字符串、数字零、布尔值和空字符串', () => {
    const headers = ['名称', '数量', '启用', '备注']
    const rows = [['中文', 0, false, ''], ['001', 2.5, true, '已检查']]
    exportToXlsx(headers, rows, '结果.xlsx', '处理结果')

    const [workbook, filename] = XLSX.writeFile.mock.calls[0]
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const restored = XLSX.read(bytes, { type: 'array' })
    expect(filename).toBe('结果.xlsx')
    expect(restored.SheetNames).toEqual(['处理结果'])
    expect(XLSX.utils.sheet_to_json(restored.Sheets['处理结果'], { header: 1 }))
      .toEqual([headers, ...rows])
  })

  it('保留默认导出文件名和工作表名', () => {
    exportToXlsx(['名称'], [['苹果']])
    const [workbook, filename] = XLSX.writeFile.mock.calls[0]
    expect(filename).toBe('导出结果.xlsx')
    expect(workbook.SheetNames).toEqual(['Sheet1'])
  })
})
