# CLAUDE.md

## Project

Magic Excel — 纯前端 Excel/CSV 智能处理平台。Vue 3 SPA，无后端。用户上传 Excel 后在浏览器内完成数据清洗、翻译、AI 打标、数据摘要、公式生成等操作。AI 能力通过调用 OpenAI 兼容的第三方 LLM API 实现，API Key 由用户自行配置，存 localStorage。

## Dev

```bash
cd app
npm install
npm run dev        # Vite dev server, localhost:5173
npm run build      # 生产构建
npm test           # Vitest（4 个测试文件）
```

无 lint 配置。

## Tech Stack

- Vue 3 Composition API (`<script setup>`)，不用 Options API
- Pinia（defineStore + setup 语法），不用 Vuex
- Tailwind CSS utility classes，无自定义 CSS
- SheetJS (xlsx) 读写 Excel/CSV
- marked 渲染 Markdown
- lucide-vue-next 图标
- API 调用走 OpenAI 兼容格式（messages 数组 + Bearer Token）

## Architecture

### 数据总线

`stores/dataShare.js` 是全局数据枢纽。首页上传 Excel 后数据存入 `headers`/`rows`，子模块通过 `onMounted` 自动读取。`labelingResults` 存储 AI 打标结果供跨页使用。

### 文件布局

```
app/src/
├── config/defaultSettings.js     # API 平台配置 + 默认清洗规则
├── router/index.js               # 7 条路由，全部懒加载
├── stores/
│   ├── dataShare.js              # 全局数据总线
│   └── settings.js               # API 配置 + 清洗规则配置，持久化到 localStorage
├── services/
│   ├── ai.js                     # callAI / callStreamingAI / callAIBatch / createSemaphore
│   ├── cleaningRules.js          # 11 种原子清洗规则 + runCleaningPipeline
│   ├── dataProfiler.js           # 列类型检测、列画像、交叉统计、分层抽样
│   ├── excel.js                  # SheetJS 读写 + DEMO_DATA
│   ├── jsonParser.js             # parseRobustJSON（容错解析 AI 返回的 JSON）
│   ├── prompts.js                # 所有 Prompt 模板
│   ├── toast.js                  # 全局通知（替代 alert）
│   └── translationCache.js       # 翻译缓存，跳过已翻译文本
├── views/                        # 7 个页面
│   ├── HomeView.vue              # 功能主页
│   ├── CleaningView.vue          # 数据清洗
│   ├── TranslateView.vue         # 批量翻译（Excel 列翻译）
│   ├── TextTranslateView.vue     # 文本翻译（自由文本）
│   ├── AnalysisView.vue          # AI 表格打标
│   ├── SummaryView.vue           # AI 数据摘要
│   └── FormulaView.vue           # Excel 公式生成
├── components/
│   ├── common/                   # FileUploader, DataTable, ProgressOverlay, ToastContainer
│   ├── layout/                   # Sidebar, Header
│   ├── settings/                 # SettingsModal
│   └── cleaning/                 # CustomFilterForm
└── __tests__/                    # aiBatch, jsonParser, toast, translationCache
```

### Sidebar 导航分组

- **Excel 处理**：数据清洗、批量翻译、数据分析(AI打标)、数据摘要
- **AI 助手**：文本翻译、公式生成

## Key Conventions

- 数据清洗采用**审计优先**策略：不直接删除，打标 keep/delete/suspect 后用户可覆写（详见 docs/adr/0002）
- AI 打标采用 **labelingPlan** 模型：用户用自然语言描述需求 → AI 生成 outputColumns 方案 → 编译成 system prompt → 逐行打标（详见 docs/adr/0003）
- 数据摘要用**列画像**替代原始行采样：预计算全表统计后发给 AI，不发原始行（详见 docs/adr/0004）
- AI 返回的 JSON 统一走 `parseRobustJSON` 容错解析（剥离 markdown 代码块、提取最外层括号）
- 并发控制用 `createSemaphore` 信号量，`callAIBatch` 支持指定并发数（默认 3）
- 全局通知用 `useToast()`，不使用 `alert()`
- 示例数据硬编码在 `services/excel.js` 的 `DEMO_DATA` 中
- v1/v2 HTML 原型（`Translation & Analysis Tool.html`、`Translation_Analysis_Tool_v2.html`）保留在根目录，仅作历史参考

## API Platforms

两个平台，配置在 `config/defaultSettings.js`：
- **硅基流动 (siliconflow)** — SiliconCloud
- **aiping.cn** — AI 聚合平台

每个平台分别配置翻译模型和分析模型。API Key 存 localStorage，支持配置导入/导出/重置。

## 架构决策记录

详见 `docs/adr/` 目录。重大设计决策不写在代码注释里，而是以 ADR 形式记录。修改涉及这些领域时务必先阅读对应 ADR。
