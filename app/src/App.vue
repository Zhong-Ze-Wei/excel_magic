<template>
  <div class="flex h-screen overflow-hidden selection:bg-blue-100 selection:text-blue-700">
    <Sidebar />
    <main class="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50/50">
      <Header />
      <div class="flex-1 overflow-y-auto p-6 scroll-smooth">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
    <SettingsModal />
  </div>
</template>

<script setup>
import Sidebar from './components/layout/Sidebar.vue'
import Header from './components/layout/Header.vue'
import SettingsModal from './components/settings/SettingsModal.vue'
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
