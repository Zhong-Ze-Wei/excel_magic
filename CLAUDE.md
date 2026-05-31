# CLAUDE.md

## Project

Magic Excel — 纯前端 Excel/CSV 智能处理平台（Vue 3 SPA，无后端）。上传 Excel 后在浏览器内完成数据清洗、翻译、AI 打标、数据摘要。AI 能力通过 OpenAI 兼容 API 实现，Key 存 localStorage。

## Dev

```bash
cd app && npm install
npm run dev        # localhost:5173
npm run build      # 生产构建
npm test           # Vitest
```

## Key Conventions

- 数据清洗采用**审计优先**策略：不直接删除，打标 keep/delete/suspect 后用户可覆写（详见 docs/adr/0002）
- AI 打标采用 **labelingPlan** 模型：自然语言需求 → AI 生成 outputColumns 方案 → 编译 system prompt → 逐行打标（详见 docs/adr/0003）
- 数据摘要用**列画像**替代原始行采样：预计算全表统计后发给 AI，不发原始行（详见 docs/adr/0004）
- AI 返回 JSON 统一走 `parseRobustJSON` 容错解析（剥离 markdown 代码块、提取最外层括号）
- 并发控制用 `createSemaphore` 信号量，`callAIBatch` 支持指定并发数（默认 3），遇 429 自动降级
- 全局通知用 `useToast()`，不用 `alert()`
- 桌面端和移动端 UI 完全分离：`v-if="isDesktop"` / `v-else` 双模板，移动端用 MobileCollapsible 折叠面板 + MobileTableWrapper 表格包装
- 数据总线 `stores/dataShare.js` 是全局数据枢纽，各页面通过 watch 监听 `rows.length` 变化自动同步

## 分支与提交规范

- **禁止在 master 上直接 commit**：所有修改必须先 `git checkout -b <type>/<name>` 建立分支，在分支上开发
- 分支命名：`feat/xxx`（功能）、`fix/xxx`（修复）、`refactor/xxx`（重构）、`docs/xxx`（文档）
- 每个 commit 原子化——一个 commit 只做一件事，可独立验证、可单独回滚
- commit 前必须通过 `npm run build` + `npm test`
- 分支开发完成后，切回 master 执行 `git merge --no-ff <branch>` 合并（保留分支拓扑）
- 合并后 `git push origin master` 同步远程，然后可删除本地分支

## 架构决策记录

详见 `docs/adr/` 目录。重大设计决策不写在代码注释里，而是以 ADR 形式记录。修改涉及这些领域时务必先阅读对应 ADR。
