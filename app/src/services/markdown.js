import { marked } from 'marked'
import DOMPurify from 'dompurify'

/** 模型报告是外部输入，Markdown 转成 HTML 后再净化。 */
export function renderMarkdown(text) {
  return DOMPurify.sanitize(marked(text), { USE_PROFILES: { html: true } })
}
