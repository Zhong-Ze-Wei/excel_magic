import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useImportIntentStore = defineStore('importIntent', () => {
  const coreColumnIdx = ref(null)
  const tasks = ref({ clean: false, process: false, summary: false })
  const note = ref('')
  const confirmedAt = ref(null)
  const showModal = ref(false)
  const pendingFileMeta = ref(null)

  function open(meta) {
    pendingFileMeta.value = meta
    showModal.value = true
  }

  function close() {
    showModal.value = false
    pendingFileMeta.value = null
  }

  function submit({ coreColumnIdx: idx, tasks: t, note: n }) {
    coreColumnIdx.value = idx
    tasks.value = { ...t }
    note.value = n
    confirmedAt.value = Date.now()
    showModal.value = false
    pendingFileMeta.value = null
  }

  function reset() {
    coreColumnIdx.value = null
    tasks.value = { clean: false, process: false, summary: false }
    note.value = ''
    confirmedAt.value = null
  }

  return {
    coreColumnIdx, tasks, note, confirmedAt, showModal, pendingFileMeta,
    open, close, submit, reset
  }
})
