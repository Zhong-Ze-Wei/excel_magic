import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useImportIntentStore = defineStore('importIntent', () => {
  const coreColumnIdx = ref(null)
  const tasks = ref({ clean: false, process: false, summary: false, aggregate: false })
  // 任务目标（合并了原 note 语义）：用户想用这份数据做什么。AI 候选填入它，用户可编辑。
  // 下游（清洗/加工/摘要）通过 dataShare.intentNote 消费，字段名保留 note 以兼容。
  const note = ref('')
  // AI 生成的候选方案缓存：避免每次打开弹窗都重跑 AI。null=未生成过，[]=已生成但无候选
  const suggestions = ref(null)
  // AI 预规划的三步方案缓存：{ clean, process, summary }，每段 null=未规划/失败
  const pipelinePlan = ref(null)
  const confirmedAt = ref(null)
  const showModal = ref(false)
  const pendingFileMeta = ref(null)

  function open(meta) {
    pendingFileMeta.value = meta
    showModal.value = true
  }

  function close() {
    showModal.value = false
    pendingFileMeta.value = null
  }

  function submit({ coreColumnIdx: idx, tasks: t, note: n, suggestions: sg, pipelinePlan: pp }) {
    coreColumnIdx.value = idx
    tasks.value = { ...t }
    note.value = n
    // 缓存候选方案，下次打开不重跑（除非用户主动换一批）
    if (sg !== undefined) suggestions.value = sg
    // 缓存三步预演方案，各模块进入时消费
    if (pp !== undefined) pipelinePlan.value = pp
    confirmedAt.value = Date.now()
    showModal.value = false
    pendingFileMeta.value = null
  }

  // 新文件上传时清空旧意图 + 旧候选 + 旧方案（让弹窗重新跑 AI）
  function reset() {
    close()
    coreColumnIdx.value = null
    tasks.value = { clean: false, process: false, summary: false, aggregate: false }
    note.value = ''
    suggestions.value = null
    pipelinePlan.value = null
    confirmedAt.value = null
  }

  return {
    coreColumnIdx, tasks, note, suggestions, pipelinePlan, confirmedAt, showModal, pendingFileMeta,
    open, close, submit, reset
  }
})
