<template>
  <nav class="h-14 bg-white border-t border-slate-200 flex items-stretch justify-around sticky bottom-0 z-10 safe-area-bottom">
    <button v-for="tab in tabs" :key="tab.route" @click="$router.push(tab.route)"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
      :class="isActive(tab.route)
        ? 'text-blue-600'
        : 'text-slate-400 active:text-slate-600'">
      <component :is="tab.icon" class="w-5 h-5" :stroke-width="isActive(tab.route) ? 2.5 : 1.5" />
      <span class="text-[10px] font-medium">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { LayoutGrid, Eraser, Languages, Brain, FileBarChart } from 'lucide-vue-next'

const route = useRoute()

const tabs = [
  { route: '/', label: '首页', icon: LayoutGrid },
  { route: '/cleaning', label: '清洗', icon: Eraser },
  { route: '/translate', label: '翻译', icon: Languages },
  { route: '/analysis', label: '分析', icon: Brain },
  { route: '/summary', label: '摘要', icon: FileBarChart }
]

function isActive(path) {
  return route.path === path
}
</script>
