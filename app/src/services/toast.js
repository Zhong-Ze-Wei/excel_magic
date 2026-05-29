import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

export function useToast() {
  function show(message, type = 'info', duration = 3000) {
    const id = nextId++
    toasts.value.push({ id, message, type })
    setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  function success(msg) { show(msg, 'success') }
  function error(msg) { show(msg, 'error', 5000) }
  function info(msg) { show(msg, 'info') }
  function warn(msg) { show(msg, 'warn', 4000) }

  function clearAll() { toasts.value = [] }

  return { toasts, show, dismiss, clearAll, success, error, info, warn }
}
