import http from 'node:http'
import path from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../.pages-dist/', import.meta.url))
const port = Number(process.env.MAGIC_PAGES_PORT || 3323)
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' }

http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost')
    // 支持项目页子路径预览，验证 github.io/excel_magic/ 下的相对资源。
    const pathname = decodeURIComponent(url.pathname).replace(/^\/excel_magic(?=\/|$)/, '') || '/'
    let file = path.resolve(root, '.' + pathname)
    const relativePath = path.relative(root, file)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) { response.writeHead(403); response.end(); return }
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        response.writeHead(301, { Location: url.pathname + '/' + url.search })
        response.end()
        return
      }
      file = path.join(file, 'index.html')
    }
    const bytes = await readFile(file)
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(bytes)
  } catch (error) {
    const status = ['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end(status === 404 ? '页面不存在' : '无法读取预览文件')
  }
}).listen(port, '127.0.0.1', () => console.log(`MagicExcel 产品页：http://localhost:${port}/`))
