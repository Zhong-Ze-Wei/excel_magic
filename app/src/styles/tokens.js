/**
 * 布局 Design Tokens
 *
 * 统一全站页面布局的间距/宽度/分栏/卡片样式，避免各视图各写一套导致不一致。
 * 使用方式：import { LAYOUT } from '@/styles/tokens'，模板里 :class="LAYOUT.xxx"
 *
 * 设计原则：
 * - 只管「布局」（容器宽度、间距、分栏比例、卡片圆角），不管颜色
 *   （各功能区有自己的主题色：清洗橙、加工紫、摘要蓝，颜色不统一是对的）
 * - 移动端/桌面端共用一套，通过 responsiveValue 或 isMobile 选择
 */

// ── 页面根容器 ──
// 桌面：最大宽度 1280px 居中，垂直间距 24px
// 移动：左右 padding 12px，上下 padding 12px
export const PAGE = {
  // 有数据时的主内容容器（v-else 分支）
  desktop: 'animate-fade-in max-w-7xl mx-auto space-y-6',
  // 无数据/上传引导容器（v-if 分支，居中大留白）
  empty: 'animate-fade-in max-w-3xl mx-auto flex flex-col items-center justify-center py-20 text-center',
  // 移动端容器
  mobile: 'px-3 py-3 space-y-3 pb-20'
}

// ── Hub 切换栏容器 ──
export const HUB_BAR = {
  wrapper: {
    mobile: 'px-3 pt-3',
    desktop: 'max-w-7xl mx-auto pt-6'
  }
}

// ── 双栏布局（左配置 4/12 + 右主区 8/12）──
// 清洗简易/专家、加工专家都用这个
export const TWO_COL = {
  grid: 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start',
  left: 'lg:col-span-4 space-y-6',   // 左侧配置栏
  right: 'lg:col-span-8 space-y-6'   // 右侧主内容区
}

// ── 卡片 ──
export const CARD = {
  // 标准卡片（白底圆角边框）
  base: 'bg-white rounded-xl border border-slate-200/60',
  // 带阴影的卡片（主内容区）
  shadow: 'bg-white rounded-xl border border-slate-200 shadow-sm',
  // 内容内边距：标准 p-4 / 紧凑 p-3 / 宽松 p-5
  pad: 'p-4',
  padSm: 'p-3',
  padLg: 'p-5'
}

// ── 空状态（无数据时的上传引导）──
export const EMPTY_STATE = {
  // 整块居中容器
  container: 'bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center text-slate-400'
}

// ── 响应式选择辅助 ──
// 用法：responsiveClass(isMobile, PAGE.mobile, PAGE.desktop)
export function responsiveClass(isMobile, mobileClass, desktopClass) {
  return isMobile ? mobileClass : desktopClass
}

// 统一导出
export const LAYOUT = {
  PAGE,
  HUB_BAR,
  TWO_COL,
  CARD,
  EMPTY_STATE,
  responsiveClass
}
