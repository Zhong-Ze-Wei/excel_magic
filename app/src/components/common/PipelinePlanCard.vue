<template>
  <!--
    任务方案卡（首页视觉焦点）
    设计：把 AI 三步方案从意图卡内部提出来，做成全宽焦点卡。
    结构：目标行 → 三步横排卡片(箭头连接) → 主CTA
  -->
  <div class="relative bg-gradient-to-br from-blue-50 via-white to-emerald-50/40 border-2 border-blue-200 rounded-2xl shadow-lg shadow-blue-100/50 overflow-hidden">
    <!-- 顶部装饰条 -->
    <div class="h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500"></div>

    <div class="p-5 md:p-6">
      <!-- 目标行 -->
      <div class="flex items-start justify-between gap-3 mb-5">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 mb-1">
            <Target class="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span class="text-[10px] font-bold text-blue-600 uppercase tracking-wider">任务方案</span>
          </div>
          <p class="text-sm md:text-base font-bold text-slate-800 leading-snug break-words">
            {{ goal || '尚未设置任务目标' }}
          </p>
        </div>
        <button @click="$emit('edit')"
          class="shrink-0 px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm">
          <Pencil class="w-3 h-3" /> 编辑目标
        </button>
      </div>

      <!-- 三步流水线（横排） -->
      <div class="flex items-stretch gap-2 md:gap-3 mb-5 overflow-x-auto pb-1">
        <!-- 清洗 -->
        <div v-if="steps.clean" @click="$emit('step', 'clean')"
          class="step-card group flex-1 min-w-[140px] bg-white border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md hover:border-orange-300"
          :class="steps.clean.feasible === 'no' ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'">
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="text-lg">{{ icons.clean }}</span>
            <span class="text-xs font-bold text-slate-700">清洗</span>
            <FeasibleTag v-if="steps.clean.feasible" :level="steps.clean.feasible" />
          </div>
          <p class="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{{ steps.clean.summary }}</p>
        </div>

        <div v-if="steps.clean && (steps.process || steps.aggregate)" class="flex items-center text-slate-300 text-xl shrink-0">→</div>

        <!-- 加工 -->
        <div v-if="steps.process" @click="$emit('step', 'process')"
          class="step-card group flex-1 min-w-[140px] bg-white border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md hover:border-violet-300"
          :class="steps.process.feasible === 'no' ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'">
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="text-lg">{{ icons.process }}</span>
            <span class="text-xs font-bold text-slate-700">加工</span>
            <FeasibleTag v-if="steps.process.feasible" :level="steps.process.feasible" />
          </div>
          <p class="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{{ steps.process.summary }}</p>
        </div>

        <div v-if="steps.process && steps.summary" class="flex items-center text-slate-300 text-xl shrink-0">→</div>

        <!-- 聚合（对比类任务） -->
        <div v-if="steps.aggregate" @click="$emit('step', 'aggregate')"
          class="step-card group flex-1 min-w-[140px] bg-white border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md hover:border-blue-300"
          :class="steps.aggregate.feasible === 'no' ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'">
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="text-lg">{{ icons.aggregate }}</span>
            <span class="text-xs font-bold text-slate-700">对比</span>
            <FeasibleTag v-if="steps.aggregate.feasible" :level="steps.aggregate.feasible" />
          </div>
          <p class="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{{ steps.aggregate.summary }}</p>
        </div>

        <div v-if="steps.aggregate && steps.summary" class="flex items-center text-slate-300 text-xl shrink-0">→</div>

        <!-- 摘要 -->
        <div v-if="steps.summary" @click="$emit('step', 'summary')"
          class="step-card group flex-1 min-w-[140px] bg-white border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md hover:border-emerald-300"
          :class="steps.summary.feasible === 'no' ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'">
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="text-lg">{{ icons.summary }}</span>
            <span class="text-xs font-bold text-slate-700">摘要</span>
            <FeasibleTag v-if="steps.summary.feasible" :level="steps.summary.feasible" />
          </div>
          <p class="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{{ steps.summary.summary }}</p>
        </div>
      </div>

      <!-- 主 CTA -->
      <button @click="$emit('start')"
        class="w-full py-2.5 md:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]">
        <Play class="w-4 h-4" /> 按方案开始
      </button>
    </div>
  </div>
</template>

<script setup>
import { Target, Pencil, Play } from 'lucide-vue-next'
import FeasibleTag from './FeasibleTag.vue'

defineProps({
  goal: { type: String, default: '' },
  steps: {
    type: Object,
    // { clean?: {summary, feasible}, process?: {...}, summary?: {...} }
    default: () => ({})
  }
})
defineEmits(['edit', 'start', 'step'])

const icons = { clean: '🧹', process: '🏷️', aggregate: '📊', summary: '📋' }
</script>
