<template>
  <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <button @click="toggle" :aria-expanded="isOpen"
      class="w-full flex items-center justify-between px-4 py-3 text-left active:bg-slate-50 transition-colors">
      <span class="text-sm font-semibold text-slate-700">{{ title }}</span>
      <div class="flex items-center gap-2">
        <slot name="header-right" />
        <ChevronDown class="w-4 h-4 text-slate-400 transition-transform duration-300"
          :class="{ 'rotate-180': isOpen }" />
      </div>
    </button>
    <div v-show="isOpen" class="px-4 pb-4">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, required: true },
  defaultOpen: { type: Boolean, default: true }
})

const isOpen = ref(props.defaultOpen)
function toggle() {
  isOpen.value = !isOpen.value
}
</script>
