<template>
  <DesktopLayout v-if="isDesktop" />
  <MobileLayout v-else />
  <ImportIntentModal />
</template>

<script setup>
import { useDevice } from './composables/useDevice'
import DesktopLayout from './components/layout/DesktopLayout.vue'
import MobileLayout from './components/layout/MobileLayout.vue'
import ImportIntentModal from './components/ImportIntentModal.vue'

const { isDesktop } = useDevice()
</script>
