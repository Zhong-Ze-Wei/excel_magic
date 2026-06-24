<template>
  <aside class="w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm">
    <!-- Logo -->
    <div class="p-6 border-b border-slate-100 flex items-center gap-3">
      <div class="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
        <Wand2 class="w-5 h-5" />
      </div>
      <div>
        <h1 class="font-bold text-slate-800 text-lg tracking-tight">智能分析助手</h1>
        <p class="text-[10px] text-slate-400 font-medium uppercase tracking-wider">PRO VERSION</p>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      <button @click="$router.push('/')" :class="navClass('home')"
        class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors">
        <LayoutGrid class="w-4 h-4" /> 功能主页
      </button>

      <div class="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Excel 处理</div>

      <button @click="$router.push('/optimize')" :class="navClass('optimize')"
        class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors">
        <Sparkles class="w-4 h-4" /> 数据优化
      </button>
      <button @click="$router.push('/cleaning')" :class="navClass('cleaning')"
        class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors">
        <Eraser class="w-4 h-4" /> 数据清洗
      </button>
      <button @click="$router.push('/process')" :class="navClass('process')"
        class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors">
        <Wand2 class="w-4 h-4" /> 智能加工
      </button>
      <button @click="$router.push('/summary')" :class="navClass('summary')"
        class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors">
        <FileBarChart class="w-4 h-4" /> 数据摘要
      </button>
    </nav>

    <!-- Settings Button -->
    <div class="p-4 border-t border-slate-100">
      <button @click="settings.showSettings = true"
        class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 transition-colors border border-slate-200">
        <Settings class="w-4 h-4" />
        API 设置
        <span class="ml-auto w-2 h-2 rounded-full" :class="settings.isConfigured ? 'bg-green-400' : 'bg-red-400'"></span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useSettingsStore } from '../../stores/settings'
import { Wand2, LayoutGrid, FileBarChart, Eraser, Settings, Sparkles } from 'lucide-vue-next'

const route = useRoute()
const settings = useSettingsStore()

const routeMap = {
  home: '/', optimize: '/optimize', cleaning: '/cleaning',
  process: '/process', summary: '/summary'
}

function navClass(name) {
  const isActive = route.path === routeMap[name]
  return isActive
    ? 'sidebar-item-active'
    : 'text-slate-600 hover:bg-slate-50'
}
</script>
