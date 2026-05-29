<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id"
          class="flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border backdrop-blur-sm cursor-pointer"
          :class="toastClass(t.type)"
          @click="dismiss(t.id)">
          <span class="flex-1">{{ t.message }}</span>
          <X class="w-3.5 h-3.5 opacity-50 hover:opacity-100 shrink-0" />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { X } from 'lucide-vue-next'
import { useToast } from '../../services/toast'

const { toasts, dismiss } = useToast()

function toastClass(type) {
  const map = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warn: 'bg-amber-50 border-amber-200 text-amber-800'
  }
  return map[type] || map.info
}
</script>

<style scoped>
.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(40px); }
.toast-leave-to { opacity: 0; transform: translateX(40px); }
</style>
