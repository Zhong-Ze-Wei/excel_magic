<template>
  <div class="animate-fade-in max-w-4xl mx-auto space-y-6">
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4">
        <FunctionSquare class="w-4 h-4 text-pink-500" /> 智能公式生成
      </h3>
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">描述需求</label>
          <textarea v-model="inputText" rows="3"
            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-pink-500 transition-all placeholder-slate-400"
            placeholder="例如：计算A列和B列的和，如果大于100则显示'达标'，否则显示'未达标'"></textarea>
        </div>
        <button @click="generate" :disabled="isLoading || !inputText"
          class="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-bold shadow-md shadow-pink-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          <Sparkles class="w-4 h-4 text-yellow-300" /> {{ isLoading ? '生成中...' : '生成公式' }}
        </button>
      </div>
    </div>

    <!-- Result -->
    <div v-if="formulaResult" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden animate-fade-in">
      <div class="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
      <div class="mb-3">
        <span class="text-xs font-bold text-pink-600 bg-pink-50 px-2 py-1 rounded-md">生成结果</span>
      </div>
      <div class="bg-slate-800 rounded-lg p-4 mb-3 group relative">
        <code class="text-green-400 font-mono text-sm break-all">{{ formulaResult.formula }}</code>
        <button @click="copy(formulaResult.formula)"
          class="absolute right-2 top-2 p-1.5 bg-white/10 hover:bg-white/20 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <Copy class="w-3 h-3" />
        </button>
      </div>
      <p class="text-xs text-slate-500">{{ formulaResult.explanation }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { FunctionSquare, Sparkles, Copy } from 'lucide-vue-next'
import { callAI } from '../services/ai'
import { getFormulaPrompt } from '../services/prompts'
import { useSettingsStore } from '../stores/settings'

const inputText = ref('')
const isLoading = ref(false)
const formulaResult = ref(null)

function copy(text) { navigator.clipboard.writeText(text) }

async function generate() {
  if (isLoading.value || !inputText.value.trim()) return
  isLoading.value = true
  formulaResult.value = null

  const settings = useSettingsStore()
  const config = settings.getApiConfig()

  try {
    const result = await callAI(inputText.value, getFormulaPrompt(), config.workModel)
    formulaResult.value = JSON.parse(result)
  } catch (e) {
    formulaResult.value = { formula: '[Error]', explanation: e.message }
  }
  isLoading.value = false
}
</script>
