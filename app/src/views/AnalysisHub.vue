<template>
  <!-- 模式切换栏 -->
  <div :class="isMobile ? HUB_BAR.mobile : HUB_BAR.desktop">
    <div class="flex items-center justify-between bg-gradient-to-r from-violet-50 to-fuchsia-50 rounded-xl border border-violet-200/60 px-4 py-2.5">
      <div class="flex items-center gap-2 text-xs min-w-0">
        <component :is="modeIcon" class="w-4 h-4 shrink-0" :class="modeColor" />
        <span class="font-bold text-slate-700 shrink-0">{{ modeLabel }}</span>
        <span class="text-slate-400 hidden sm:inline truncate">· {{ modeHint }}</span>
      </div>
      <button @click="toggleMode"
        class="px-3 py-1.5 bg-white border border-violet-200 hover:border-violet-400 hover:bg-violet-50 rounded-md text-xs font-bold text-violet-700 transition-colors flex items-center gap-1.5 shrink-0">
        <component :is="nextModeIcon" class="w-3.5 h-3.5" />
        {{ nextModeLabel }}
      </button>
    </div>
  </div>

  <!-- 动态挂载子视图（keep-alive 缓存，切换不销毁，避免数据丢失） -->
  <keep-alive>
    <component :is="isSimple ? AnalysisSimpleView : AnalysisView" />
  </keep-alive>
</template>

<script setup>
import { computed } from 'vue'
import { Sparkles, SlidersHorizontal } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'
import { useDevice } from '../composables/useDevice'
import { useToast } from '../services/toast'
import { HUB_BAR } from '../styles/tokens'
import AnalysisSimpleView from './AnalysisSimpleView.vue'
import AnalysisView from './AnalysisView.vue'

const settings = useSettingsStore()
const { isMobile } = useDevice()
const toast = useToast()

const isSimple = computed(() => settings.processMode === 'simple')

const modeLabel = computed(() => isSimple.value ? '简易模式 · 模板驱动' : '专家模式 · 列配置精调')
const modeHint = computed(() => isSimple.value ? '选预设模板或 AI 生成，一键打标' : '手动配置输出列、参考列、范围与 Prompt')
const modeIcon = computed(() => isSimple.value ? Sparkles : SlidersHorizontal)
const modeColor = computed(() => isSimple.value ? 'text-violet-600' : 'text-fuchsia-600')

const nextModeLabel = computed(() => isSimple.value ? '专家模式' : '简易模式')
const nextModeIcon = computed(() => isSimple.value ? SlidersHorizontal : Sparkles)

function toggleMode() {
  const target = isSimple.value ? 'expert' : 'simple'
  settings.processMode = target
  toast.success(`已切换到${nextModeLabel.value}`)
}
</script>
