<template>
  <!--
    可行性标注：显示某步骤的可行性等级
    - yes: ✅ 可完成（绿）
    - partial: ⚠️ 仅部分（琥珀）
    - no: ❌ 无法完成（红）
  -->
  <span class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold leading-none"
    :class="levelClass">
    {{ levelIcon }} {{ levelText }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  level: { type: String, default: '' } // 'yes' | 'partial' | 'no' | ''
})

const config = {
  yes:    { icon: '✅', text: '可行', cls: 'bg-emerald-100 text-emerald-700' },
  partial:{ icon: '⚠️', text: '部分', cls: 'bg-amber-100 text-amber-700' },
  no:     { icon: '❌', text: '越界', cls: 'bg-rose-100 text-rose-700' }
}

const cfg = computed(() => config[props.level] || null)
const levelIcon = computed(() => cfg.value?.icon || '')
const levelText = computed(() => cfg.value?.text || '')
const levelClass = computed(() => cfg.value?.cls || '')
</script>
