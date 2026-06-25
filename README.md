# Magic Excel

纯前端 Excel/CSV 智能处理平台。上传 Excel 后在浏览器内完成数据清洗、智能加工（翻译+打标）、数据摘要，无需后端，数据不离开浏览器。

## 功能特点

### 三大功能模块（入口收敛后）
- **数据清洗**（CleaningHub）：简易模式（AI 一句话清洗）+ 专家模式（规则精调）双模式统一入口，审计优先不直接删除
- **智能加工**（AnalysisView）：翻译和打标合并为同一套「输出列」机制，翻译降级为预设模板之一，支持 6 种输出列类型
- **数据摘要**（SummaryView）：列画像引擎 + 流式 AI 报告

### 特性
- **意图驱动上传**: 上传后弹窗收集「核心列 + 任务」，替代自动检测，让用户显式表达意图
- **双平台支持**: 硅基流动 + aiping.cn
- **纯前端**: 无需后端，打开即用，数据不上传
- **模型可选**: 支持多种 AI 模型自由切换
- **全局数据联动**: 首页上传一次，数据在清洗→加工→摘要间自动流转
- **移动端适配**: 桌面端 Sidebar + 移动端底部 Tab Bar，双模板完全分离
- **统计图表**: ECharts 环形饼图展示清洗/打标结果分布
- **多 Sheet 支持**: 读取多 Sheet Excel 文件，首页切换

## 使用方法

1. 进入 `app` 目录安装依赖（如已安装可跳过）：
   ```bash
   cd app
   npm install
   ```
2. 启动本地开发服务器：
   ```bash
   npm run dev
   ```
3. 在浏览器中打开提示的本地地址（通常是 `http://localhost:5173`）
4. 首次使用需在左侧 Sidebar 底部点击「API 设置」配置密钥（支持硅基流动或 aiping.cn）
5. 上传文件后弹窗选择「核心列 + 任务」（清洗/加工/摘要）
6. 进入对应功能模块处理，完成后导出结果

## API 配置

### 硅基流动 (SiliconCloud)
- 注册地址: https://cloud.siliconflow.cn
- 邀请码: `S8pG3891` (可获14元额度)
- 推荐使用 `DeepSeek-V4-Flash` 或者是免费的 `Hunyuan-MT-7B`（腾讯翻译专用模型）

### aiping.cn
- 注册地址: https://www.aiping.cn
- 邀请码: `WBEJSN`
- 提供多种大模型（如 `DeepSeek-V4-Flash` 等）

## 技术栈

- Vue 3 (Composition API)
- Vite
- Pinia (状态管理)
- Vue Router (路由)
- Tailwind CSS + @tailwindcss/typography (界面样式)
- SheetJS / xlsx (Excel 解析与导出)
- marked (Markdown 渲染)
- ECharts (统计图表)
- Lucide Icons (图标)

## 文件说明

| 路径 | 说明 |
|------|------|
| /app | 现代化的 Vue 3 核心程序源码 |
| /data | 测试/样本数据文件夹（存放 xlsx/csv 文件） |
| /docs | 项目文档（产品说明、代码结构、数据管道、ADR） |
| Translation*.html | 早期单 HTML 文件版原型（已废弃/备份） |

## 数据安全

- 所有文件解析与处理完全在本地浏览器进行，数据不会上传到第三方服务器。
- 您的 API 密钥仅存储在您本地浏览器的 localStorage 中，安全可靠。
