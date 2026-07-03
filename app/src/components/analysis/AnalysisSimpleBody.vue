<template>
  <!--
    智能加工简易模式主体：方案来源(AI/模板) + 方案预览 + 进度 + 执行 + 统计 + 导出
    卡片统一使用 CARD token，与全站保持一致（实色 border + shadow-sm + rounded-xl）。
  -->
  <div class="space-y-4">
    <!-- 方案来源：AI 生成 / 模板快选（二选一 tab） -->
    <section :class="CARD.base + ' ' + CARD.body">
      <div class="flex gap-1 mb-3 p-0.5 bg-slate-100 rounded-lg">
        <button @click="$emit('update:plan-source', 'ai')" :class="['flex-1 py-1.5 rounded-md text-xs font-bold transition-all', planSource === 'ai' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500']">
          <Sparkles class="w-3 h-3 inline mr-0.5" /> AI 生成
        </button>
        <button @click="$emit('update:plan-source', 'template')" :class="['flex-1 py-1.5 rounded-md text-xs font-bold transition-all', planSource === 'template' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500']">
          <LayoutGrid class="w-3 h-3 inline mr-0.5" /> 模板快选
        </button>
      </div>

      <!-- AI 生成模式 -->
      <div v-if="planSource === 'ai'">
        <textarea :value="userGoal" @input="e => $emit('update:user-goal', e.target.value)" rows="2"
          placeholder="例：把评论翻译成英文，并打上情感标签"
          class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500 resize-none"></textarea>
        <button @click="$emit('generate')" :disabled="isGeneratingPlan"
          class="mt-2 w-full py-2 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-100 disabled:opacity-50 flex items-center justify-center gap-1">
          <Sparkles class="w-3.5 h-3.5" /> {{ isGeneratingPlan ? 'AI 生成中...' : 'AI 根据数据生成方案' }}
        </button>
      </div>

      <!-- 模板快选模式 -->
      <div v-if="planSource === 'template'">
        <div class="grid grid-cols-2 gap-2">
          <button v-for="tpl in PRESET_TEMPLATES" :key="tpl.id" @click="$emit('apply-template', tpl.id)"
            :class="['p-2.5 rounded-lg border-2 text-left transition-all',
              labelingPlan.outputColumns.length && labelingPlan.taskName === tpl.label
                ? 'border-violet-500 bg-violet-50/50'
                : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30']">
            <component :is="templateIcon(tpl.icon)" class="w-3.5 h-3.5 mb-1" :class="templateColor(tpl.color)" />
            <p class="text-xs font-bold text-slate-700">{{ tpl.label }}</p>
          </button>
        </div>
      </div>
    </section>

    <!-- 当前方案预览 -->
    <section v-if="labelingPlan.outputColumns.length" :class="CARD.base + ' ' + CARD.body">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] font-bold text-slate-500">当前方案</span>
        <span class="text-[10px] text-violet-600">{{ labelingPlan.outputColumns.length }} 个输出列</span>
      </div>
      <div class="mb-2">
        <span class="text-[10px] text-slate-500 mr-1">参考列：</span>
        <span v-for="idx in activeInputColumns" :key="idx"
          class="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] bg-blue-50 border border-blue-200 text-blue-700">
          {{ headers[idx] }}
        </span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <span v-for="col in labelingPlan.outputColumns" :key="col.key"
          class="px-2 py-1 rounded-md text-[10px] bg-white border border-violet-200 text-slate-600">
          {{ col.name }} <span class="text-slate-400">({{ col.type }})</span>
        </span>
      </div>
    </section>

    <!-- 进度 -->
    <div v-if="isLabeling" :class="CARD.base + ' ' + CARD.body">
      <div class="flex items-center justify-between text-xs mb-2">
        <span class="font-bold text-slate-700">打标中</span>
        <span class="text-slate-500">{{ processed }}/{{ totalToProcess }} ({{ percentFinished }}%)</span>
      </div>
      <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full bg-violet-500 transition-all" :style="{ width: percentFinished + '%' }"></div>
      </div>
    </div>

    <!-- 开始打标 -->
    <button @click="$emit('run')" :disabled="isLabeling || !labelingPlan.outputColumns.length"
      class="w-full py-2.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
      {{ isLabeling ? '处理中...' : '开始打标' }}
    </button>

    <!-- 结果统计 -->
    <div v-if="stats.done > 0" class="grid grid-cols-3 gap-2">
      <div :class="CARD.base + ' p-3 text-center'">
        <p class="text-lg font-bold text-emerald-600">{{ stats.done }}</p>
        <p class="text-[10px] text-slate-400">已分析</p>
      </div>
      <div :class="CARD.base + ' p-3 text-center'">
        <p class="text-lg font-bold text-rose-500">{{ stats.error }}</p>
        <p class="text-[10px] text-slate-400">错误</p>
      </div>
      <div :class="CARD.base + ' p-3 text-center'">
        <p class="text-lg font-bold text-slate-400">{{ Math.max(0, rows.length - stats.done - stats.error) }}</p>
        <p class="text-[10px] text-slate-400">待处理</p>
      </div>
    </div>

    <!-- 应用到全局 -->
    <button v-if="stats.done > 0" @click="$emit('apply')"
      class="w-full py-2.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-bold hover:bg-violet-100 flex items-center justify-center gap-1.5">
      <Save class="w-3.5 h-3.5" /> 💾 应用到全局
    </button>
  </div>
</template>

<script setup>
import { Sparkles, LayoutGrid, Save, Languages, Heart, Tag } from 'lucide-vue-next'
import { CARD } from '../../styles/tokens'
import { PRESET_TEMPLATES } from '../../services/prompts'

defineProps({
  planSource: { type: String, default: 'ai' },
  userGoal: { type: String, default: '' },
  isGeneratingPlan: { type: Boolean, default: false },
  labelingPlan: { type: Object, default: () => ({ outputColumns: [] }) },
  activeInputColumns: { type: Array, default: () => [] },
  headers: { type: Array, default: () => [] },
  isLabeling: { type: Boolean, default: false },
  processed: { type: Number, default: 0 },
  totalToProcess: { type: Number, default: 0 },
  percentFinished: { type: Number, default: 0 },
  stats: { type: Object, default: () => ({ done: 0, error: 0 }) },
  rows: { type: Array, default: () => [] }
})
defineEmits(['update:plan-source', 'update:user-goal', 'generate', 'apply-template', 'run', 'apply'])

const ICON_MAP = { Languages, Heart, Tag }
const COLOR_MAP = { blue: 'text-blue-500', rose: 'text-rose-500', green: 'text-emerald-500', violet: 'text-violet-500', amber: 'text-amber-500' }
function templateIcon(name) { return ICON_MAP[name] || Tag }
function templateColor(c) { return COLOR_MAP[c] || 'text-slate-500' }
</script>
