import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  // 智能加工 = 简易模式（AnalysisSimpleView）+ 专家模式（AnalysisView），统一入口在 AnalysisHub
  { path: '/process', name: 'process', component: () => import('../views/AnalysisHub.vue') },
  // 旧路由 /analysis 重定向到 /process
  { path: '/analysis', redirect: '/process' },
  { path: '/summary', name: 'summary', component: () => import('../views/SummaryView.vue') },
  // 分组对比：按某列分组对另一列做 SUM/AVG/COUNT/MIN/MAX，独立第四模块
  { path: '/aggregate', name: 'aggregate', component: () => import('../views/AggregateView.vue') },
  // 数据清洗 = 简易模式（OptimizeView）+ 专家模式（CleaningView），统一入口在 CleaningHub
  { path: '/cleaning', name: 'cleaning', component: () => import('../views/CleaningHub.vue') },
  { path: '/optimize', redirect: '/cleaning' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
