# MagicExcel 产品展示页

独立的 HTML / CSS / JavaScript 静态页面，不需要服务端。包含四个模块的说明、可播放或逐步点击的流程演示、真实界面截图、截图放大、示例 CSV 下载和工作台入口。

## 本地预览

先在 `app` 目录安装依赖，在仓库根目录执行：

```powershell
npm --prefix app run build:pages
node scripts/build-pages.mjs
node scripts/preview-pages.mjs
```

打开 <http://localhost:3323/>。工作台位于 `/app/`；也可以打开 `/excel_magic/` 验证 GitHub 项目子路径下的资源加载。

## 发布到 GitHub Pages

首次发布，在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，再手动运行 **Deploy MagicExcel product page** 工作流。以后 `master` 上的相关变更会自动构建和发布。

- 产品页：<https://zhong-ze-wei.github.io/excel_magic/>
- 工作台：<https://zhong-ze-wei.github.io/excel_magic/app/>
- 工作流：[pages.yml](../.github/workflows/pages.yml)
- 官方设置说明：[使用自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

仓库未启用 Pages 时，工作流仍完成测试、构建并上传产物，在运行摘要中提示设置步骤，跳过公开部署。

## 内容与截图

- `index.html`：产品文案、功能、使用说明与截图说明。
- `style.css`：响应式布局、动效，以及减少动态效果偏好的适配。
- `site.js`：流程播放、暂停与重置、键盘切换、截图放大。
- `demo-labels.mjs`：人工预设的标签，仅用于演示，不代表真实模型调用。
- `assets/screens/`：实际工作台截图，使用隔离浏览器里的模拟数据与预设 AI 结果。

构建时直接读取 `app/src/data/demoData.js` 的默认数据，调用项目清洗和分组统计逻辑，生成演示 JSON 和带 UTF-8 BOM 的 CSV，避免维护第二份默认表格。输出写入 `.pages-dist/`，并复制已构建的工作台到其 `app/` 子目录。

修改默认数据或清洗规则后，重新构建。若默认保留记录变化，需同步 `demo-labels.mjs` 的预设标签；截图和预设摘要也应重新核对。截图不得包含真实用户数据或 API 密钥。
