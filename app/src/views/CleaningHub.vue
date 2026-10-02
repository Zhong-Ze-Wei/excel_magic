<template>
  <!-- 模式切换栏：与子视图根 padding 对齐 -->
  <div :class="isMobile ? HUB_BAR.mobile : HUB_BAR.desktop">
    <div class="flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200/60 px-4 py-2.5">
      <div class="flex items-center gap-2 text-xs min-w-0">
        <component :is="modeIcon" class="w-4 h-4 shrink-0" :class="modeColor" />
        <span class="font-bold text-slate-700 shrink-0">{{ modeLabel }}</span>
        <span class="text-slate-400 hidden sm:inline truncate">· {{ modeHint }}</span>
      </div>
      <button @click="toggleMode"
        class="px-3 py-1.5 bg-white border border-orange-200 hover:border-orange-400 hover:bg-orange-50 rounded-md text-xs font-bold text-orange-700 transition-colors flex items-center gap-1.5 shrink-0">
        <component :is="nextModeIcon" class="w-3.5 h-3.5" />
        {{ nextModeLabel }}
      </button>
    </div>
  </div>

  <!-- 动态挂载子视图（子视图自带 padding 和 max-width） -->
  <OptimizeView v-if="isSimple" />
  <CleaningView v-else />
</template>

<script setup>
import { computed } from 'vue'
import { Sparkles, SlidersHorizontal } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'
import { useDevice } from '../composables/useDevice'
import { useToast } from '../services/toast'
import { HUB_BAR } from '../styles/tokens'
import OptimizeView from './OptimizeView.vue'
import CleaningView from './CleaningView.vue'

const settings = useSettingsStore()
const { isMobile } = useDevice()
const toast = useToast()

const isSimple = computed(() => settings.cleaningMode === 'simple')

const modeLabel = computed(() => isSimple.value ? '简易模式 · AI 优化' : '专家模式 · 规则精调')
const modeHint = computed(() => isSimple.value ? '一句话描述目标，AI 自动配置规则' : '手动开关每条规则，逐项调整参数')
const modeIcon = computed(() => isSimple.value ? Sparkles : SlidersHorizontal)
const modeColor = computed(() => isSimple.value ? 'text-violet-600' : 'text-orange-600')

const nextModeLabel = computed(() => isSimple.value ? '专家模式' : '简易模式')
const nextModeIcon = computed(() => isSimple.value ? SlidersHorizontal : Sparkles)

function toggleMode() {
  const target = isSimple.value ? 'expert' : 'simple'
  settings.cleaningMode = target
  toast.success(`已切换到${target === 'expert' ? '专家模式' : '简易模式'}`)
}
</script>
