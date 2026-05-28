<template>
  <div class="animate-fade-in max-w-5xl mx-auto space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
      <!-- Input -->
      <div class="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <label class="text-xs font-bold text-slate-700 uppercase tracking-wider">原文</label>
          <button @click="inputText = ''" class="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
            <Trash2 class="w-3 h-3" /> 清空
          </button>
        </div>
        <textarea v-model="inputText" class="flex-1 w-full p-4 outline-none resize-none text-sm leading-relaxed text-slate-700 placeholder-slate-300"
          placeholder="在此输入或粘贴需要翻译的文本..."></textarea>
      </div>

      <!-- Output -->
      <div class="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
        <div class="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <label class="text-xs font-bold text-slate-700 uppercase tracking-wider">译文</label>
          <button v-if="outputText" @click="copy(outputText)" class="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            <Copy class="w-3 h-3" /> 复制
          </button>
        </div>
        <textarea v-model="outputText" readonly
          class="flex-1 w-full p-4 bg-slate-50/30 outline-none resize-none text-sm leading-relaxed text-slate-700"
          placeholder="等待翻译..."></textarea>

        <!-- Loading -->
        <div v-if="isLoading" class="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div class="flex flex-col items-center gap-3">
            <Loader2 class="w-8 h-8 text-blue-600 animate-spin" />
            <span class="text-xs text-blue-600 font-medium">正在翻译中...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Action -->
    <div class="flex justify-center">
      <button @click="translate" :disabled="isLoading || !inputText"
        class="px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-full font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
        <Sparkles class="w-4 h-4 text-yellow-400" /> 立即翻译
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Trash2, Copy, Loader2, Sparkles } from 'lucide-vue-next'
import { callAI } from '../services/ai'
import { getTranslatePrompt } from '../services/prompts'

const inputText = ref('')
const outputText = ref('')
const isLoading = ref(false)

function copy(text) { navigator.clipboard.writeText(text) }

async function translate() {
  if (!inputText.value.trim() || isLoading.value) return
  isLoading.value = true
  outputText.value = ''
  try {
    const prompt = getTranslatePrompt('general', 'auto_to_zh')
    outputText.value = await callAI(inputText.value, prompt)
  } catch (e) {
    outputText.value = `[错误] ${e.message}`
  } finally {
    isLoading.value = false
  }
}
</script>
