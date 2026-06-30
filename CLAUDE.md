# CLAUDE.md

## Project

Magic Excel — 纯前端 Excel/CSV 智能处理平台（Vue 3 SPA，无后端）。上传 Excel 后在浏览器内完成数据清洗、智能加工（翻译+打标）、数据摘要。AI 能力通过 OpenAI 兼容 API 实现，Key 存 localStorage。

## Dev

```bash
cd app && npm install
npm run dev        # localhost:5173
npm run build      # 生产构建
npm test           # Vitest
```

## 三大功能页（入口收敛后）

- `/cleaning` → **CleaningHub**：清洗统一入口，内含简易模式（OptimizeView，AI 一句话清洗）和专家模式（CleaningView，规则精调），用 `settings.cleaningMode` 切换。**两模式共享同一份 `settings.rulesConfig`**——简易模式 AI 跑完的方案自动沉淀到专家模式，`settings.lastAiConfigAt` 标记会话内是否跑过 AI
- `/process` → **AnalysisView**（智能加工）：翻译和打标合并为同一套「输出列」机制，翻译降级为预设模板之一
- `/summary` → **SummaryView**：列画像 + AI 流式报告
- 旧路由 `/translate`、`/analysis`、`/optimize` 已重定向（过渡期保留，计划清理 TranslateView）

## Key Conventions

- **意图驱动上传**：`useFileUpload` 上传后自动弹 `ImportIntentModal` 收集「核心列 + 任务（clean/process/summary）+ 说明」，写入 `stores/importIntent.js`；任务说明同步写 `dataShare.intentNote`，以**参考段**形式（`formatIntentContext`）分层注入三功能区的 AI 调用，不覆盖各模块自己的目标字段（详见 docs/adr/0008）。弹窗支持 **AI 一键分析**（`services/intentAnalysis.js` 读表格快照推断 2-3 个任务目标建议），默认自动触发，可在设置「AI 自动行为」关闭
- 数据清洗采用**审计优先**策略：不直接删除，打标 keep/delete/suspect 后用户可覆写（详见 docs/adr/0002）
- AI 打标采用 **labelingPlan** 模型：自然语言需求 → AI 生成 outputColumns 方案 → 编译 system prompt → 逐行打标（详见 docs/adr/0003）
- 数据摘要用**列画像**替代原始行采样：预计算全表统计后发给 AI，不发原始行（详见 docs/adr/0004）
- AI 返回 JSON 统一走 `parseRobustJSON` 容错解析（剥离 markdown 代码块、提取最外层括号）
- 并发控制用 `createSemaphore` 信号量，`callAIBatch` 支持指定并发数（默认 20，上限 100），遇 429 自动降级
- 全局通知用 `useToast()`，不用 `alert()`
- 桌面端和移动端 UI 完全分离：`v-if="isDesktop"` / `v-else` 双模板，移动端用 MobileCollapsible 折叠面板 + MobileTableWrapper 表格包装
- 数据总线 `stores/dataShare.js` 是全局数据枢纽，各页面通过 `useGlobalDataSync` composable 自动同步
- 公共逻辑已提取为 composables：`useGlobalDataSync`（数据同步）、`useFileUpload`（文件上传 + 意图弹窗）、`useExport`（导出）、`useShare`（共享/应用）
- 大型组件已拆分：`CleaningRulesPanel`（清洗规则面板）、`OutputColumnsList`（打标输出列管理）、`StatsPieChart`（ECharts 饼图）
- 多 Sheet 支持：dataShare 追踪 `sheetNames/currentSheet/file`，`setSheet()` 懒加载切换

## 分支与提交规范

- **禁止在 master 上直接 commit**：所有修改必须先 `git checkout -b <type>/<name>` 建立分支，在分支上开发
- 分支命名：`feat/xxx`（功能）、`fix/xxx`（修复）、`refactor/xxx`（重构）、`docs/xxx`（文档）
- 每个 commit 原子化——一个 commit 只做一件事，可独立验证、可单独回滚
- commit 前必须通过 `npm run build` + `npm test`
- 分支开发完成后，切回 master 执行 `git merge --no-ff <branch>` 合并（保留分支拓扑）
- 合并后 `git push origin master` 同步远程，然后可删除本地分支

## 架构决策记录

详见 `docs/adr/` 目录。重大设计决策不写在代码注释里，而是以 ADR 形式记录。修改涉及这些领域时务必先阅读对应 ADR。

## ADR 触发清单（每次迭代后自检）

完成任何 `feat/`、`refactor/` 分支后，对照下表自检。命中任意一条 → **优先在 `docs/adr/NNNN-标题.md` 补一份 ADR，再合并**。

| 触发条件 | 典型 ADR 主题 |
|---------|--------------|
| 新增/移除一个 store 字段且被跨页面读写 | 数据总线演进 |
| 改变模块间数据流方向（谁写谁读） | 数据流变更 |
| 引入新依赖或换掉旧依赖 | 技术选型 |
| 把同步改成异步（或反之），改变并发模型 | 一致性/并发模型 |
| 改变 AI 调用模式（批量/流式/缓存策略） | AI 工程决策 |
| 移动端/桌面端模板边界变化 | UI 架构 |
| 改了 `cleaningRules` pipeline 的决策语义 | 清洗策略 |
| 删除/合并功能入口、新增/移除路由 | 入口架构 |

**不写 ADR 的信号**：纯 UI 调整、bug fix、依赖升级、文案改动、纯文档。
**写 ADR 的信号**：你犹豫了"这样做会不会影响 XXX"——会，就写。

> 工程层联防：`pre-commit` 钩子会在触及架构敏感文件时提醒自检（见 `.claude/hooks/`）；`git merge` 后的 PostToolUse 钩子会做合并级总盘点。两者都只提醒不阻塞，最终判断由人完成。
