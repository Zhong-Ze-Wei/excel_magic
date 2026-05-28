# 智能分析助手

一个纯前端的 Excel/CSV 批量翻译与评论分析工具，支持多种 AI 增强功能。

## 功能特点

### 核心功能
- **批量翻译**: 支持 Excel/CSV 文件批量翻译，多种翻译场景可选
- **文本翻译**: 快速文本翻译，即贴即用
- **评论分析**: AI 智能评论分类，支持自定义分类体系

### AI 增强工具 (新)
- **数据摘要生成器**: 上传 Excel 自动生成数据分析报告
- **智能公式生成器**: 用自然语言描述需求，AI 生成 Excel 公式
- **数据清洗工具**: AI 辅助清洗规范化数据（姓名、手机、地址、日期等）

### 特性
- **双平台支持**: 硅基流动 + aiping.cn
- **纯前端**: 无需后端，打开即用，数据不上传
- **模型可选**: 支持多种 AI 模型自由切换

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
5. 选择功能模块（批量翻译/文本翻译/评论分析/数据摘要/智能公式/数据清洗）
6. 上传文件或使用示例数据进行处理，完成后导出结果

## API 配置

### 硅基流动 (SiliconCloud)
- 注册地址: https://cloud.siliconflow.cn
- 邀请码: `S8pG3891` (可获14元额度)
- 推荐使用 `DeepSeek-V3` 或者是免费的 `Hunyuan-MT-7B`（腾讯翻译专用模型）

### aiping.cn
- 注册地址: https://www.aiping.cn
- 邀请码: `WBEJSN`
- 提供多种大模型（如 `DeepSeek-V4-Flash` 等）

## 技术栈

- Vue 3 (Composition API)
- Vite
- Pinia (状态管理)
- Vue Router (路由)
- Tailwind CSS (界面样式)
- SheetJS / xlsx (Excel 解析与导出)
- Lucide Icons (图标)

## 文件说明

| 路径 | 说明 |
|------|------|
| /app | 现代化的 Vue 3 核心程序源码 |
| /data | 测试/样本数据文件夹（存放 xlsx/csv 文件） |
| Translation*.html | 早期单 HTML 文件版原型（已废弃/备份） |

## 数据安全

- 所有文件解析与处理完全在本地浏览器进行，数据不会上传到第三方服务器。
- 您的 API 密钥仅存储在您本地浏览器的 localStorage 中，安全可靠。
