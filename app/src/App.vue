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
