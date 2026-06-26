<template>
  <div class="flex-1 overflow-auto">
    <table class="w-full text-left border-collapse min-w-[900px]">
      <thead class="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 shadow-sm">
        <tr>
          <th class="px-3 py-3 w-16 text-center">状态</th>
          <th class="px-4 py-3">命中规则与置信度</th>
          <th class="px-4 py-3">原文 (清洗列)</th>
          <th class="px-4 py-3">标准化文本</th>
          <th class="px-4 py-3 w-28 text-center">决策覆写</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 text-[11px] text-slate-600">
        <tr v-for="(item, ri) in rows" :key="ri"
          class="hover:bg-slate-50/50 transition-colors"
          :class="rowClass(item.decision)">

          <!-- Decision Status Tag -->
          <td class="px-3 py-2 text-center whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold" :class="statusBadgeClass(item.decision)">
              {{ statusLabel(item.decision) }}
            </span>
          </td>

          <!-- Hit Rule and Reason -->
          <td class="px-4 py-2">
            <div class="flex items-center gap-1">
              <span class="font-mono text-[10px] font-bold" :class="ruleClass(item.decision)">{{ item.hitRule }}</span>
              <span v-if="item.confidence > 0 && item.confidence < 1" class="text-[9px] text-slate-400">({{ item.confidence }})</span>
            </div>
            <div class="text-[9px] text-slate-400 leading-tight mt-0.5">{{ item.reason }}</div>
          </td>

          <!-- Original Text -->
          <td class="px-4 py-2 truncate max-w-[220px]" :title="item.originalText">
            {{ item.originalText || '' }}
          </td>

          <!-- Normalized Text -->
          <td class="px-4 py-2 truncate max-w-[220px]" :title="item.normalizedText">
            {{ item.normalizedText || '' }}
          </td>

          <!-- User Overwrite Actions -->
          <td class="px-4 py-2 text-center whitespace-nowrap">
            <div class="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white shadow-sm gap-0.5">
              <button @click="$emit('overwrite', { index: ri, decision: 'keep' })" title="标记保留"
                class="p-1 rounded transition-colors"
                :class="item.decision === 'keep' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-emerald-500 hover:bg-slate-50'">
                <Check class="w-3 h-3" />
              </button>
              <button @click="$emit('overwrite', { index: ri, decision: 'delete' })" title="标记删除"
                class="p-1 rounded transition-colors"
                :class="item.decision === 'delete' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-rose-500 hover:bg-slate-50'">
                <X class="w-3 h-3" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { Check, X } from 'lucide-vue-next'

defineProps({
  // 清洗预览结果（前 100 行），每项含 decision/hitRule/reason/originalText/normalizedText/confidence
  rows: {
    type: Array,
    default: () => []
  }
})

// 覆写决策事件：{ index, decision: 'keep' | 'delete' }
defineEmits(['overwrite'])

// 行背景色
function rowClass(decision) {
  if (decision === 'delete') return 'bg-rose-50/20 text-rose-700/90'
  if (decision === 'suspect') return 'bg-amber-50/20 text-amber-700/90'
  return ''
}

function statusBadgeClass(decision) {
  if (decision === 'delete') return 'bg-rose-100 text-rose-800'
  if (decision === 'suspect') return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
}

function statusLabel(decision) {
  if (decision === 'delete') return '已删除'
  if (decision === 'suspect') return '待确认'
  return '保留'
}

function ruleClass(decision) {
  if (decision === 'delete') return 'text-rose-600 bg-rose-50 px-1 py-0.5 rounded'
  if (decision === 'suspect') return 'text-amber-600 bg-amber-50 px-1 py-0.5 rounded'
  return 'text-slate-400 bg-slate-100 px-1 py-0.5 rounded'
}
</script>
