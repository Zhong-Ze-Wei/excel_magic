import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/process', name: 'process', component: () => import('../views/AnalysisView.vue') },
  // 过渡期：translate/analysis 重定向到 /process，一周后随 TranslateView 删除一并清理
  { path: '/translate', redirect: '/process' },
  { path: '/analysis', redirect: '/process' },
  { path: '/summary', name: 'summary', component: () => import('../views/SummaryView.vue') },
  // 数据清洗 = 简易模式（OptimizeView）+ 专家模式（CleaningView），统一入口在 CleaningHub
  { path: '/cleaning', name: 'cleaning', component: () => import('../views/CleaningHub.vue') },
  { path: '/optimize', redirect: '/cleaning' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
