<template>
  <div class="flex flex-col h-screen overflow-hidden bg-slate-50/50">
    <MobileHeader />
    <div class="flex-1 overflow-y-auto scroll-smooth">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
    <MobileTabBar />
    <SettingsModal />
    <ToastContainer />
  </div>
</template>

<script setup>
import MobileHeader from './MobileHeader.vue'
import MobileTabBar from './MobileTabBar.vue'
import SettingsModal from '../settings/SettingsModal.vue'
import ToastContainer from '../common/ToastContainer.vue'
</script>
