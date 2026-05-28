<template>
  <header class="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
    <div class="flex items-center gap-4">
      <h2 class="text-lg font-bold text-slate-800">{{ title }}</h2>
      <div v-if="settings.isConfigured"
        class="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-100 flex items-center gap-1">
        <Cpu class="w-3 h-3" />
        <span>{{ settings.translateModel }}</span>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <a href="https://github.com/Zhong-Ze-Wei" target="_blank" class="text-slate-400 hover:text-slate-600 transition-colors">
        <Github class="w-5 h-5" />
      </a>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore } from '../../stores/settings'
import { Cpu, Github } from 'lucide-vue-next'

const route = useRoute()
const settings = useSettingsStore()

const titles = {
  '/': '功能主页',
  '/translate': '批量翻译',
  '/text': '文本翻译',
  '/analysis': '数据分析',
  '/summary': '数据摘要',
  '/formula': '公式生成',
  '/cleaning': '数据清洗'
}

const title = computed(() => titles[route.path] || '智能分析助手')
</script>
