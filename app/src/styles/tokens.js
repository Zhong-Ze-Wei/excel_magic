/**
 * 布局 Design Tokens — 全站页面布局统一约束
 *
 * 只收各视图真实在用的布局 class，避免散落硬编码导致不一致。
 * 颜色不在此约束（各功能区主题色不同是对的）。
 */

// 页面根容器
export const PAGE = {
  desktop: 'animate-fade-in max-w-7xl mx-auto space-y-6',
  mobile: 'px-3 py-3 space-y-3 pb-20'
}

// Hub 切换栏容器
export const HUB_BAR = {
  mobile: 'px-3 pt-3',
  desktop: 'max-w-7xl mx-auto pt-6'
}

// 双栏布局（左 4/12 配置 + 右 8/12 主区）
export const TWO_COL = {
  grid: 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start',
  left: 'lg:col-span-4 space-y-6',
  right: 'lg:col-span-8 space-y-6'
}

// 统一卡片基类（6 页面共用）
export const CARD = {
  base: 'bg-white rounded-xl border border-slate-200 shadow-sm',
  body: 'p-4 md:p-5'
}

// 页面标题块（h2 + 图标 + 副标题）统一规格
export const PAGE_HEADER = {
  desktop: 'rounded-2xl border p-6',
  mobile: 'rounded-xl border p-3'
}

/**
 * 功能模块主题色映射 — PageHeader / 强调元素统一引用。
 * key 对应业务模块：clean / process / aggregate / summary。
 * 每个色系提供：bg（标题块淡背景）、border（标题块边框）、text（图标/标题色）、accent（按钮）。
 */
export const THEME_COLORS = {
  clean:     { bg: 'bg-gradient-to-r from-orange-500/10 to-amber-500/10', border: 'border-orange-200/50', text: 'text-orange-600', accent: 'bg-orange-600' },
  process:   { bg: 'bg-gradient-to-r from-violet-500/10 to-purple-500/10', border: 'border-violet-200/50', text: 'text-violet-600', accent: 'bg-violet-600' },
  aggregate: { bg: 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10', border: 'border-blue-200/50', text: 'text-blue-600', accent: 'bg-blue-600' },
  summary:   { bg: 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10', border: 'border-emerald-200/50', text: 'text-emerald-600', accent: 'bg-emerald-600' }
}
