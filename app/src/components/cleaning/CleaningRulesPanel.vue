<template>
  <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 animate-fade-in">
    <input type="file" ref="configFileRef" accept=".json" class="hidden" @change="$emit('importConfig', $event)" />

    <div class="flex justify-between items-center pb-2 border-b border-slate-100">
      <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
        <Settings2 class="w-4.5 h-4.5 text-slate-500" /> 清洗配置面板
      </h3>
      <div class="flex items-center gap-1.5 text-[11px]">
        <button @click="configFileRef?.click()" class="text-emerald-600 hover:underline">导入</button>
        <span class="text-slate-300">|</span>
        <button @click="$emit('exportConfig')" class="text-blue-600 hover:underline">导出</button>
        <span class="text-slate-300">|</span>
        <button @click="$emit('reset')" class="text-red-500 hover:underline">重置</button>
      </div>
    </div>

    <!-- Target Column Selector -->
    <div class="space-y-1.5">
      <label class="block text-xs font-bold text-slate-600">清洗目标列 (需清洗的文本列)</label>
      <select v-if="headers.length > 0" :value="dataShare.coreColumn" @change="e => { dataShare.setCoreColumn(e.target.value); $emit('runPipeline'); }" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500">
        <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
      </select>
    </div>

    <!-- Weak Rules Policy Selector -->
    <div class="bg-slate-50/60 p-3 rounded-lg border border-slate-200/60 space-y-2">
      <label class="block text-xs font-bold text-slate-700">弱规则过滤策略</label>
      <div class="flex gap-4">
        <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="radio" v-model="rulesConfig.weakPolicy" value="mark" @change="$emit('runPipeline')" class="text-orange-600 focus:ring-orange-500">
          标记为待确认 🟡
        </label>
        <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="radio" v-model="rulesConfig.weakPolicy" value="delete" @change="$emit('runPipeline')" class="text-orange-600 focus:ring-orange-500">
          直接强删 🔴
        </label>
      </div>
      <p class="text-[9px] text-slate-400 leading-normal">
        * 弱规则包括：疑似广告引流、疑似乱码。默认建议标记为待确认，防止正常短句误伤。
      </p>
    </div>

    <!-- Atomic Rules Switch List -->
    <div class="space-y-2">
      <div class="flex justify-between items-center">
        <span class="text-xs font-bold text-slate-700">原子清洗规则开关</span>
        <span class="text-[10px] text-slate-400">已启用 {{ enabledRulesCount }}/9</span>
      </div>

      <div class="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
          <div>
            <div class="font-bold text-slate-700">文本标准化 (normalize)</div>
            <div class="text-[10px] text-slate-400">去除控制字符、压缩多余空白、统一去首尾空格</div>
          </div>
          <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">默认开启</span>
        </div>

        <div v-for="rule in rulesMeta" :key="rule.key"
          class="border border-slate-200 rounded-lg p-2.5 bg-white space-y-2 transition-all"
          :class="{ 'border-orange-200 bg-orange-50/10': rulesConfig[rule.key].enable }">

          <div class="flex justify-between items-start">
            <label class="flex items-center gap-2 cursor-pointer flex-1">
              <input type="checkbox" v-model="rulesConfig[rule.key].enable" @change="$emit('runPipeline')" class="rounded text-orange-600 focus:ring-orange-500" />
              <div>
                <span class="text-xs font-bold text-slate-700">{{ rule.title }}</span>
                <span class="ml-1.5 px-1 py-0.5 rounded text-[8px] font-bold"
                  :class="rule.isWeak ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'">
                  {{ rule.isWeak ? '弱规则' : '强删规则' }}
                </span>
              </div>
            </label>
            <button @click="$emit('toggleRuleExpand', rule.key)" class="text-slate-400 hover:text-slate-600">
              <ChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': expandedRules[rule.key] }" />
            </button>
          </div>

          <p class="text-[10px] text-slate-400 pl-6 leading-tight">{{ rule.description }}</p>

          <div v-show="expandedRules[rule.key]" class="pl-6 pt-2 border-t border-slate-100 space-y-2 animate-fade-in">
            <div v-if="rule.key === 'tooShort'" class="space-y-1">
              <span class="text-[10px] text-slate-500 font-medium">字数过滤长度阈值 (有效字符少于此值则删除):</span>
              <input type="number" v-model.number="rulesConfig.tooShort.minLength" min="1" @input="$emit('runPipeline')"
                class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none" />
            </div>
            <div v-if="rule.key === 'duplicate'" class="space-y-1">
              <span class="text-[10px] text-slate-500 font-medium">触发去重的重复次数阈值:</span>
              <input type="number" v-model.number="rulesConfig.duplicate.minCount" min="2" @input="$emit('runPipeline')"
                class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none" />
            </div>
            <div v-if="rule.key === 'topicOnly'" class="space-y-1">
              <span class="text-[10px] text-slate-500 font-medium">纯话题标签字符占比阈值 (0-1):</span>
              <input type="number" step="0.1" v-model.number="rulesConfig.topicOnly.ratioThreshold" min="0.1" max="1.0" @input="$emit('runPipeline')"
                class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none" />
            </div>
            <div v-if="rule.key === 'shortMeaningless'" class="space-y-1">
              <span class="text-[10px] text-slate-500 font-medium">无意义短词库 (逗号隔开):</span>
              <textarea v-model="rulesConfig.shortMeaningless.phrasesStr" rows="2" @input="$emit('handlePhrasesInput')"
                class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none resize-none font-mono"></textarea>
            </div>
            <div v-if="rule.key === 'adLink'" class="space-y-1">
              <span class="text-[10px] text-slate-500 font-medium">广告引流敏感词 (逗号隔开):</span>
              <textarea v-model="rulesConfig.adLink.keywordsStr" rows="2" @input="$emit('handleKeywordsInput')"
                class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none resize-none font-mono"></textarea>
            </div>
            <div v-if="rule.key === 'garbledText'" class="space-y-1">
              <span class="text-[10px] text-slate-500 font-medium">判定乱码的杂乱字符比率 (0-1):</span>
              <input type="number" step="0.05" v-model.number="rulesConfig.garbledText.threshold" min="0.1" max="1.0" @input="$emit('runPipeline')"
                class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义筛选规则 -->
    <div class="space-y-2 pt-3 border-t border-slate-200">
      <div class="flex justify-between items-center">
        <span class="text-xs font-bold text-slate-700">自定义筛选规则</span>
        <span class="text-[10px] text-slate-400">已启用 {{ customFiltersCount }} 条</span>
      </div>

      <div class="bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200 rounded-lg p-2.5 space-y-2">
        <div class="flex items-center gap-1.5">
          <Sparkles class="w-3.5 h-3.5 text-violet-500" />
          <span class="text-[10px] font-bold text-violet-700">AI 智能筛选</span>
        </div>
        <div class="flex gap-1.5">
          <input :value="smartFilterInput" @input="$emit('update:smartFilterInput', $event.target.value)" type="text"
            placeholder="描述筛选意图，如：过滤掉负面评论"
            class="flex-1 px-2 py-1.5 text-[10px] border border-violet-200 rounded-lg focus:border-violet-400 outline-none bg-white"
            @keydown.enter="$emit('generateSmartFilter')" />
          <button @click="$emit('generateSmartFilter')" :disabled="isGeneratingFilter"
            class="px-2.5 py-1.5 bg-violet-600 text-white rounded-lg text-[10px] font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1 shrink-0">
            <Sparkles class="w-3 h-3" :class="{ 'animate-spin': isGeneratingFilter }" />
            {{ isGeneratingFilter ? '生成中' : '生成' }}
          </button>
        </div>
      </div>

      <div class="max-h-[180px] overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
        <div v-for="filter in (settings.rulesConfig.customFilters || [])" :key="filter.id"
          class="border rounded-lg p-2 transition-all"
          :class="filter.enabled ? 'border-orange-200 bg-orange-50/10' : 'border-slate-200 bg-white opacity-60'">
          <div class="flex justify-between items-center">
            <label class="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0">
              <input type="checkbox" v-model="filter.enabled" @change="$emit('runPipeline')"
                class="rounded text-orange-600 focus:ring-orange-500 shrink-0" />
              <span class="text-[10px] font-bold text-slate-700 truncate">{{ filter.name }}</span>
            </label>
            <div class="flex items-center gap-1 shrink-0">
              <span class="text-[9px] px-1 py-0.5 rounded"
                :class="filter.policy === 'delete' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'">
                {{ filter.policy === 'delete' ? '删除' : '待确认' }}
              </span>
              <button @click="$emit('editCustomFilter', filter)" class="text-slate-400 hover:text-violet-500">
                <Pencil class="w-3 h-3" />
              </button>
              <button @click="$emit('removeCustomFilter', filter.id)" class="text-slate-400 hover:text-rose-500">
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>
          <p class="text-[9px] text-slate-400 pl-5 leading-tight mt-0.5 truncate">{{ describeFilter(filter) }}</p>
        </div>

        <div v-if="!(settings.rulesConfig.customFilters || []).length" class="text-[10px] text-slate-400 text-center py-2 italic">
          暂无自定义规则，可通过 AI 生成或手动添加
        </div>
      </div>

      <button @click="$emit('showAddFilterForm')"
        class="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-[10px] text-slate-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/30 transition-all flex items-center justify-center gap-1">
        <Plus class="w-3 h-3" /> 手动添加规则
      </button>
    </div>
  </div>
</template>

<script setup>
import { Settings2, ChevronDown, Sparkles, Plus, Pencil, X } from 'lucide-vue-next'
import { useDataShareStore } from '../../stores/dataShare'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps({
  headers: { type: Array, required: true },
  rulesMeta: { type: Array, required: true },
  expandedRules: { type: Object, required: true },
  enabledRulesCount: { type: Number, required: true },
  customFiltersCount: { type: Number, required: true },
  smartFilterInput: { type: String, default: '' },
  isGeneratingFilter: { type: Boolean, default: false },
  describeFilter: { type: Function, required: true }
})

defineEmits([
  'runPipeline', 'toggleRuleExpand', 'handlePhrasesInput', 'handleKeywordsInput',
  'generateSmartFilter', 'editCustomFilter', 'removeCustomFilter',
  'importConfig', 'exportConfig', 'reset', 'showAddFilterForm',
  'update:smartFilterInput'
])

const dataShare = useDataShareStore()
const settings = useSettingsStore()
const rulesConfig = settings.rulesConfig
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>
