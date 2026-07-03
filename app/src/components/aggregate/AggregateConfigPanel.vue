<template>
  <!--
    分组对比配置面板（三步向导 + 执行按钮）
    复用 CARD token 保证与全站卡片样式一致。
  -->
  <div :class="CARD.base + ' ' + CARD.body + ' space-y-4'">
    <h3 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
      <Settings class="w-4 h-4 text-slate-500" /> 配置
    </h3>

    <!-- ① 分组列 -->
    <div>
      <label class="block text-xs font-bold text-slate-600 mb-1.5">① 按哪列分组？</label>
      <select :value="groupColIdx" @change="e => $emit('update:group-col-idx', Number(e.target.value))"
        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500">
        <option :value="null" disabled>选择分组列…</option>
        <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}（{{ colTypeLabel(i) }}）</option>
      </select>
      <p v-if="!mobile" class="text-[10px] text-slate-400 mt-1">分组列作为对比维度（如「站点」「地区」）</p>
    </div>

    <!-- ② 值列 -->
    <div>
      <label class="block text-xs font-bold text-slate-600 mb-1.5">② 对哪列做统计？</label>
      <select :value="valueColIdx" :disabled="aggOp === 'count'"
        @change="e => $emit('update:value-col-idx', Number(e.target.value))"
        class="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">
        <option :value="null" disabled>选择值列…</option>
        <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}（{{ colTypeLabel(i) }}）</option>
      </select>
      <p v-if="aggOp === 'count'" class="text-[10px] text-amber-600 mt-1">计数模式不需要值列</p>
    </div>

    <!-- ③ 聚合方式 -->
    <div>
      <label class="block text-xs font-bold text-slate-600 mb-1.5">③ 怎么统计？</label>
      <div :class="mobile ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-5 gap-1.5'">
        <button v-for="op in AGGREGATE_OPS" :key="op.key"
          @click="$emit('update:agg-op', op.key)"
          class="py-2 rounded-lg text-[10px] font-bold transition-colors"
          :class="aggOp === op.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'">
          {{ op.label.split(' ')[0] }}
        </button>
      </div>
      <p class="text-[10px] text-slate-400 mt-1.5">{{ currentOpDesc }}</p>
    </div>

    <button @click="$emit('run')" :disabled="!canRun"
      class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
      开始对比
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Settings } from 'lucide-vue-next'
import { CARD } from '../../styles/tokens'
import { AGGREGATE_OPS } from '../../services/groupAggregate'
import { detectColumnType } from '../../services/dataProfiler'

const props = defineProps({
  headers: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  groupColIdx: { type: Number, default: null },
  valueColIdx: { type: Number, default: null },
  aggOp: { type: String, default: 'sum' },
  canRun: { type: Boolean, default: false },
  mobile: { type: Boolean, default: false }
})
defineEmits(['update:group-col-idx', 'update:value-col-idx', 'update:agg-op', 'run'])

const currentOpDesc = computed(() => AGGREGATE_OPS.find(o => o.key === props.aggOp)?.desc || '')

function colTypeLabel(idx) {
  if (idx == null || !props.rows.length) return ''
  const sample = props.rows.slice(0, 50).map(r => r[idx])
  const t = detectColumnType(sample)
  const labels = { number: '数值', text: '文本', enum: '枚举', date: '日期', boolean: '布尔', identifier: 'ID', empty: '空' }
  return labels[t] || t
}
</script>
