# 智能分析助手

一个纯前端的 Excel/CSV 智能处理平台，支持数据清洗、批量翻译、AI 打标和数据摘要。

## 功能特点

### 核心功能
- **数据清洗**: 11 种原子规则 + 自定义规则 + AI 智能筛选，审计优先不直接删除
- **批量翻译**: 整列翻译，支持 5 种场景 × 4 种语言方向，翻译缓存 + 429 自动降级
- **AI 表格打标**: 自然语言描述需求 → AI 生成打标方案 → 逐行并发打标，支持 6 种输出列类型
- **AI 数据摘要**: 列画像引擎 + 智能列推荐，流式生成 Markdown 分析报告

### 特性
- **双平台支持**: 硅基流动 + aiping.cn
- **纯前端**: 无需后端，打开即用，数据不上传
- **模型可选**: 支持多种 AI 模型自由切换
- **全局数据联动**: 首页上传一次，数据在清洗→翻译→打标→摘要间自动流转

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
4. 首次使用需在右上角配置 API 密钥（支持硅基流动或 aiping.cn）
5. 选择功能模块（数据清洗/批量翻译/数据分析/数据摘要）
6. 上传文件或使用示例数据进行处理，完成后导出结果

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
