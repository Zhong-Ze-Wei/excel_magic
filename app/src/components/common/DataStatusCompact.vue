<template>
  <!--
    简洁数据状态条（首页第一层）
    设计：比 GlobalDataBanner 更轻——只展示「文件名 + 规格 + Sheet 切换 + 卸载」，
    核心列选择移到意图弹窗内（不再单独占首页一块）。
  -->
  <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center justify-between gap-3">
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <div class="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
        <Database class="w-4.5 h-4.5 text-emerald-600" />
      </div>
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="relative flex h-1.5 w-1.5 shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span class="text-xs font-bold text-slate-800 truncate">{{ sourceName }}</span>
        </div>
        <div class="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
          <span class="font-mono font-bold text-slate-700">{{ rowCount }} 行</span>
          <span class="text-slate-300">×</span>
          <span class="font-mono font-bold text-slate-700">{{ colCount }} 列</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <!-- Sheet 切换（多 Sheet 时） -->
      <select v-if="hasMultipleSheets" :value="currentSheet" @change="e => $emit('set-sheet', e.target.value)"
        class="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold outline-none cursor-pointer max-w-[120px]">
        <option v-for="name in sheetNames" :key="name" :value="name">{{ name }}</option>
      </select>

      <!-- 统一导出按钮 -->
      <button @click="exportGlobal"
        class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
        title="导出当前全局工作表为 Excel">
        <Download class="w-3.5 h-3.5" /> 导出
      </button>

      <button @click="$emit('clear')"
        class="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
        title="卸载数据">
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { Database, X, Download } from 'lucide-vue-next'
import { useDataShareStore } from '../../stores/dataShare'
import { exportToXlsx } from '../../services/excel'
import { useToast } from '../../services/toast'

defineProps({
  sourceName: { type: String, default: '' },
  rowCount: { type: Number, default: 0 },
  colCount: { type: Number, default: 0 },
  hasMultipleSheets: { type: Boolean, default: false },
  sheetNames: { type: Array, default: () => [] },
  currentSheet: { type: String, default: '' }
})
defineEmits(['clear', 'set-sheet'])

const dataShare = useDataShareStore()
const toast = useToast()

// 统一导出：把当前全局工作表完整导出为 Excel
function exportGlobal() {
  if (!dataShare.rows.length) { toast.warn('暂无数据可导出'); return }
  exportToXlsx([...dataShare.headers], dataShare.rows.map(r => [...r]), dataShare.sourceName || '全局工作表.xlsx')
  toast.success('已导出全局工作表')
}
</script>
