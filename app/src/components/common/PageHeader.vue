<template>
  <!--
    页面标题块（统一规格）— h2 + 图标 + 副标题
    替代各页面各自手写的标题区（AnalysisView/SummaryView/AggregateView 原本各写一份）。
    主题色通过 theme prop 映射到 THEME_COLORS。
  -->
  <div :class="[isMobile ? PAGE_HEADER.mobile : PAGE_HEADER.desktop, theme.bg, theme.border]">
    <h2 class="font-bold text-slate-800 flex items-center gap-2"
      :class="isMobile ? 'text-base' : 'text-xl'">
      <component :is="icon" class="shrink-0" :class="[theme.text, isMobile ? 'w-5 h-5' : 'w-6 h-6']" />
      {{ title }}
    </h2>
    <p v-if="subtitle" class="text-slate-500 mt-1"
      :class="isMobile ? 'text-[10px]' : 'text-xs'">
      {{ subtitle }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDevice } from '../../composables/useDevice'
import { PAGE_HEADER, THEME_COLORS } from '../../styles/tokens'

const props = defineProps({
  icon: { type: [Object, Function], required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  // 主题色 key：clean / process / aggregate / summary
  theme: { type: String, default: 'summary' }
})

const { isMobile } = useDevice()
const theme = computed(() => THEME_COLORS[props.theme] || THEME_COLORS.summary)
</script>
