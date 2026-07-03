<template>
  <!--
    AI 方案引导条 — 进入页面时若 AI 已规划好方案，顶部展示此条。
    解决"简易模式看不到清洗方案、没有快速开始按钮"的问题。
    用户可选：① 按方案一键执行  ② 微调（展开手动配置）
  -->
  <div v-if="visible && !dismissed"
    class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 md:p-4 flex items-start justify-between gap-3">
    <div class="flex items-start gap-2.5 min-w-0 flex-1">
      <Sparkles class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
      <div class="min-w-0">
        <p class="text-xs font-bold text-blue-800 mb-0.5">AI 已为你规划方案</p>
        <p class="text-[11px] md:text-xs text-slate-600 leading-relaxed break-words">{{ summary }}</p>
      </div>
    </div>
    <div class="flex items-center gap-1.5 shrink-0">
      <button @click="$emit('run')"
        class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap">
        <Play class="w-3 h-3" /> 执行
      </button>
      <button @click="dismissed = true"
        class="px-2 py-1.5 text-slate-400 hover:text-slate-600 rounded-lg text-xs transition-colors"
        title="忽略，手动配置">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Sparkles, Play, X } from 'lucide-vue-next'

defineProps({
  visible: { type: Boolean, default: false },
  summary: { type: String, default: '' }
})
defineEmits(['run'])

// 用户点 X 关闭后本会话不再显示
const dismissed = ref(false)
</script>
