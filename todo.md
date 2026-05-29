# Magic Excel 改进清单

## Phase 1: 基础体验修复
- [ ] 1.1 引入 toast 通知组件，替换全项目 alert()
- [ ] 1.2 删除废弃的 stores/data.js

## Phase 2: 性能提升
- [ ] 2.1 ai.js 新增并发控制函数 callAIBatch()，支持信号量限流
- [ ] 2.2 TranslateView 接入并发调用
- [ ] 2.3 AnalysisView 接入并发调用
- [ ] 2.4 翻译结果本地缓存（Map: 源文本 → 翻译结果），跳过已翻译行

## Phase 3: 功能增强
- [ ] 3.1 清洗审计表增加"重置所有覆写"按钮
- [ ] 3.2 清洗/分析页统计区域下方加 ECharts 图表（饼图/柱状图）
- [ ] 3.3 excel.js 支持多 Sheet 读取 + Sheet 选择器

## Phase 4: 架构优化
- [ ] 4.1 CleaningView 拆分：清洗规则配置面板 → 独立组件
- [ ] 4.2 AnalysisView 拆分：分类体系管理 → 独立组件
- [ ] 4.3 导出/共享逻辑抽到 composables（useExport, useShare）
- [ ] 4.4 统一 AI 响应 JSON 解析层（复用 parseRobustJSON）
