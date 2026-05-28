import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/translate', name: 'translate', component: () => import('../views/TranslateView.vue') },
  { path: '/text', name: 'text', component: () => import('../views/TextTranslateView.vue') },
  { path: '/analysis', name: 'analysis', component: () => import('../views/AnalysisView.vue') },
  { path: '/summary', name: 'summary', component: () => import('../views/SummaryView.vue') },
  { path: '/formula', name: 'formula', component: () => import('../views/FormulaView.vue') },
  { path: '/cleaning', name: 'cleaning', component: () => import('../views/CleaningView.vue') }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
