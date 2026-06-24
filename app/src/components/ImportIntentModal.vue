<template>
  <div v-if="intent.showModal"
    class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
    @click.self="intent.close()">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
        <h3 class="font-bold text-sm text-slate-800">数据集意图</h3>
        <button @click="intent.close()" class="text-slate-400 hover:text-slate-600">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
        <p v-if="intent.pendingFileMeta" class="text-xs text-slate-500">
          {{ intent.pendingFileMeta.name }} · {{ intent.pendingFileMeta.rowCount }} 行 · {{ intent.pendingFileMeta.colCount }} 列
        </p>

        <!-- 核心列选择 -->
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1">
            核心处理列 <span class="text-red-500">*</span>
          </label>
          <select v-model.number="form.coreColumnIdx"
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500">
            <option v-for="(h, i) in intent.pendingFileMeta?.headers || []" :key="i" :value="i">{{ h }}</option>
          </select>
          <p class="text-[10px] text-slate-400 mt-1">数据清洗、翻译、分析默认作用的列</p>
        </div>

        <!-- 任务多选 -->
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1">打算做什么</label>
          <div class="flex flex-wrap gap-3">
            <label v-for="t in taskOptions" :key="t.key"
              class="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" v-model="form.tasks[t.key]"
                class="rounded text-blue-600 focus:ring-blue-500" />
              {{ t.label }}
            </label>
          </div>
        </div>

        <!-- 任务说明 -->
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1">任务说明（可选）</label>
          <textarea v-model="form.note" rows="3"
            placeholder="例：清洗掉无意义评论，翻译剩余内容为中文"
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 resize-none"></textarea>
          <p class="text-[10px] text-slate-400 mt-1">作为 AI 模块的上下文（最多 500 字）</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
        <button @click="intent.close()"
          class="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md">
          取消
        </button>
        <button @click="onSubmit" :disabled="form.coreColumnIdx == null"
          class="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
          <Check class="w-3.5 h-3.5" /> 确认
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { X, Check } from 'lucide-vue-next'
import { useImportIntentStore } from '../stores/importIntent'
import { useDataShareStore } from '../stores/dataShare'
import { useToast } from '../services/toast'

const intent = useImportIntentStore()
const dataShare = useDataShareStore()
const toast = useToast()

const taskOptions = [
  { key: 'clean', label: '清洗' },
  { key: 'process', label: '智能加工' },
  { key: 'summary', label: '摘要' }
]

const form = reactive({
  coreColumnIdx: null,
  tasks: { clean: false, process: false, summary: false },
  note: ''
})

watch(() => intent.showModal, (v) => {
  if (v) {
    form.coreColumnIdx = intent.coreColumnIdx ?? dataShare.coreColumn ?? 0
    // 兼容旧意图：translate/analyze 字段存在则合并到 process
    const oldHasTranslateOrAnalyze = intent.tasks.translate || intent.tasks.analyze
    form.tasks = {
      clean: !!intent.tasks.clean,
      process: !!(intent.tasks.process || oldHasTranslateOrAnalyze),
      summary: !!intent.tasks.summary
    }
    form.note = intent.note
  }
})

function onSubmit() {
  if (form.coreColumnIdx == null) return
  const trimmedNote = form.note.slice(0, 500)
  intent.submit({
    coreColumnIdx: form.coreColumnIdx,
    tasks: { ...form.tasks },
    note: trimmedNote
  })
  if (form.coreColumnIdx !== dataShare.coreColumn) {
    dataShare.setCoreColumn(form.coreColumnIdx)
  }
  const count = Object.values(form.tasks).filter(Boolean).length
  toast.success(`意图已保存：${count} 项任务`)
}
</script>
