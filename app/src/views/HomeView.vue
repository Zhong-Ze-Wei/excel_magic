<template>
  <!-- ===== 移动端模板 ===== -->
  <div v-if="isMobile" class="px-4 py-4 space-y-4 pb-20 animate-fade-in">
    <!-- 标题 -->
    <div class="text-center space-y-1">
      <h1 class="text-xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
        <FileSpreadsheet class="w-6 h-6 text-emerald-600" /> 智能数据分析
      </h1>
      <p class="text-[11px] text-slate-500 leading-relaxed">
        上传 Excel 后数据在各模块间实时联动，无需重复上传。
      </p>
    </div>

    <!-- 第一层：数据状态（上传 或 已就绪简洁条） -->
    <div v-if="!dataShare.hasData" class="space-y-3">
      <FileUploader label="点击上传 Excel/CSV" :icon="UploadCloud" iconBg="bg-emerald-50" iconColor="text-emerald-600" @file="handleGlobalFile" />
      <button @click="loadGlobalDemo"
        class="w-full py-2.5 bg-white border border-emerald-200 text-emerald-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:bg-emerald-50">
        <RefreshCw class="w-3.5 h-3.5" /> 加载演示数据
      </button>
    </div>
    <DataStatusCompact v-else
      :source-name="dataShare.sourceName"
      :row-count="dataShare.rows.length"
      :col-count="dataShare.headers.length"
      :has-multiple-sheets="dataShare.hasMultipleSheets"
      :sheet-names="dataShare.sheetNames"
      :current-sheet="dataShare.currentSheet"
      @clear="clearGlobalExcel"
      @set-sheet="v => dataShare.setSheet(v)"
    />

    <!-- 第二层：任务方案卡（焦点） -->
    <PipelinePlanCard v-if="dataShare.hasData && intent.confirmedAt"
      :goal="intent.note"
      :steps="planSteps"
      @edit="reopenIntent"
      @start="onStartFirst"
      @step="onStepClick"
    />

    <!-- 未设置意图时的引导卡 -->
    <div v-else-if="dataShare.hasData" class="bg-white rounded-xl border-2 border-dashed border-blue-200 p-5 text-center">
      <Target class="w-8 h-8 text-blue-400 mx-auto mb-2" />
      <p class="text-xs text-slate-600 mb-3">数据已就绪，下一步设置你的分析目标</p>
      <button @click="reopenIntent"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold active:bg-blue-700">
        设置任务目标
      </button>
    </div>

    <!-- 第三层：单独使用（轻链接） -->
    <div v-if="dataShare.hasData" class="pt-2">
      <p class="text-[10px] text-slate-400 mb-2">或单独使用：</p>
      <div class="flex flex-wrap gap-2">
        <button v-for="card in cards" :key="card.route" @click="$router.push(card.route)"
          class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 active:bg-slate-50 flex items-center gap-1">
          <component :is="card.icon" class="w-3.5 h-3.5" :class="card.iconColor" />
          {{ card.title }}
        </button>
      </div>
    </div>
  </div>

  <!-- ===== 桌面端模板 ===== -->
  <div v-else class="animate-fade-in max-w-5xl mx-auto space-y-6 pb-10">
    <!-- 标题 -->
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
        <FileSpreadsheet class="w-8 h-8 text-emerald-600" /> 智能数据分析主入口
      </h1>
      <p class="text-xs text-slate-500 max-w-2xl mx-auto leading-relaxed">
        加载全局工作表后，AI 会自动理解你的任务目标，并规划清洗 → 加工 → 摘要的完整方案。
      </p>
    </div>

    <!-- 第一层：数据状态 -->
    <div v-if="!dataShare.hasData" class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <FileUploader
        label="点击或拖拽上传全局 Excel/CSV 数据工作表"
        :icon="UploadCloud" iconBg="bg-emerald-50" iconColor="text-emerald-600"
        @file="handleGlobalFile"
      />
      <div class="flex justify-center pt-4">
        <button @click="loadGlobalDemo"
          class="px-5 py-2.5 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 hover:shadow-md transform active:scale-95 duration-200">
          <RefreshCw class="w-3.5 h-3.5" /> 快速加载全局演示示例数据
        </button>
      </div>
    </div>

    <DataStatusCompact v-else
      :source-name="dataShare.sourceName"
      :row-count="dataShare.rows.length"
      :col-count="dataShare.headers.length"
      :has-multiple-sheets="dataShare.hasMultipleSheets"
      :sheet-names="dataShare.sheetNames"
      :current-sheet="dataShare.currentSheet"
      @clear="clearGlobalExcel"
      @set-sheet="v => dataShare.setSheet(v)"
    />

    <!-- 第二层：任务方案卡（视觉焦点） -->
    <PipelinePlanCard v-if="dataShare.hasData && intent.confirmedAt"
      :goal="intent.note"
      :steps="planSteps"
      @edit="reopenIntent"
      @start="onStartFirst"
      @step="onStepClick"
    />

    <!-- 未设置意图时的引导卡 -->
    <div v-else-if="dataShare.hasData" class="bg-white rounded-2xl border-2 border-dashed border-blue-200 p-8 text-center">
      <Target class="w-12 h-12 text-blue-400 mx-auto mb-3" />
      <p class="text-sm text-slate-600 mb-4">数据已就绪，下一步设置你的分析目标</p>
      <button @click="reopenIntent"
        class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors">
        设置任务目标
      </button>
    </div>

    <!-- 第三层：单独使用（轻链接，不抢焦点） -->
    <div v-if="dataShare.hasData" class="flex items-center gap-3 justify-center pt-2">
      <span class="text-xs text-slate-400">或单独使用：</span>
      <button v-for="card in cards" :key="card.route" @click="$router.push(card.route)"
        class="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1">
        <component :is="card.icon" class="w-3.5 h-3.5" :class="card.iconColor" />
        {{ card.title }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Wand2, FileBarChart, Eraser, UploadCloud, X, FileSpreadsheet, RefreshCw, Target, BarChart3 } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import { useImportIntentStore } from '../stores/importIntent'
import { useDevice } from '../composables/useDevice'
import { useFileUpload } from '../composables/useFileUpload'
import FileUploader from '../components/common/FileUploader.vue'
import PipelinePlanCard from '../components/common/PipelinePlanCard.vue'
import DataStatusCompact from '../components/common/DataStatusCompact.vue'
import { useToast } from '../services/toast'

const { isMobile } = useDevice()
const router = useRouter()
const toast = useToast()
const dataShare = useDataShareStore()
const intent = useImportIntentStore()

const { handleFile: handleGlobalFile } = useFileUpload()

// 把 pipelinePlan + tasks 转成方案卡需要的 steps 结构（含可行性标注）
const planSteps = computed(() => {
  const steps = {}
  const plan = intent.pipelinePlan
  const tasks = intent.tasks

  if (tasks.clean) {
    const summary = plan?.clean
      ? `清洗列：${dataShare.headers[plan.clean.sourceCol] ?? '主列'}`
      : 'AI 规划中…'
    steps.clean = { summary, feasible: 'yes' }
  }
  if (tasks.process || tasks.translate || tasks.analyze) {
    const summary = plan?.process
      ? `新增：${plan.process.outputColumns.map(c => c.name).join(' + ')}`
      : 'AI 规划中…'
    steps.process = { summary, feasible: 'yes' }
  }
  if (tasks.summary) {
    const summary = plan?.summary?.theme || 'AI 规划中…'
    steps.summary = { summary, feasible: 'yes' }
  }
  if (tasks.aggregate) {
    const summary = plan?.aggregate
      ? `${dataShare.headers[plan.aggregate.groupColIdx] ?? '分组'} → ${dataShare.headers[plan.aggregate.valueColIdx] ?? '值'}（${(plan.aggregate.op || 'sum').toUpperCase()}）`
      : 'AI 规划中…'
    steps.aggregate = { summary, feasible: 'yes' }
  }
  return steps
})

// 点击「按方案开始」：跳到第一个启用的任务
function onStartFirst() {
  const t = intent.tasks
  if (t.clean) return router.push('/cleaning')
  if (t.process || t.translate || t.analyze) return router.push('/process')
  if (t.summary) return router.push('/summary')
  if (t.aggregate) return router.push('/aggregate')
  toast.warn('请先选择至少一个任务')
}

// 点击某个步骤卡：直接跳对应模块
function onStepClick(key) {
  const routeMap = { clean: '/cleaning', process: '/process', summary: '/summary', aggregate: '/aggregate' }
  const route = routeMap[key]
  if (route) router.push(route)
}

function reopenIntent() {
  intent.open({
    name: dataShare.sourceName,
    rowCount: dataShare.rows.length,
    colCount: dataShare.headers.length,
    headers: [...dataShare.headers]
  })
}

function loadGlobalDemo() {
  const demoHeaders = ['序号', '用户ID', '评论内容']
  const demoRows = [
    ['1', 'User_001', '商品收到，质量非常好，非常喜欢！'],
    ['2', 'User_002', '[赞][赞][赞][赞][赞][赞][赞][赞][赞][赞]  [赞][赞][赞][赞][赞][赞][赞][赞][赞][赞]'],
    ['3', 'User_003', '    '],
    ['4', 'User_004', 'http://t.cn/abcde'],
    ['5', 'User_005', '666'],
    ['6', 'User_006', '加微信领取优惠大礼包，微信号 abc123456'],
    ['7', 'User_007', '#年中大促# #新机首发# 非常期待这款手机的性能！'],
    ['8', 'User_008', '商品收到，质量非常好，非常喜欢！'],
    ['9', 'User_009', '商品收到，质量非常好，非常喜欢！'],
    ['10', 'User_010', '商品收到，质量非常好，非常喜欢！'],
    ['11', 'User_011', 'ä½ å¥½å•Šæ•°æ ®æ¸…æ´—ä¹±ç  '],
    ['12', 'User_012', '东西还不错，物流也挺快的，包装完整。'],
    ['13', 'User_013', '[打call]'],
    ['14', 'User_014', '求'],
    ['15', 'User_015', '-'],
    ['16', 'User_016', '感觉一般，没有想象中好用，退货了。']
  ]
  dataShare.setSharedData(demoHeaders, demoRows, '社媒评论脏数据全局示例.csv', false)
  intent.open({
    name: '社媒评论脏数据全局示例.csv',
    rowCount: demoRows.length,
    colCount: demoHeaders.length,
    headers: [...demoHeaders]
  })
  toast.success('成功加载全局演示示例数据！请在弹窗中选择核心列与任务。')
}

function clearGlobalExcel() {
  dataShare.clearSharedData()
}

const cards = [
  { route: '/cleaning', title: '数据清洗', icon: Eraser, iconColor: 'text-orange-600' },
  { route: '/process', title: '智能加工', icon: Wand2, iconColor: 'text-violet-600' },
  { route: '/aggregate', title: '分组对比', icon: BarChart3, iconColor: 'text-blue-600' },
  { route: '/summary', title: '数据摘要', icon: FileBarChart, iconColor: 'text-emerald-600' }
]
</script>
