<template>
  <div
    class="bg-white rounded-xl border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all group relative"
    :class="{ 'drag-active': isDragging }"
    @click="fileInput?.click()"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="handleDrop">
    <div class="p-4 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300" :class="iconBg">
      <component :is="icon" class="w-8 h-8" :class="iconColor" />
    </div>
    <h3 class="text-sm font-bold text-slate-700 mb-1 group-hover:text-blue-700 transition-colors">
      {{ label }}
    </h3>
    <p class="text-xs text-slate-400 mb-4">支持 .xlsx, .xls, .csv</p>
    <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="handleSelect" />
    <button class="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 text-xs font-bold hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm">
      选择文件
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { UploadCloud } from 'lucide-vue-next'

const props = defineProps({
  label: { type: String, default: '点击或拖拽文件' },
  icon: { type: [Object, Function], default: () => UploadCloud },
  iconBg: { type: String, default: 'bg-blue-50' },
  iconColor: { type: String, default: 'text-blue-600' }
})

const emit = defineEmits(['file'])
const fileInput = ref(null)
const isDragging = ref(false)

function handleSelect(e) {
  const file = e.target.files[0]
  if (file) emit('file', file)
}

function handleDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer.files[0]
  if (file) emit('file', file)
}
</script>
