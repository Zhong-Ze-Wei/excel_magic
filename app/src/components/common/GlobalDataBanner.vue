<template>
  <div v-if="visible"
    class="bg-emerald-500/10 rounded-xl border border-emerald-500/20 overflow-hidden animate-fade-in">
    <!-- 横幅主体（可点击折叠） -->
    <button @click="toggle"
      class="w-full flex justify-between items-center text-xs px-4 py-3 hover:bg-emerald-500/5 transition-colors">
      <div class="flex items-center gap-2 text-emerald-800 min-w-0">
        <span class="relative flex h-2 w-2 shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span class="truncate">已关联全局工作表：<strong class="font-semibold">{{ sourceName }}</strong> ({{ rowCount }} 行)</span>
      </div>
      <div class="flex items-center gap-2 shrink-0 ml-2">
        <button v-if="!mobile" @click.stop="disconnect" class="text-rose-500 hover:text-rose-600 font-bold">断开</button>
        <button v-else @click.stop="disconnect" class="text-rose-500 font-bold">断开</button>
        <ChevronDown class="w-4 h-4 text-emerald-600 transition-transform duration-300 shrink-0"
          :class="{ 'rotate-180': isOpen }" />
      </div>
    </button>

    <!-- 折叠内容：前 N 行预览 -->
    <div class="overflow-hidden transition-all duration-300 ease-in-out"
      :style="{ maxHeight: isOpen ? contentHeight + 'px' : '0px' }">
      <div ref="contentRef" class="px-4 pb-3">
        <div class="bg-white rounded-lg border border-emerald-100 overflow-auto max-h-[240px]">
          <table class="w-full text-left border-collapse text-[10px]">
            <thead class="bg-emerald-50/50 sticky top-0 text-emerald-700 font-bold border-b border-emerald-100">
              <tr>
                <th class="px-2 py-1.5 w-8 text-center">#</th>
                <th v-for="(h, i) in previewHeaders" :key="i" class="px-2 py-1.5 whitespace-nowrap">{{ h }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-600">
              <tr v-for="(row, ri) in previewRows" :key="ri" class="hover:bg-slate-50/50">
                <td class="px-2 py-1 text-center text-slate-400 font-mono">{{ ri + 1 }}</td>
                <td v-for="(h, ci) in previewHeaders" :key="ci" class="px-2 py-1 max-w-[180px] truncate">{{ row[ci] ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="rowCount > previewLimit" class="text-[10px] text-slate-400 mt-1.5 text-center">
          仅显示前 {{ previewLimit }} 行（共 {{ rowCount }} 行）
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  visible: { type: Boolean, default: false },
  sourceName: { type: String, default: '' },
  headers: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  mobile: { type: Boolean, default: false },
  previewLimit: { type: Number, default: 8 }
})
const emit = defineEmits(['disconnect'])

const isOpen = ref(false)
const contentRef = ref(null)
const contentHeight = ref(1000)

const rowCount = computed(() => props.rows.length)
const previewHeaders = computed(() => props.headers.slice(0, 10))
const previewRows = computed(() => props.rows.slice(0, props.previewLimit))

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) nextTick(updateHeight)
}

function disconnect() {
  emit('disconnect')
}

function updateHeight() {
  if (contentRef.value) contentHeight.value = contentRef.value.scrollHeight + 10
}

onMounted(updateHeight)
watch(() => props.rows, () => { if (isOpen.value) nextTick(updateHeight) }, { deep: false })
</script>
