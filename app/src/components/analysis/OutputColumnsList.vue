<template>
  <div v-if="outputColumns.length > 0" class="space-y-2">
    <div class="flex justify-between items-center">
      <label class="text-xs font-bold text-slate-700">新增列方案 ({{ outputColumns.length }})</label>
      <button @click="$emit('add')" class="text-[10px] text-violet-600 hover:text-violet-700 font-bold flex items-center gap-0.5">
        <Plus class="w-3 h-3" /> 添加列
      </button>
    </div>

    <div v-for="(col, idx) in outputColumns" :key="col.key"
      class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5 relative group">
      <div class="flex justify-between items-center">
        <span class="text-[11px] font-bold text-slate-700">{{ col.name }}</span>
        <div class="flex items-center gap-1">
          <button @click="$emit('edit', idx)" class="text-slate-400 hover:text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
            <Pencil class="w-3 h-3" />
          </button>
          <button @click="$emit('remove', idx)" class="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">{{ col.type }}</span>
        <span class="text-[9px] text-slate-500">{{ col.description }}</span>
      </div>
      <div v-if="col.type === 'enum' && col.options?.length" class="flex flex-wrap gap-1 mt-0.5">
        <span v-for="opt in col.options" :key="opt" class="text-[9px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600">{{ opt }}</span>
      </div>
      <div v-if="col.type === 'hierarchical_enum' && col.options && typeof col.options === 'object'" class="space-y-0.5 mt-0.5">
        <div v-for="(children, parent) in col.options" :key="parent" class="text-[9px] text-slate-500">
          <span class="font-bold text-slate-600">{{ parent }}:</span> {{ (children || []).join(', ') }}
        </div>
      </div>
      <div v-if="col.type === 'multi_enum' && col.options?.length" class="flex flex-wrap gap-1 mt-0.5">
        <span v-for="opt in col.options" :key="opt" class="text-[9px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600">{{ opt }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Plus, Pencil, X } from 'lucide-vue-next'

defineProps({
  outputColumns: { type: Array, required: true }
})

defineEmits(['add', 'edit', 'remove'])
</script>
