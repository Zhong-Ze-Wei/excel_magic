<template>
  <div v-if="visible"
    class="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
    <div class="w-64 h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
      <div class="h-full bg-blue-600 transition-all duration-300" :style="{ width: percent + '%' }"></div>
    </div>
    <p class="text-sm font-bold text-blue-600 animate-pulse">
      {{ text }} <span>{{ current }}/{{ total }}</span>
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  current: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  text: { type: String, default: '处理中...' }
})

const percent = computed(() => props.total > 0 ? Math.round((props.current / props.total) * 100) : 0)
</script>
