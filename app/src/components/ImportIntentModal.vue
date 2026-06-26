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
      <div class="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
        <p v-if="intent.pendingFileMeta" class="text-xs text-slate-500">
          {{ intent.pendingFileMeta.name }} · {{ intent.pendingFileMeta.rowCount }} 行 · {{ intent.pendingFileMeta.colCount }} 列
        </p>

        <!-- 核心列选择 -->
        <section>
          <h4 class="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
            <span class="w-1 h-3.5 bg-blue-500 rounded-full"></span>
            核心处理列 <span class="text-red-500">*</span>
          </h4>
          <select v-model.number="form.coreColumnIdx"
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500">
            <option v-for="(h, i) in intent.pendingFileMeta?.headers || []" :key="i" :value="i">{{ h }}</option>
          </select>
          <p class="text-[10px] text-slate-400 mt-1">数据清洗、翻译、分析默认作用的列</p>
        </section>

        <!-- 任务卡片选择 -->
        <section>
          <h4 class="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
            <span class="w-1 h-3.5 bg-blue-500 rounded-full"></span>
            打算做什么
          </h4>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="t in taskOptions" :key="t.key" type="button"
              @click="form.tasks[t.key] = !form.tasks[t.key]"
              :class="[
                'relative flex flex-col items-center text-center p-3 rounded-xl border-2 transition-all',
                form.tasks[t.key]
                  ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              ]">
              <!-- 勾选角标 -->
              <span v-if="form.tasks[t.key]"
                class="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <Check class="w-2.5 h-2.5 text-white" />
              </span>
              <!-- 图标 -->
              <span :class="[
                'flex items-center justify-center w-9 h-9 rounded-lg mb-1.5 transition-colors',
                form.tasks[t.key] ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
              ]">
                <component :is="t.icon" class="w-4.5 h-4.5" />
              </span>
              <span class="text-xs font-bold text-slate-700">{{ t.label }}</span>
              <span class="text-[10px] text-slate-400 leading-tight mt-0.5">{{ t.desc }}</span>
            </button>
          </div>
        </section>

        <!-- 任务说明 -->
        <section>
          <h4 class="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
            <span class="w-1 h-3.5 bg-blue-500 rounded-full"></span>
            任务说明（可选）
          </h4>
          <textarea v-model="form.note" rows="3"
            placeholder="例：清洗掉无意义评论，翻译剩余内容为中文"
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 resize-none"></textarea>
          <p class="text-[10px] text-slate-400 mt-1">作为 AI 模块的上下文（最多 500 字）</p>
        </section>
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
import { X, Check, Sparkles, Repeat, AlignJustify } from 'lucide-vue-next'
import { useImportIntentStore } from '../stores/importIntent'
import { useDataShareStore } from '../stores/dataShare'
import { useToast } from '../services/toast'

const intent = useImportIntentStore()
const dataShare = useDataShareStore()
const toast = useToast()

// 三个任务卡片：图标 + 标题 + 一句话描述
const taskOptions = [
  { key: 'clean',   label: '清洗',     desc: '去噪去重',     icon: Sparkles },
  { key: 'process', label: '智能加工', desc: '翻译+打标',    icon: Repeat },
  { key: 'summary', label: '摘要',     desc: '一键洞察',     icon: AlignJustify }
]

const form = reactive({
  coreColumnIdx: null,
  // 默认三项全勾：首次导入引导用户探索核心能力
  tasks: { clean: true, process: true, summary: true },
  note: ''
})

watch(() => intent.showModal, (v) => {
  if (v) {
    form.coreColumnIdx = intent.coreColumnIdx ?? dataShare.coreColumn ?? 0
    // 兼容旧意图：translate/analyze 字段存在则合并到 process
    const oldHasTranslateOrAnalyze = intent.tasks.translate || intent.tasks.analyze
    // confirmedAt 存在说明用户保存过意图 → 读已保存值；首次打开 → 三项默认全勾
    const hasSaved = !!intent.confirmedAt
    form.tasks = {
      clean:   hasSaved ? !!intent.tasks.clean   : true,
      process: hasSaved ? !!(intent.tasks.process || oldHasTranslateOrAnalyze) : true,
      summary: hasSaved ? !!intent.tasks.summary : true
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
