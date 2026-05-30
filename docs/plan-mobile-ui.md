# 移动端 UI 适配方案

> 分支: `feat/mobile-ui` | 状态: 待审核

## 核心原则

1. **桌面端零影响** — 所有现有桌面端视觉效果和功能不变
2. **代码完全分离** — 每个视图用 `v-if="isMobile"` / `v-else` 双模板，移动端代码不侵入桌面端
3. **布局完全分离** — 移动端用底部 Tab Bar + 简化 Header，桌面端保留侧边栏
4. **原子化提交** — 每个 commit 可独立验证、可单独回滚

---

## 技术架构

### 分离策略

```
App.vue
├── isMobile=false → DesktopLayout (Sidebar + Header + main)  ← 现有代码提取
└── isMobile=true  → MobileLayout (MobileHeader + main + MobileTabBar)  ← 新增
```

每个 View 文件内部：
```vue
<template>
  <div v-if="isMobile">移动端专属模板</div>
  <div v-else>桌面端模板（原样保留）</div>
</template>
```

### 新增文件

```
app/src/
├── composables/
│   └── useDevice.js              # 设备检测 (matchMedia)
├── components/layout/
│   ├── DesktopLayout.vue         # 从 App.vue 提取的桌面端布局
│   ├── MobileLayout.vue          # 移动端布局壳
│   ├── MobileTabBar.vue          # 底部标签导航
│   └── MobileHeader.vue          # 移动端顶部栏
└── components/common/
    ├── MobileCollapsible.vue     # 可折叠面板
    └── MobileTableWrapper.vue    # 表格横向滚动包装器
```

### 修改文件

```
app/src/App.vue                   # 条件渲染入口 (简化为 ~15 行)
app/src/views/HomeView.vue        # 添加移动端模板
app/src/views/CleaningView.vue    # 添加移动端模板
app/src/views/TranslateView.vue   # 添加移动端模板
app/src/views/AnalysisView.vue    # 添加移动端模板
app/src/views/SummaryView.vue     # 添加移动端模板
app/src/components/settings/SettingsModal.vue  # 移动端全屏模式
app/src/components/common/ToastContainer.vue   # 移动端位置调整
```

---

## 移动端 UX 设计

### 1. 导航：底部 Tab Bar

```
┌──────────────────────────────────┐
│          移动端 Header           │  ← 页面标题 + 设置齿轮
├──────────────────────────────────┤
│                                  │
│          内容区 (可滚动)          │
│                                  │
├──────────────────────────────────┤
│ 🏠首页 | 🧹清洗 | 🌐翻译 | 🧠分析 | 📄摘要 │  ← 底部 Tab Bar
└──────────────────────────────────┘
```

- 5 个 tab：首页 | 清洗 | 翻译 | 分析 | 摘要
- 活跃 tab 蓝色高亮 + icon 填充
- 固定底部，高度 56px，不随内容滚动
- 设置通过 Header 右侧齿轮图标打开

### 2. 功能页通用布局

```
┌──────────────────────┐
│ 📊 数据清洗  [⚙️]     │  ← Header (h-12)
├──────────────────────┤
│ ▶ 文件信息           │  ← MobileCollapsible (默认展开)
│   上传: data.xlsx    │
│   100行 × 5列        │
├──────────────────────┤
│ ▼ 清洗配置           │  ← MobileCollapsible (默认展开)
│   规则选择...        │
│   [开始清洗]         │
├──────────────────────┤
│                      │
│   数据表格区域        │  ← MobileTableWrapper
│   (横向滚动)          │
│                      │
├──────────────────────┤
│ 🏠 | 🧹 | 🌐 | 🧠 | 📄 │  ← Tab Bar
└──────────────────────┘
```

### 3. 可折叠面板设计 (MobileCollapsible)

- 标题栏 + chevron 图标（右箭头，展开时旋转向下）
- 点击标题栏切换展开/收起
- 内容区 max-height 过渡动画 (300ms ease)
- 可配置默认展开/收起
- 可配置标题右侧 slot (放操作按钮)

### 4. 表格移动端策略

- **保留表格形式**，不做卡片化（用户要求展示表格）
- 横向滚动：`overflow-x: auto`
- 移除 `min-w-[800px]` / `min-w-[900px]` 硬编码
- 缩小单元格 padding: `px-2 py-1.5`（桌面端 `px-4 py-3`）
- 缩小字体: `text-xs`（桌面端 `text-sm`）
- 第一列 sticky: `position: sticky; left: 0; z-index: 1; background: white`
- 固定高度改为 `h-[45vh]`（视口比例，而非固定像素）
- 表头 sticky: `position: sticky; top: 0; z-index: 2`

### 5. 各页面折叠分区设计

**CleaningView:**
| Section | 默认状态 | 内容 |
|---------|---------|------|
| 文件信息 | 展开 | 文件名、行列数、核心列选择 |
| 清洗规则 | 展开 | 规则开关列表、自定义过滤 |
| 操作 | 展开 | 开始/撤销/导出按钮 + 统计卡片 |
| 审计表格 | 展开 | MobileTableWrapper 包裹的表格 |

**TranslateView:**
| Section | 默认状态 | 内容 |
|---------|---------|------|
| 文件信息 | 展开 | 文件名、行列数 |
| 翻译配置 | 展开 | 源列选择、场景类型、语言方向 |
| 操作 | 展开 | 开始翻译按钮 + 统计卡片 |
| 翻译结果 | 展开 | DataTable (MobileTableWrapper) |

**AnalysisView:**
| Section | 默认状态 | 内容 |
|---------|---------|------|
| 文件信息 | 展开 | 文件名、行列数 |
| 分析配置 | 展开 | 参考列选择、行范围、目标描述、生成方案 |
| 输出列方案 | 展开（有数据时）| 新增列卡片列表 |
| AI 打标结果 | 展开 | 内联表格 (MobileTableWrapper) |
| 高级设置 | 收起 | Prompt 折叠面板 |

**SummaryView:**
| Section | 默认状态 | 内容 |
|---------|---------|------|
| 文件信息 | 展开 | 文件名、行列数 |
| 分析配置 | 展开 | 主题输入、AI 推荐、分析列选择 |
| 操作 | 展开 | 开始生成按钮 + 统计卡片 |
| 数据摘要报告 | 展开 | Markdown 渲染区 |

### 6. 设置弹窗移动端

- 全屏覆盖（`fixed inset-0`，无居中弹窗）
- 顶部：标题 + 关闭按钮
- Tab 切换：横向滚动标签（API 密钥 | 清洗规则）
- 所有 `grid-cols-2` 改为 `grid-cols-1`
- 底部固定操作栏：测试连接 | 保存
- 导入/导出/重置按钮改为文字链接放在 Tab 区域下方

### 7. Toast 移动端

- 位置改为顶部居中：`top-2 left-1/2 -translate-x-1/2`
- 宽度：`w-[calc(100%-2rem)] max-w-sm`
- 保持 max-w-sm 限制

### 8. 触摸优化

- 按钮最小点击区域 44×44px
- 表格行高适当增加
- 移动端去掉 hover 效果（`hover:` 改为 `active:` 或仅视觉）
- 表单控件增大触摸区域

---

## 原子化提交计划

### Commit 1: `feat(mobile): 添加设备检测 composable`
**新增:** `composables/useDevice.js`
- `useDevice()` 返回 `{ isMobile, isDesktop }`
- 内部用 `window.matchMedia('(max-width: 768px)')` 监听
- 模块级单例，所有组件共享同一响应式状态
- **验证:** 桌面端无任何变化

### Commit 2: `feat(mobile): 提取桌面端布局组件`
**新增:** `components/layout/DesktopLayout.vue`
**修改:** `app/src/App.vue`
- DesktopLayout 封装现有 Sidebar + Header + main 布局
- App.vue 简化为条件渲染入口
- **验证:** 桌面端无任何变化

### Commit 3: `feat(mobile): 添加移动端布局组件`
**新增:**
- `components/layout/MobileLayout.vue`
- `components/layout/MobileTabBar.vue`
- `components/layout/MobileHeader.vue`

**修改:** `app/src/App.vue`
- MobileLayout: 顶部 MobileHeader + 内容区 + 底部 MobileTabBar
- MobileTabBar: 5 个 tab，图标 + 文字，活跃态高亮
- MobileHeader: 精简标题 + 设置按钮
- App.vue 接入 isMobile 判断
- **验证:** 移动端显示底部导航和顶部栏，桌面端无变化

### Commit 4: `feat(mobile): 添加通用移动端 UI 组件`
**新增:**
- `components/common/MobileCollapsible.vue`
- `components/common/MobileTableWrapper.vue`

- MobileCollapsible: 可折叠面板，标题 + chevron + 动画
- MobileTableWrapper: 表格横向滚动 + 第一列 sticky + 表头 sticky
- **验证:** 组件可独立渲染，桌面端无变化

### Commit 5: `feat(mobile): HomeView 移动端适配`
**修改:** `app/src/views/HomeView.vue`
- 添加移动端模板 (v-if="isMobile")
- 单列功能卡片
- 上传区移动端优化
- 桌面端模板 (v-else) 原样保留
- **验证:** 移动端首页卡片单列排列，桌面端无变化

### Commit 6: `feat(mobile): CleaningView 移动端适配`
**修改:** `app/src/views/CleaningView.vue`
- 移动端模板：3 个可折叠面板（文件信息 / 清洗规则 / 审计表格）
- 表格用 MobileTableWrapper
- 操作按钮移动端优化
- **验证:** 移动端清洗页折叠面板展开收起，桌面端无变化

### Commit 7: `feat(mobile): TranslateView 移动端适配`
**修改:** `app/src/views/TranslateView.vue`
- 移动端模板：3 个可折叠面板（文件信息 / 翻译配置 / 翻译结果）
- DataTable 通过 MobileTableWrapper 包裹
- **验证:** 移动端翻译页正常工作，桌面端无变化

### Commit 8: `feat(mobile): AnalysisView 移动端适配`
**修改:** `app/src/views/AnalysisView.vue`
- 移动端模板：4 个可折叠面板（文件信息 / 分析配置 / 输出列方案 / 打标结果）
- 高级设置独立折叠区（默认收起）
- 编辑列弹窗移动端已天然适配 (max-w-md)
- **验证:** 移动端分析页正常工作，桌面端无变化

### Commit 9: `feat(mobile): SummaryView 移动端适配`
**修改:** `app/src/views/SummaryView.vue`
- 移动端模板：3 个可折叠面板（文件信息 / 分析配置 / 摘要报告）
- Markdown 报告区全宽显示
- **验证:** 移动端摘要页正常工作，桌面端无变化

### Commit 10: `feat(mobile): SettingsModal 移动端全屏模式`
**修改:** `app/src/components/settings/SettingsModal.vue`
- isMobile 时全屏覆盖
- 所有 grid-cols-2 改为 grid-cols-1
- 底部固定操作栏
- **验证:** 移动端设置全屏，桌面端设置弹窗不变

### Commit 11: `feat(mobile): Toast 移动端位置优化`
**修改:** `app/src/components/common/ToastContainer.vue`
- 移动端顶部居中
- 宽度自适应
- **验证:** 移动端 Toast 顶部居中显示

### Commit 12: `feat(mobile): 移动端全局样式优化`
**修改:** `app/src/styles/main.css`
- 移动端系统字体栈 fallback
- 移动端滚动优化 (-webkit-overflow-scrolling: touch)
- 触摸友好的按钮尺寸

---

## 验证策略

每个 commit 后：
1. `npm run build` 通过
2. 桌面端 (≥1024px) 视觉效果和功能不变
3. 移动端 (≤768px) 新增功能正常工作
4. 浏览器 DevTools 设备模拟器测试 iPhone SE / iPhone 14 / Android 通用尺寸

---

## 不做的事

- 不做响应式断点渐进适配（用户要求完全分离）
- 不做卡片视图/列表视图切换（保持表格，横向滚动即可）
- 不做虚拟滚动（Excel 数据量通常在数百行级别）
- 不做离线 PWA
- 不修改任何业务逻辑
- 不修改 AI 调用逻辑
- 不修改路由配置
