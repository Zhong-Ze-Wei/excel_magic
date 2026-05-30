<template>
  <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div v-if="title" class="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
        <Table2 class="w-3.5 h-3.5" />
        {{ title }}
      </div>
      <span v-if="rowCount !== undefined" class="text-xs text-slate-400">{{ rowCount }} 行</span>
    </div>
    <div class="overflow-auto" style="-webkit-overflow-scrolling: touch" :class="heightClass">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { Table2 } from 'lucide-vue-next'

defineProps({
  title: { type: String, default: '' },
  rowCount: { type: Number, default: undefined },
  heightClass: { type: String, default: 'h-[45vh]' }
})
</script>
