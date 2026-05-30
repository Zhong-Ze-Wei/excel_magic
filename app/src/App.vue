<template>
  <DesktopLayout v-if="isDesktop" />
  <MobileLayout v-else />
</template>

<script setup>
import { useDevice } from './composables/useDevice'
import DesktopLayout from './components/layout/DesktopLayout.vue'
import MobileLayout from './components/layout/MobileLayout.vue'

const { isDesktop } = useDevice()
</script>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from {
  opacity: 0; transform: translateY(8px);
}
.fade-leave-to {
  opacity: 0; transform: translateY(-4px);
}
</style>
