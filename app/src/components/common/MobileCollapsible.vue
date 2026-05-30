<template>
  <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <button @click="toggle"
      class="w-full flex items-center justify-between px-4 py-3 text-left active:bg-slate-50 transition-colors">
      <span class="text-sm font-semibold text-slate-700">{{ title }}</span>
      <div class="flex items-center gap-2">
        <slot name="header-right" />
        <ChevronDown class="w-4 h-4 text-slate-400 transition-transform duration-300"
          :class="{ 'rotate-180': isOpen }" />
      </div>
    </button>
    <div class="overflow-hidden transition-all duration-300 ease-in-out"
      :style="{ maxHeight: isOpen ? contentHeight + 'px' : '0px' }">
      <div ref="contentRef" class="px-4 pb-4">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, required: true },
  defaultOpen: { type: Boolean, default: true }
})

const isOpen = ref(props.defaultOpen)
const contentRef = ref(null)
const contentHeight = ref(2000)

onMounted(async () => {
  await nextTick()
  if (contentRef.value) {
    contentHeight.value = contentRef.value.scrollHeight
  }
})

function toggle() {
  isOpen.value = !isOpen.value
}
</script>
