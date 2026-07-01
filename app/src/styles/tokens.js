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
