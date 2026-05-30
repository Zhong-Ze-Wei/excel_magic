<template>
  <div class="flex h-screen overflow-hidden selection:bg-blue-100 selection:text-blue-700">
    <Sidebar />
    <main class="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50/50">
      <Header />
      <div class="flex-1 overflow-y-auto p-6 scroll-smooth">
        <router-view v-slot="{ Component }">
          <transition name="fade">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
    <SettingsModal />
    <ToastContainer />
  </div>
</template>

<script setup>
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
import SettingsModal from '../settings/SettingsModal.vue'
import ToastContainer from '../common/ToastContainer.vue'
</script>
