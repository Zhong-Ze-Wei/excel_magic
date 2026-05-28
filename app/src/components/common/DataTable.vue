<template>
  <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden" :class="heightClass">
    <!-- Header -->
    <div class="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
      <div class="flex items-center gap-2">
        <Table2 class="w-4 h-4 text-slate-400" />
        <span class="text-sm font-bold text-slate-700">{{ title }}</span>
        <span v-if="rowCount" class="text-xs text-slate-400 ml-2">{{ rowCount }} 行</span>
      </div>
      <slot name="actions" />
    </div>
    <!-- Table -->
    <div class="flex-1 overflow-auto relative">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50 sticky top-0 z-10 text-xs font-semibold text-slate-500">
          <tr>
            <th v-for="h in headers" :key="h"
              class="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              {{ h }}
            </th>
          </tr>
        </thead>
        <tbody class="text-sm text-slate-600 divide-y divide-slate-100">
          <tr v-if="rows.length === 0">
            <td :colspan="headers.length || 1" class="py-20 text-center">
              <div class="flex flex-col items-center justify-center text-slate-300">
                <FileSpreadsheet class="w-12 h-12 mb-3 opacity-50" />
                <p class="text-sm">{{ emptyText }}</p>
              </div>
            </td>
          </tr>
          <tr v-for="(row, ri) in displayRows" :key="ri" class="hover:bg-slate-50 transition-colors">
            <td v-for="(_, ci) in headers.length" :key="ci"
              class="px-4 py-3 border-b border-slate-100 text-slate-600 whitespace-nowrap max-w-[200px] truncate">
              {{ row[ci] ?? '' }}
            </td>
          </tr>
        </tbody>
      </table>
      <slot name="overlay" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Table2, FileSpreadsheet } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, default: '数据预览' },
  headers: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  maxRows: { type: Number, default: 50 },
  emptyText: { type: String, default: '请先上传文件或加载数据' },
  heightClass: { type: String, default: 'h-[500px]' },
  rowCount: { type: Number, default: 0 }
})

const displayRows = computed(() => props.rows.slice(0, props.maxRows))
</script>
