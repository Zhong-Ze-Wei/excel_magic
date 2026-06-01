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

    <!-- 上传/数据状态 -->
    <div v-if="!dataShare.hasData" class="space-y-3">
      <FileUploader label="点击上传 Excel/CSV" :icon="UploadCloud" iconBg="bg-emerald-50" iconColor="text-emerald-600" @file="handleGlobalFile" />
      <button @click="loadGlobalDemo"
        class="w-full py-2.5 bg-white border border-emerald-200 text-emerald-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:bg-emerald-50">
        <RefreshCw class="w-3.5 h-3.5" /> 加载演示数据
      </button>
    </div>
    <div v-else class="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-xs font-bold text-emerald-800">全局工作表已就绪</span>
        </div>
        <button @click="clearGlobalExcel"
          class="px-2.5 py-1 text-xs text-slate-500 active:text-rose-600 active:bg-rose-50 rounded-lg">
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
      <div class="text-xs text-slate-600">
        <span class="font-bold">{{ dataShare.sourceName }}</span>
        <span class="ml-2 text-slate-400">{{ dataShare.rows.length }}行 × {{ dataShare.headers.length }}列</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[10px] text-emerald-800 font-bold">核心列:</span>
        <select :value="dataShare.coreColumn" @change="e => dataShare.setCoreColumn(e.target.value)"
          class="flex-1 min-w-0 px-2 py-1 bg-white border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold">
          <option v-for="(h, idx) in dataShare.headers" :key="idx" :value="idx">{{ h }}</option>
        </select>
      </div>
      <!-- Sheet 选择器（多 Sheet 时显示）-->
      <div v-if="dataShare.hasMultipleSheets" class="flex items-center gap-2 flex-wrap">
        <span class="text-[10px] text-emerald-800 font-bold">Sheet:</span>
        <select :value="dataShare.currentSheet" @change="e => dataShare.setSheet(e.target.value)"
          class="flex-1 min-w-0 px-2 py-1 bg-white border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold">
          <option v-for="name in dataShare.sheetNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
    </div>

    <!-- 移动端数据洞察 -->
    <MobileCollapsible v-if="dataShare.hasData && profiles.length" title="数据洞察" :default-open="true">
      <div v-if="isAnalyzing" class="flex items-center gap-2 text-[10px] text-violet-600 py-2">
        <Loader2 class="w-3.5 h-3.5 animate-spin" /> AI 分析中...
      </div>
      <div v-else class="space-y-2.5">
        <div class="flex flex-wrap gap-1">
          <span v-for="t in typeSummary" :key="t.label"
            class="px-1.5 py-0.5 text-[9px] font-bold rounded-full border" :class="t.color">
            {{ t.label }} ×{{ t.count }}
          </span>
        </div>
        <div class="text-[10px] text-slate-600">
          <span class="font-bold text-emerald-700">核心列</span> {{ coreReason }}
        </div>
        <div v-if="recommendations.length" class="space-y-1">
          <div v-for="rec in recommendations" :key="rec.route"
            @click="$router.push(rec.route)"
            class="flex items-center gap-1.5 px-2 py-1.5 bg-violet-50 rounded-lg border border-violet-200/60 active:bg-violet-100">
            <span class="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0"></span>
            <span class="text-[9px] font-bold text-violet-700">{{ cards.find(c => c.route === rec.route)?.title || rec.route }}</span>
            <span class="text-[8px] text-violet-500 truncate">{{ rec.reason }}</span>
          </div>
        </div>
      </div>
    </MobileCollapsible>

    <!-- 功能卡片 — 2×2 网格 -->
    <div class="grid grid-cols-2 gap-3">
      <div v-for="card in cards" :key="card.route" @click="$router.push(card.route)"
        class="bg-white rounded-xl p-3 border shadow-sm active:bg-slate-50 relative overflow-hidden"
        :class="recommendedRoutes.has(card.route) ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'">
        <span v-if="dataShare.hasData && card.supportGlobal"
          class="absolute top-1.5 right-1.5 bg-emerald-600 text-white text-[7px] font-bold px-1 py-0.5 rounded-full">
          就绪
        </span>
        <span v-if="recommendedRoutes.has(card.route)"
          class="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-full"
          :class="dataShare.hasData && card.supportGlobal ? 'right-[38px]' : ''">
          推荐
        </span>
        <div class="w-9 h-9 rounded-lg flex items-center justify-center mb-2" :class="card.iconBg">
          <component :is="card.icon" class="w-4.5 h-4.5" />
        </div>
        <h3 class="text-xs font-bold text-slate-800">{{ card.title }}</h3>
        <p class="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{{ card.desc }}</p>
      </div>
    </div>
  </div>

  <!-- ===== 桌面端模板（原样保留）===== -->
  <div v-else class="animate-fade-in max-w-6xl mx-auto space-y-8 pb-10">
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
        <FileSpreadsheet class="w-8 h-8 text-emerald-600" /> 智能数据分析主入口
      </h1>
      <p class="text-xs text-slate-500 max-w-2xl mx-auto leading-relaxed">
        加载全局工作表后，数据将在数据清洗、批量翻译、评论分析和数据摘要模块之间实时联动流转，无需重复上传。
      </p>
    </div>

    <!-- 全局 Excel 状态与上传卡片 -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div v-if="!dataShare.hasData" class="animate-fade-in space-y-4">
        <FileUploader 
          label="点击或拖拽上传全局 Excel/CSV 数据工作表 (开始一站式处理)" 
          :icon="UploadCloud" 
          iconBg="bg-emerald-50" 
          iconColor="text-emerald-600" 
          @file="handleGlobalFile" 
        />
        <div class="flex justify-center pt-1">
          <button @click="loadGlobalDemo" 
            class="px-5 py-2.5 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 hover:shadow-md transform active:scale-95 duration-200">
            <RefreshCw class="w-3.5 h-3.5" /> 快速加载全局演示示例数据
          </button>
        </div>
      </div>
      
      <!-- 已上传全局 Excel 状态展示 -->
      <div v-else class="bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-fade-in">
        <div class="space-y-3 flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span class="text-xs font-bold text-emerald-800 uppercase tracking-wider">当前关联全局活跃工作表</span>
          </div>
          
          <h2 class="text-lg font-black text-slate-800 flex items-center gap-2 truncate">
            <Database class="w-5 h-5 text-emerald-600 shrink-0" /> {{ dataShare.sourceName }}
          </h2>
          
          <!-- 表头与信息概要 -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600">
            <div class="flex items-center gap-1 shrink-0">
              <span>数据规格:</span>
              <span class="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{{ dataShare.rows.length }} 行 × {{ dataShare.headers.length }} 列</span>
            </div>
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="shrink-0">表头预览:</span>
              <div class="flex flex-wrap gap-1 overflow-hidden">
                <span v-for="(h, idx) in dataShare.headers.slice(0, 6)" :key="idx" 
                  class="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-medium truncate max-w-[100px]">
                  {{ h }}
                </span>
                <span v-if="dataShare.headers.length > 6" class="text-slate-400 text-[10px]">...</span>
              </div>
            </div>
          </div>

          <!-- 全局核心处理列选择 -->
          <div class="flex items-center gap-2 pt-1 flex-wrap">
            <span class="text-xs font-bold text-emerald-800 shrink-0">🎯 全局核心处理列 (分析目标列):</span>
            <select :value="dataShare.coreColumn" @change="e => dataShare.setCoreColumn(e.target.value)"
              class="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 max-w-[200px] cursor-pointer">
              <option v-for="(h, idx) in dataShare.headers" :key="idx" :value="idx">{{ h }}</option>
            </select>
            <span class="text-[10px] text-slate-400 font-normal">* 此列为数据清洗、批量翻译、数据分析的默认目标处理列，各模块共享此配置。</span>
          </div>

          <!-- Sheet 选择器（多 Sheet 时显示）-->
          <div v-if="dataShare.hasMultipleSheets" class="flex items-center gap-2 pt-1 flex-wrap">
            <span class="text-xs font-bold text-emerald-800 shrink-0">📊 工作表:</span>
            <select :value="dataShare.currentSheet" @change="e => dataShare.setSheet(e.target.value)"
              class="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500 max-w-[200px] cursor-pointer">
              <option v-for="name in dataShare.sheetNames" :key="name" :value="name">{{ name }}</option>
            </select>
          </div>
        </div>
        
        <button @click="clearGlobalExcel" 
          class="px-4 py-2 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 shrink-0">
          <X class="w-3.5 h-3.5" /> 卸载全局文件
        </button>
      </div>
    </div>

    <!-- 数据洞察卡片 -->
    <div v-if="dataShare.hasData && profiles.length" class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Lightbulb class="w-4 h-4 text-amber-500" /> 数据洞察
        </h3>
        <span v-if="isAnalyzing" class="flex items-center gap-1.5 text-xs text-violet-600 font-medium">
          <Loader2 class="w-3.5 h-3.5 animate-spin" /> AI 分析中...
        </span>
      </div>
      <div v-if="!isAnalyzing" class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <!-- 列类型分布 -->
        <div>
          <div class="text-[10px] font-bold text-slate-400 mb-2 uppercase">列类型分布</div>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="t in typeSummary" :key="t.label"
              class="px-2.5 py-1 text-[11px] font-bold rounded-full border" :class="t.color">
              {{ t.label }} ×{{ t.count }}
            </span>
          </div>
          <div v-if="profiles.length" class="mt-3 space-y-1">
            <div v-for="p in profiles.slice(0, 5)" :key="p.header" class="flex items-center gap-2 text-[10px]">
              <span class="font-bold text-slate-600 truncate max-w-[80px]" :title="p.header">{{ p.header }}</span>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold border"
                :class="(TYPE_COLORS[p.type] || 'bg-slate-50 text-slate-400 border-slate-100')">
                {{ TYPE_LABELS[p.type] || p.type }}
              </span>
              <span class="text-slate-400">{{ p.uniqueCount }} 唯一</span>
            </div>
            <div v-if="profiles.length > 5" class="text-[9px] text-slate-400">... 共 {{ profiles.length }} 列</div>
          </div>
        </div>
        <!-- 核心列 -->
        <div>
          <div class="text-[10px] font-bold text-slate-400 mb-2 uppercase">核心处理列</div>
          <div v-if="profiles[dataShare.coreColumn]" class="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div class="text-sm font-black text-emerald-800">{{ profiles[dataShare.coreColumn].header }}</div>
            <div class="text-[11px] text-emerald-600 mt-1">{{ coreReason }}</div>
            <div class="flex items-center gap-3 mt-2 text-[10px] text-emerald-700">
              <span v-if="profiles[dataShare.coreColumn].fillRate != null">填充率 {{ profiles[dataShare.coreColumn].fillRate }}%</span>
              <span v-if="profiles[dataShare.coreColumn].uniqueCount != null">{{ profiles[dataShare.coreColumn].uniqueCount }} 唯一值</span>
            </div>
          </div>
        </div>
        <!-- 建议操作 -->
        <div>
          <div class="text-[10px] font-bold text-slate-400 mb-2 uppercase">建议操作</div>
          <div class="space-y-2">
            <div v-for="rec in recommendations" :key="rec.route"
              @click="$router.push(rec.route)"
              class="flex items-start gap-2 p-2.5 bg-violet-50 border border-violet-200/60 rounded-lg cursor-pointer hover:bg-violet-100 transition-colors">
              <span class="w-2 h-2 rounded-full bg-violet-400 mt-1 shrink-0"></span>
              <div>
                <div class="text-[11px] font-bold text-violet-700">{{ cards.find(c => c.route === rec.route)?.title || rec.route }}</div>
                <div class="text-[10px] text-violet-500">{{ rec.reason }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 功能卡片列表 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="card in cards" :key="card.route" @click="$router.push(card.route)"
        class="group bg-white rounded-2xl p-6 border shadow-sm cursor-pointer card-hover relative overflow-hidden transition-all duration-300"
        :class="[
          recommendedRoutes.has(card.route) ? 'ring-2 ring-amber-300/50 border-amber-300' : 'border-slate-200',
          { 'border-emerald-500/20 bg-emerald-500/[0.01] hover:border-emerald-500/40 hover:shadow-md': dataShare.hasData && card.supportGlobal }
        ]">
        <div class="absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"
          :class="card.bgAccent"></div>

        <!-- 全局数据就绪角标 -->
        <span v-if="dataShare.hasData && card.supportGlobal"
          class="absolute top-3 right-3 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full z-20 flex items-center gap-1 shadow-sm">
          <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          全局数据就绪
        </span>
        <!-- 推荐角标 -->
        <span v-if="recommendedRoutes.has(card.route)"
          class="absolute top-3 z-20 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm"
          :class="dataShare.hasData && card.supportGlobal ? 'right-[100px]' : 'right-3'">
          推荐
        </span>

        <div class="relative z-10">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors"
            :class="[card.iconBg, `group-hover:${card.iconBgHover} group-hover:text-white`]">
            <component :is="card.icon" class="w-6 h-6" />
          </div>
          <h3 class="text-lg font-bold text-slate-800 mb-2 flex items-center gap-1.5">
            {{ card.title }}
          </h3>
          <p class="text-sm text-slate-500 mb-4 min-h-[40px]">{{ card.desc }}</p>
          <span class="text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform" :class="card.linkColor">
            立即使用 <ArrowRight class="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Languages, Brain, FileBarChart, Eraser, ArrowRight, UploadCloud, Database, X, FileSpreadsheet, RefreshCw, Lightbulb, Loader2 } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import { useDevice } from '../composables/useDevice'
import { useDataInsight } from '../composables/useDataInsight'
import FileUploader from '../components/common/FileUploader.vue'
import MobileCollapsible from '../components/common/MobileCollapsible.vue'
import { readFile } from '../services/excel'
import { useToast } from '../services/toast'

const { isMobile } = useDevice()

const toast = useToast()
const dataShare = useDataShareStore()
const isUploading = ref(false)

const { profiles, typeSummary, coreReason, recommendations, recommendedRoutes, isAnalyzing, TYPE_LABELS, TYPE_COLORS } = useDataInsight()

async function handleGlobalFile(file) {
  try {
    isUploading.value = true
    const data = await readFile(file)
    // 传递 true 开启首次推荐
    dataShare.setSharedData(data.headers.map(String), data.rows, file.name, true, { sheetNames: data.sheetNames, currentSheet: data.currentSheet, file })
  } catch (err) {
    toast.error('文件解析失败: ' + err.message)
  } finally {
    isUploading.value = false
  }
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
  // 传递 true 开启首次推荐
  dataShare.setSharedData(demoHeaders, demoRows, '社媒评论脏数据全局示例.csv', true)
  toast.success('成功加载全局演示示例数据！现在您可以点击下方的”数据清洗”或其他卡片直接开始处理。')
}

function clearGlobalExcel() {
  dataShare.clearSharedData()
}

const cards = [
  { route: '/cleaning', title: '数据清洗', desc: '智能识别并修复数据中的格式错误、缺失值和异常项。', icon: Eraser, bgAccent: 'bg-orange-50', iconBg: 'bg-orange-100 text-orange-600', iconBgHover: 'bg-orange-600', linkColor: 'text-orange-600', supportGlobal: true },
  { route: '/translate', title: '批量翻译', desc: '上传 Excel/CSV 文件，批量翻译产品参数、评论或标题。', icon: Languages, bgAccent: 'bg-blue-50', iconBg: 'bg-blue-100 text-blue-600', iconBgHover: 'bg-blue-600', linkColor: 'text-blue-600', supportGlobal: true },
  { route: '/analysis', title: '数据分析', desc: '智能分析用户评论与表格数据，自动提取情感倾向、观点和分类标签。', icon: Brain, bgAccent: 'bg-violet-50', iconBg: 'bg-violet-100 text-violet-600', iconBgHover: 'bg-violet-600', linkColor: 'text-violet-600', supportGlobal: true },
  { route: '/summary', title: '数据摘要', desc: '上传数据表，一键生成包含统计特征和业务洞察的分析报告。', icon: FileBarChart, bgAccent: 'bg-emerald-50', iconBg: 'bg-emerald-100 text-emerald-600', iconBgHover: 'bg-emerald-600', linkColor: 'text-emerald-600', supportGlobal: true }
]
</script>
