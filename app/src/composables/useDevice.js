import { ref, computed } from 'vue'

const isMobile = ref(false)

if (typeof window !== 'undefined') {
  const mql = window.matchMedia('(max-width: 768px)')
  isMobile.value = mql.matches
  mql.addEventListener('change', (e) => { isMobile.value = e.matches })
}

export function useDevice() {
  return {
    isMobile,
    isDesktop: computed(() => !isMobile.value)
  }
}
