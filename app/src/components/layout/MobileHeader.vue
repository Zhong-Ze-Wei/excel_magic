<template>
  <header class="h-12 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-10">
    <h2 class="text-base font-bold text-slate-800 truncate">{{ title }}</h2>
    <button @click="settings.showSettings = true"
      class="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 active:text-slate-600 active:bg-slate-100 transition-colors">
      <Settings class="w-5 h-5" />
    </button>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore } from '../../stores/settings'
import { Settings } from 'lucide-vue-next'

const route = useRoute()
const settings = useSettingsStore()

const titles = {
  '/': '功能主页',
  '/cleaning': '数据清洗',
  '/translate': '批量翻译',
  '/analysis': '数据分析',
  '/summary': '数据摘要',
  '/transform': '列变换',
  '/grouping': '数据分组',
  '/extract': '文本提取',
  '/formula': '公式生成',
  '/compare': '数据对比'
}

const title = computed(() => titles[route.path] || '智能分析助手')
</script>
