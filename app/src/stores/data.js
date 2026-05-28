import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDataStore = defineStore('data', () => {
  const headers = ref([])
  const rows = ref([])
  const fileName = ref('')

  function setData(newHeaders, newRows, name = '') {
    headers.value = newHeaders
    rows.value = newRows
    fileName.value = name
  }

  function clear() {
    headers.value = []
    rows.value = []
    fileName.value = ''
  }

  return { headers, rows, fileName, setData, clear }
})
