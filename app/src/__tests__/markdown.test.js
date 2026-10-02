// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../services/markdown'

function render(text) {
  const element = document.createElement('div')
  element.innerHTML = renderMarkdown(text)
  return element
}

describe('模型 Markdown 安全渲染', () => {
  it('保留标题、强调、表格和正常链接', () => {
    const element = render('## 标题\n\n**结论** [文档](https://example.com)\n\n|列|值|\n|---|---|\n|A|1|')
    expect(element.querySelector('h2').textContent).toBe('标题')
    expect(element.querySelector('strong').textContent).toBe('结论')
    expect(element.querySelector('a').getAttribute('href')).toBe('https://example.com')
    expect(element.querySelectorAll('table tbody tr')).toHaveLength(1)
  })

  it.each([
    '<img src=x onerror="window.attack=1">',
    '<a href="javascript:alert(1)">点我</a>',
    '<script>window.attack=1</script><iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<svg onload="alert(1)"><a href="javascript:alert(1)">x</a></svg>',
    '<math><mtext><img src=x onerror=alert(1)></mtext></math>'
  ])('删除危险 HTML：%s', source => {
    const element = render(source)
    expect(element.querySelector('script,iframe,svg,math')).toBeNull()
    for (const node of element.querySelectorAll('*')) {
      for (const attribute of node.attributes) {
        expect(attribute.name).not.toMatch(/^on/i)
        expect(attribute.value).not.toMatch(/^javascript:/i)
      }
    }
  })
})
