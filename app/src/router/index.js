import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/process', name: 'process', component: () => import('../views/AnalysisView.vue') },
  // 过渡期：translate/analysis 重定向到 /process，一周后随 TranslateView 删除一并清理
  { path: '/translate', redirect: '/process' },
  { path: '/analysis', redirect: '/process' },
  { path: '/summary', name: 'summary', component: () => import('../views/SummaryView.vue') },
  { path: '/optimize', name: 'optimize', component: () => import('../views/OptimizeView.vue') },
  { path: '/cleaning', name: 'cleaning', component: () => import('../views/CleaningView.vue') }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
