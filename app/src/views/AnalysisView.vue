<template>
  <!-- ===== 移动端模板 ===== -->
  <div v-if="isMobile" class="px-3 py-3 space-y-3 pb-20 animate-fade-in">
    <div class="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-xl border border-violet-200/50 p-3">
      <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
        <Brain class="w-5 h-5 text-violet-600" /> AI 打标
      </h2>
      <p class="text-[10px] text-slate-500 mt-0.5">自然语言描述需求 → AI 生成方案 → 批量打标。</p>
    </div>

    <div v-if="hasData && dataShare.hasData"
      class="bg-emerald-500/10 rounded-lg border border-emerald-500/20 px-3 py-2 flex justify-between items-center text-[10px]">
      <div class="flex items-center gap-1.5 text-emerald-800 min-w-0">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        <span class="truncate">已关联 <strong>{{ dataShare.sourceName }}</strong></span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 font-bold shrink-0 ml-2">断开</button>
    </div>

    <!-- 文件上传 -->
    <MobileCollapsible title="数据文件" :default-open="!hasData">
      <FileUploader v-if="!hasData" label="上传数据文件" :icon="UploadCloud" iconBg="bg-violet-50" iconColor="text-violet-600" @file="handleFile" />
      <div v-else class="text-xs text-slate-600">
        <span class="font-bold">{{ rows.length }} 行 × {{ headers.length }} 列</span>
      </div>
      <button v-if="!hasData" @click="loadDemo"
        class="w-full mt-2 py-2 bg-white border border-violet-200 text-violet-600 rounded-lg text-xs font-bold active:bg-violet-50">
        加载示例数据
      </button>
    </MobileCollapsible>

    <!-- 分析配置 -->
    <MobileCollapsible v-if="hasData" title="分析配置" :default-open="true">
      <div class="space-y-3">
        <!-- 参考列 -->
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">AI 参考列</label>
          <div class="max-h-24 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1">
            <label v-for="(h, i) in headers" :key="i" class="flex items-center gap-1.5 text-[10px] text-slate-700">
              <input type="checkbox" :value="i" v-model="selectedInputColumns" class="rounded text-violet-600" />
              {{ h }}
            </label>
          </div>
        </div>
        <!-- 范围 -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <div class="text-[9px] text-slate-400 mb-0.5">开始行</div>
            <input type="number" v-model.number="rangeStart" min="1" :max="rows.length"
              class="w-full p-1.5 border border-slate-200 rounded-lg text-[10px] font-mono" />
          </div>
          <div>
            <div class="text-[9px] text-slate-400 mb-0.5">结束行</div>
            <input type="number" v-model.number="rangeEnd" min="1" :max="rows.length"
              class="w-full p-1.5 border border-slate-200 rounded-lg text-[10px] font-mono" />
          </div>
        </div>
        <!-- 目标 -->
        <div class="bg-slate-50 rounded-lg p-2 border border-slate-200 mb-1.5">
          <div class="text-[9px] font-bold text-slate-500 uppercase mb-1">快捷模板</div>
          <div class="flex flex-wrap gap-1">
            <button v-for="tpl in PRESET_TEMPLATES" :key="tpl.id" @click="applyTemplate(tpl.id)"
              class="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 active:bg-violet-50 flex items-center gap-0.5">
              <component :is="templateIcon(tpl.icon)" class="w-2 h-2" :class="templateColor(tpl.color)" />
              {{ tpl.label }}
            </button>
          </div>
        </div>
        <textarea v-model="userGoal" rows="2"
          class="w-full p-2 border border-slate-200 rounded-lg text-[10px] resize-none"
          placeholder="描述分析需求"></textarea>
        <button @click="generateLabelingPlanWithAI" :disabled="isGeneratingPlan"
          class="w-full py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg text-[10px] font-bold disabled:opacity-50">
          {{ isGeneratingPlan ? '生成中...' : 'AI 生成方案' }}
        </button>
      </div>
    </MobileCollapsible>

    <!-- 输出列方案 -->
    <MobileCollapsible v-if="hasData && labelingPlan.outputColumns.length > 0"
      title="输出列方案" :default-open="true">
      <div class="flex justify-between items-center mb-2">
        <span class="text-[10px] text-slate-500">{{ labelingPlan.outputColumns.length }} 列</span>
        <button @click="addOutputColumn" class="text-[10px] text-violet-600 font-bold"><Plus class="w-3 h-3 inline" /> 添加</button>
      </div>
      <div class="space-y-1.5">
        <div v-for="(col, idx) in labelingPlan.outputColumns" :key="col.key"
          class="bg-slate-50 p-2 rounded-lg border border-slate-200">
          <div class="flex justify-between items-center">
            <div class="min-w-0">
              <span class="text-[10px] font-bold text-slate-700">{{ col.name }}</span>
              <span class="ml-1 text-[8px] px-1 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">{{ col.type }}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button @click="editOutputColumn(idx)" class="text-slate-400 active:text-violet-600"><Pencil class="w-3 h-3" /></button>
              <button @click="removeOutputColumn(idx)" class="text-slate-400 active:text-rose-500"><X class="w-3 h-3" /></button>
            </div>
          </div>
          <p class="text-[9px] text-slate-400 truncate">{{ col.description }}</p>
        </div>
      </div>
      <button @click="runLabelingBatch" :disabled="isAnalyzing"
        class="w-full mt-3 py-2.5 bg-violet-600 text-white rounded-lg text-xs font-bold active:bg-violet-700 disabled:opacity-50">
        {{ isAnalyzing ? '打标中...' : '开始 AI 打标' }}
      </button>
    </MobileCollapsible>

    <!-- 统计 -->
    <MobileCollapsible v-if="hasData" title="统计" :default-open="true">
      <div class="grid grid-cols-2 gap-2">
        <div class="bg-white rounded-lg border border-slate-200 p-2.5">
          <div class="text-[9px] font-bold text-slate-400 uppercase">总量</div>
          <div class="text-lg font-black text-slate-800 font-mono">{{ rows.length }}</div>
        </div>
        <div class="bg-emerald-50 rounded-lg border border-emerald-200 p-2.5">
          <div class="text-[9px] font-bold text-emerald-600 uppercase">已分析</div>
          <div class="text-lg font-black text-emerald-800 font-mono">{{ stats.done }}</div>
        </div>
      </div>
      <StatsPieChart :data="chartData" :height="160" />
      <button v-if="Object.keys(analysisMap).length > 0" @click="exportResults"
        class="w-full mt-2 py-2 bg-white border border-violet-200 text-violet-600 rounded-lg text-xs font-bold active:bg-violet-50">
        导出结果
      </button>
    </MobileCollapsible>

    <!-- 打标结果表格 -->
    <MobileCollapsible v-if="hasData" title="打标结果" :default-open="true">
      <MobileTableWrapper title="预览" :row-count="displayRows.length" height-class="h-[40vh]">
        <table class="w-full text-left border-collapse text-[10px]">
          <thead class="bg-slate-50 sticky top-0 z-10 text-[8px] font-bold text-slate-500 uppercase border-b border-slate-200">
            <tr>
              <th class="px-2 py-2 sticky left-0 bg-slate-50 z-20">原文</th>
              <th v-for="col in labelingPlan.outputColumns" :key="col.key" class="px-2 py-2 whitespace-nowrap">{{ col.name }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-600">
            <tr v-for="(row, ri) in displayRows" :key="ri"
              :class="{ 'opacity-40': isAnalyzing && (ri < (rangeStart-1) || ri > (rangeEnd-1)) }">
              <td class="px-2 py-1.5 truncate max-w-[100px] sticky left-0 z-10 bg-white">{{ row[dataShare.coreColumn] || '' }}</td>
              <td v-for="col in labelingPlan.outputColumns" :key="col.key" class="px-2 py-1.5 truncate max-w-[100px]">
                <template v-if="analysisMap[ri]?.status === 'processing'">
                  <span class="w-1.5 h-1.5 rounded-full bg-violet-600 animate-ping inline-block"></span>
                </template>
                <template v-else-if="analysisMap[ri]?.status === 'done'">
                  <span class="text-[9px] bg-slate-100 px-1 py-0.5 rounded">{{ formatCellValue(analysisMap[ri]?.values?.[col.key], col.type) }}</span>
                </template>
                <template v-else-if="analysisMap[ri]?.status === 'error'">
                  <span class="text-red-500 text-[9px]">Err</span>
                </template>
                <template v-else><span class="text-slate-300">-</span></template>
              </td>
            </tr>
          </tbody>
        </table>
      </MobileTableWrapper>
    </MobileCollapsible>

    <!-- 高级设置（默认收起）-->
    <MobileCollapsible v-if="hasData" title="高级 Prompt" :default-open="false">
      <textarea v-model="labelingPlan.compiledPrompt" @input="onPromptManualEdit" rows="4"
        class="w-full p-2 border border-slate-200 rounded text-[10px] font-mono resize-none"></textarea>
      <div class="flex gap-2 mt-2">
        <button @click="resetPromptToAuto" class="flex-1 text-[10px] py-1.5 bg-violet-50 text-violet-600 rounded-lg font-bold active:bg-violet-100">恢复自动</button>
        <button @click="syncPlanFromPrompt" :disabled="isSyncingPlan" class="flex-1 text-[10px] py-1.5 bg-slate-50 text-slate-600 rounded-lg font-bold disabled:opacity-50">同步列配置</button>
      </div>
    </MobileCollapsible>
  </div>

  <!-- ===== 桌面端模板（原样保留）===== -->
  <div v-else class="animate-fade-in max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-2xl border border-violet-200/50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Brain class="w-6 h-6 text-violet-600" /> AI 表格打标
        </h2>
        <p class="text-xs text-slate-500 mt-1">
          用自然语言描述分析目标，自动生成新增列方案，批量打标、分类、摘要与判断。
        </p>
      </div>
      <button v-if="!hasData" @click="loadDemo"
        class="px-4 py-2 bg-white hover:bg-violet-50 border border-violet-200 text-violet-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0">
        <Brain class="w-3.5 h-3.5" /> 加载示例数据
      </button>
    </div>

    <!-- 全局 Excel 关联横幅 -->
    <div v-if="hasData && dataShare.hasData"
      class="bg-emerald-500/10 rounded-xl border border-emerald-500/20 px-4 py-3 flex justify-between items-center text-xs animate-fade-in">
      <div class="flex items-center gap-2 text-emerald-800">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>当前已关联：<strong>{{ dataShare.sourceName }}</strong> ({{ rows.length }} 行)</span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 hover:text-rose-600 font-bold hover:underline">
        断开关联
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- 左侧配置面板 -->
      <div class="lg:col-span-4 space-y-6">
        <FileUploader v-if="!hasData" label="上传数据文件" :icon="UploadCloud" iconBg="bg-violet-50" iconColor="text-violet-600" @file="handleFile" />

        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 animate-fade-in">
          <div class="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
              <SlidersHorizontal class="w-4 h-4 text-slate-500" /> 打标配置
            </h3>
            <button @click="reset" class="text-xs text-red-500 hover:underline">重置</button>
          </div>

          <div class="space-y-4">

            <!-- 1. AI 参考列（多选） -->
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5">AI 参考列</label>
              <div class="max-h-32 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1 custom-scrollbar">
                <label v-for="(h, i) in headers" :key="i" class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-100 px-1 py-0.5 rounded">
                  <input type="checkbox" :value="i" v-model="selectedInputColumns"
                    class="rounded text-violet-600 focus:ring-violet-500" />
                  {{ h }}
                </label>
              </div>
              <p class="text-[9px] text-slate-400 mt-1">选择 AI 分析时需要参考的列</p>
            </div>

            <!-- 2. 分析范围 -->
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
              <label class="block text-xs font-bold text-slate-700">分析数据范围</label>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <div class="text-[9px] text-slate-400 mb-0.5">开始行</div>
                  <input type="number" v-model.number="rangeStart" min="1" :max="rows.length"
                    class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500 font-mono" />
                </div>
                <div>
                  <div class="text-[9px] text-slate-400 mb-0.5">结束行 (共 {{ rows.length }} 行)</div>
                  <input type="number" v-model.number="rangeEnd" min="1" :max="rows.length"
                    class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500 font-mono" />
                </div>
              </div>
            </div>

            <!-- 3. 自然语言目标 + AI 生成打标方案 -->
            <div class="space-y-1.5">
              <!-- 快捷模板 -->
              <div class="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                <div class="text-[9px] font-bold text-slate-500 uppercase mb-1.5">快捷模板（一键填充）</div>
                <div class="flex flex-wrap gap-1.5">
                  <button v-for="tpl in PRESET_TEMPLATES" :key="tpl.id" @click="applyTemplate(tpl.id)"
                    class="px-2.5 py-1 bg-white border border-slate-200 hover:border-violet-400 hover:bg-violet-50 rounded-md text-[10px] font-medium text-slate-700 transition-colors flex items-center gap-1">
                    <component :is="templateIcon(tpl.icon)" class="w-2.5 h-2.5" :class="templateColor(tpl.color)" />
                    {{ tpl.label }}
                  </button>
                </div>
              </div>
              <label class="text-xs font-bold text-slate-700">我想让 AI 新增什么列</label>
              <textarea v-model="userGoal" rows="3"
                class="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-violet-500 outline-none resize-none bg-slate-50"
                placeholder="描述需求，如：帮我新增4列：情感倾向、主要问题类型、是否有退换货意愿、证据短句"></textarea>
              <button @click="generateLabelingPlanWithAI" :disabled="isGeneratingPlan"
                class="w-full py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-lg text-xs font-bold shadow-md shadow-violet-200 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Sparkles class="w-3.5 h-3.5" :class="{ 'animate-spin': isGeneratingPlan }" />
                {{ isGeneratingPlan ? 'AI 生成方案中...' : 'AI 生成打标方案' }}
              </button>
            </div>

            <!-- 4. 新增列方案 -->
            <OutputColumnsList
              :output-columns="labelingPlan.outputColumns"
              @add="addOutputColumn"
              @edit="editOutputColumn"
              @remove="removeOutputColumn"
            />

            <!-- 5. 高级 Prompt 预览 -->
            <div class="border border-slate-200 rounded-lg overflow-hidden">
              <button @click="showAdvanced = !showAdvanced" type="button"
                class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors flex justify-between items-center text-xs font-bold text-slate-700 outline-none">
                <span class="flex items-center gap-1.5">
                  <Sliders class="w-3.5 h-3.5 text-slate-500" /> 高级 Prompt 预览
                </span>
                <ChevronDown class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" :class="{ 'rotate-180': showAdvanced }" />
              </button>

              <div v-show="showAdvanced" class="p-3 bg-white border-t border-slate-100 space-y-3 animate-fade-in">
                <div v-if="labelingPlan.promptDirty" class="text-[9px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                  当前 Prompt 已手动修改，可能与上方新增列方案不完全一致
                </div>
                <textarea v-model="labelingPlan.compiledPrompt" @input="onPromptManualEdit" rows="6"
                  class="w-full p-2 border border-slate-200 rounded text-xs font-mono bg-slate-50 focus:bg-white focus:border-violet-500 outline-none resize-y"></textarea>
                <div class="flex gap-2">
                  <button @click="resetPromptToAuto" class="flex-1 text-[10px] py-1.5 bg-violet-50 text-violet-600 rounded-lg font-bold hover:bg-violet-100 transition-colors">
                    恢复自动生成
                  </button>
                  <button @click="syncPlanFromPrompt" :disabled="isSyncingPlan"
                    class="flex-1 text-[10px] py-1.5 bg-slate-50 text-slate-600 rounded-lg font-bold hover:bg-slate-100 transition-colors disabled:opacity-50">
                    从 Prompt 同步列配置
                  </button>
                </div>
              </div>
            </div>

            <!-- 6. 开始 AI 打标 -->
            <button @click="runLabelingBatch" :disabled="isAnalyzing"
              class="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-bold shadow-md shadow-violet-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Brain class="w-4 h-4" /> {{ isAnalyzing ? '打标中...' : '开始 AI 打标' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：统计 + 表格 -->
      <div class="lg:col-span-8 space-y-6">
        <!-- 统计卡片 -->
        <div v-if="hasData" class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-slate-400 uppercase">总行数</div>
            <div class="text-2xl font-black text-slate-800 mt-1 font-mono">{{ rows.length }}</div>
          </div>
          <div class="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-emerald-600 uppercase">已分析</div>
            <div class="text-2xl font-black text-emerald-800 mt-1 font-mono">{{ stats.done }}</div>
            <div class="text-[9px] text-emerald-600 mt-0.5">{{ Math.round(stats.done / (rows.length || 1) * 100) }}%</div>
          </div>
          <div class="bg-violet-50 rounded-xl border border-violet-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-violet-600 uppercase">AI 新增列</div>
            <div class="text-2xl font-black text-violet-800 mt-1 font-mono">{{ labelingPlan.outputColumns.length }}</div>
          </div>
          <div class="bg-rose-50 rounded-xl border border-rose-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-rose-600 uppercase">错误行</div>
            <div class="text-2xl font-black text-rose-800 mt-1 font-mono">{{ stats.error }}</div>
          </div>
        </div>

        <!-- 分析分布饼图 -->
        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-fade-in">
          <h3 class="text-xs font-bold text-slate-700 mb-3">分析进度分布</h3>
          <StatsPieChart :data="chartData" :height="220" />
        </div>

        <!-- 数据表格 -->
        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px] overflow-hidden relative animate-fade-in">
          <div v-if="isAnalyzing" class="w-full h-1 bg-slate-100 overflow-hidden relative">
            <div class="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300" :style="{ width: percentFinished + '%' }"></div>
          </div>

          <div class="px-5 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <BarChart2 class="w-4 h-4 text-slate-400" />
              <span class="text-xs font-bold text-slate-700">预览与打标结果</span>
              <span class="text-[10px] text-slate-400">(前 20 行)</span>
              <span v-if="isAnalyzing" class="text-xs text-violet-600 font-bold ml-3 animate-pulse">
                {{ processed }}/{{ totalToProcess }} ({{ percentFinished }}%) 并发{{ actualConcurrency }}
              </span>
            </div>
            <button v-if="Object.keys(analysisMap).length > 0" @click="exportResults"
              class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-violet-600 hover:border-violet-400 transition-all flex items-center gap-1 shadow-sm">
              <Download class="w-3 h-3" /> 导出打标结果.xlsx
            </button>
          </div>

          <div class="flex-1 overflow-auto relative">
            <table class="w-full text-left border-collapse min-w-[800px]">
              <thead class="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                <tr>
                  <th class="px-3 py-3 w-12 text-center bg-slate-50">操作</th>
                  <th v-for="h in headers" :key="h" class="px-4 py-3 bg-slate-50 whitespace-nowrap">{{ h }}</th>
                  <th v-for="col in labelingPlan.outputColumns" :key="col.key" class="px-4 py-3 bg-slate-50 whitespace-nowrap text-violet-700">{{ col.name }} (AI)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-[11px] text-slate-600">
                <tr v-for="(row, ri) in displayRows" :key="ri"
                  class="hover:bg-slate-50 transition-colors"
                  :class="{
                    'opacity-40 bg-slate-50 select-none': isAnalyzing && (ri < (rangeStart - 1) || ri > (rangeEnd - 1)),
                    'bg-violet-50': isAnalyzing && ri === currentProcessingRowIdx
                  }">
                  <td class="px-3 py-2 text-center">
                    <button @click="deleteRow(ri)" type="button" :disabled="isAnalyzing"
                      class="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all disabled:opacity-30">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </td>
                  <td v-for="(_, ci) in headers.length" :key="ci" class="px-4 py-2 truncate max-w-[180px]" :title="row[ci]">
                    {{ row[ci] ?? '' }}
                  </td>
                  <!-- 动态 AI 输出列 -->
                  <td v-for="col in labelingPlan.outputColumns" :key="col.key" class="px-4 py-2 max-w-[200px] truncate">
                    <template v-if="analysisMap[ri]?.status === 'processing'">
                      <span class="inline-flex items-center gap-1 text-violet-600 font-bold animate-pulse">
                        <span class="w-1.5 h-1.5 rounded-full bg-violet-600 animate-ping"></span>
                      </span>
                    </template>
                    <template v-else-if="analysisMap[ri]?.status === 'done'">
                      <span class="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                        {{ formatCellValue(analysisMap[ri]?.values?.[col.key], col.type) }}
                      </span>
                    </template>
                    <template v-else-if="analysisMap[ri]?.status === 'error'">
                      <span class="text-red-500 text-[10px]" :title="analysisMap[ri]?.errorMessage">Error</span>
                    </template>
                    <template v-else>
                      <span class="text-slate-400">-</span>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- 编辑列弹窗（移动端/桌面端共用，脱离 isMobile 分支） -->
  <EditColumnDialog
    :show="editingColumn != null"
    :column="editingColumn"
    :index="editingColumnIdx"
    @save="onSaveColumn"
    @cancel="editingColumn = null"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { UploadCloud, SlidersHorizontal, Plus, X, Brain, BarChart2, Download, Sparkles, ChevronDown, Sliders, Trash2, Check, Pencil, Languages, Heart, Tag } from 'lucide-vue-next'
import { useDataShareStore } from '../stores/dataShare'
import FileUploader from '../components/common/FileUploader.vue'
import MobileCollapsible from '../components/common/MobileCollapsible.vue'
import MobileTableWrapper from '../components/common/MobileTableWrapper.vue'
import StatsPieChart from '../components/common/StatsPieChart.vue'
import OutputColumnsList from '../components/analysis/OutputColumnsList.vue'
import EditColumnDialog from '../components/analysis/EditColumnDialog.vue'
import { DEMO_DATA } from '../services/excel'
import { useExport } from '../composables/useExport'
import { useLabeling } from '../composables/useLabeling'
import { callAI } from '../services/ai'
import { getColumnDetectionPrompt, getLabelingPlanGenerationPrompt, compileLabelingPrompt, getPlanFromPromptPrompt, PRESET_TEMPLATES, getPresetPlan, formatIntentContext } from '../services/prompts'
import { normalizeLabelingPlan, validateLabelingPlan } from '../services/labelingPlan'
import { useSettingsStore } from '../stores/settings'
import { useDevice } from '../composables/useDevice'
import { useGlobalDataSync } from '../composables/useGlobalDataSync'
import { useFileUpload } from '../composables/useFileUpload'
import { useToast } from '../services/toast'
import { parseRobustJSON } from '../services/jsonParser'

const toast = useToast()
const settings = useSettingsStore()
const dataShare = useDataShareStore()
const { isMobile } = useDevice()

const { headers, rows, hasData, disconnectGlobalExcel } = useGlobalDataSync({
  onInit: (h, r) => {
    rangeStart.value = 1
    rangeEnd.value = r.length
    selectedInputColumns.value = dataShare.coreColumn != null ? [Number(dataShare.coreColumn)] : []
    analysisMap.value = {}
  }
})

const { exportData } = useExport({ rows, headers })

const { handleFile } = useFileUpload({
  onFileLoaded: (data) => {
    rangeStart.value = 1
    rangeEnd.value = data.rows.length
    selectedInputColumns.value = []
    analysisMap.value = {}
    if (dataShare.coreColumn != null) {
      selectedInputColumns.value = [Number(dataShare.coreColumn)]
    }
  }
})

// 分析范围
const rangeStart = ref(1)
const rangeEnd = ref(0)

// 多选参考列
const selectedInputColumns = ref([])

// 用户自然语言目标
const userGoal = ref('')

// 核心状态：打标方案
const labelingPlan = ref({
  taskName: '',
  goal: '',
  inputColumns: [],
  outputColumns: [],
  compiledPrompt: '',
  promptDirty: false
})

// 控制变量
const isGeneratingPlan = ref(false)
const isSyncingPlan = ref(false)
const showAdvanced = ref(false)

// 编辑列弹窗
const editingColumn = ref(null)
const editingColumnIdx = ref(-1)

// 分析结果映射表 { [rowIdx]: { status, values: {key: val}, errorMessage } }
const analysisMap = ref({})

const displayRows = computed(() => rows.value.slice(0, 20))

// 打标编排（批量调 AI + 进度管理 + 结果回写）由 composable 统一管理
const {
  isAnalyzing, processed, totalToProcess, percentFinished, stats, chartData,
  actualConcurrency, currentProcessingRowIdx, runLabeling: runLabelingBatch
} = useLabeling({ headers, rows, labelingPlan, rangeStart, rangeEnd, selectedInputColumns, analysisMap })


// 当 outputColumns 变化且 promptDirty 为 false 时自动重编译 prompt
watch(
  () => JSON.stringify(labelingPlan.value.outputColumns) + labelingPlan.value.goal,
  () => {
    if (!labelingPlan.value.promptDirty && labelingPlan.value.outputColumns.length > 0) {
      labelingPlan.value.compiledPrompt = compileLabelingPrompt(labelingPlan.value)
    }
  }
)

function onPromptManualEdit() {
  labelingPlan.value.promptDirty = true
}

function resetPromptToAuto() {
  labelingPlan.value.compiledPrompt = compileLabelingPrompt(labelingPlan.value)
  labelingPlan.value.promptDirty = false
}

// 编辑列操作
function addOutputColumn() {
  editingColumnIdx.value = -1
  editingColumn.value = { key: '', name: '', type: 'enum', description: '', options: [], required: true }
}

function editOutputColumn(idx) {
  editingColumnIdx.value = idx
  const col = labelingPlan.value.outputColumns[idx]
  editingColumn.value = { ...col, options: Array.isArray(col.options) ? [...col.options] : { ...(col.options || {}) } }
}

function removeOutputColumn(idx) {
  labelingPlan.value.outputColumns.splice(idx, 1)
}

// EditColumnDialog 保存回调：写回 labelingPlan.outputColumns
function onSaveColumn({ index, column }) {
  if (index >= 0) {
    labelingPlan.value.outputColumns[index] = column
  } else {
    labelingPlan.value.outputColumns.push(column)
  }
  editingColumn.value = null
}

function deleteRow(ri) {
  rows.value.splice(ri, 1)
  if (rangeEnd.value > rows.value.length) rangeEnd.value = rows.value.length
  const newMap = {}
  Object.keys(analysisMap.value).forEach(k => {
    const keyInt = parseInt(k)
    if (keyInt < ri) newMap[keyInt] = analysisMap.value[keyInt]
    else if (keyInt > ri) newMap[keyInt - 1] = analysisMap.value[keyInt]
  })
  analysisMap.value = newMap
  dataShare.setSharedData(headers.value, rows.value, dataShare.sourceName || 'modified.xlsx')
}

function formatCellValue(val, type) {
  if (val == null || val === '') return '-'
  if (type === 'multi_enum' && Array.isArray(val)) return val.join(', ')
  if (type === 'boolean') return val === true ? 'Yes' : val === false ? 'No' : '-'
  return String(val)
}

// ── 方案校验与规范化 ──
// ── 文件加载 ──
function loadDemo() {
  const demo = DEMO_DATA.comments
  dataShare.setSharedData(demo.headers, demo.rows, '用户评论示例.csv', true)
  headers.value = [...demo.headers]
  rows.value = demo.rows.map(r => [...r])
  rangeStart.value = 1
  rangeEnd.value = demo.rows.length
  selectedInputColumns.value = dataShare.coreColumn != null ? [Number(dataShare.coreColumn)] : []
  analysisMap.value = {}
}

function reset() {
  headers.value = []
  rows.value = []
  analysisMap.value = {}
  labelingPlan.value = { taskName: '', goal: '', inputColumns: [], outputColumns: [], compiledPrompt: '', promptDirty: false }
  userGoal.value = ''
}

// ── AI 生成打标方案 ──
async function generateLabelingPlanWithAI() {
  const settings = useSettingsStore()
  if (!settings.isConfigured) { settings.showSettings = true; toast.warn('请先配置 API 密钥'); return }
  if (!rows.value.length) { toast.warn('请先上传数据'); return }

  isGeneratingPlan.value = true
  try {
    const inputCols = selectedInputColumns.value.length > 0 ? selectedInputColumns.value : (dataShare.coreColumn != null ? [Number(dataShare.coreColumn)] : [0])
    const sampleRows = rows.value.slice(0, 10).map(row => {
      const obj = {}
      inputCols.forEach(ci => { obj[headers.value[ci]] = row[ci] ?? '' })
      return obj
    })

    const prompt = getLabelingPlanGenerationPrompt(userGoal.value, headers.value, sampleRows, inputCols)
    const sysPrompt = '你是一个数据分析配置专家。' + formatIntentContext(dataShare.intentNote, '为表格新增列')
    const res = await callAI(prompt, sysPrompt, settings.getApiConfig().workModel)
    const parsed = parseRobustJSON(res)

    const plan = normalizeLabelingPlan(parsed)
    if (!plan) throw new Error('AI 返回的方案格式无效')

    const err = validateLabelingPlan(plan)
    if (err) throw new Error(err)

    labelingPlan.value = {
      ...plan,
      compiledPrompt: compileLabelingPrompt(plan),
      promptDirty: false
    }
    selectedInputColumns.value = plan.inputColumns
      .map(name => headers.value.indexOf(name))
      .filter(i => i >= 0)
  } catch (e) {
    toast.error('AI 生成打标方案失败: ' + e.message)
  } finally {
    isGeneratingPlan.value = false
  }
}

// ── 智能加工预设模板 ──
function templateIcon(name) {
  return { Languages, Heart, Tag }[name] || Tag
}
function templateColor(c) {
  return { blue: 'text-blue-600', rose: 'text-rose-600', violet: 'text-violet-600' }[c] || 'text-slate-600'
}
function applyTemplate(templateId) {
  if (!rows.value.length) { toast.warn('请先上传数据'); return }
  const idx = Number(dataShare.coreColumn)
  if (idx == null || Number.isNaN(idx) || idx < 0 || idx >= headers.value.length) {
    toast.warn('请先选择有效的核心列')
    return
  }
  const plan = getPresetPlan(templateId, idx)
  if (!plan) return
  labelingPlan.value = plan
  selectedInputColumns.value = [idx]
  userGoal.value = plan.goal
  toast.success(`已应用「${plan.taskName}」模板，可点击下方开始打标`)
}

// ── 从 Prompt 反向同步列配置 ──
async function syncPlanFromPrompt() {
  const settings = useSettingsStore()
  if (!settings.isConfigured) { settings.showSettings = true; toast.warn('请先配置 API 密钥'); return }
  if (!labelingPlan.value.compiledPrompt.trim()) { toast.warn('当前 Prompt 为空'); return }

  isSyncingPlan.value = true
  try {
    const prompt = getPlanFromPromptPrompt(labelingPlan.value.compiledPrompt, labelingPlan.value)
    const res = await callAI(prompt, '你是一个 Prompt 逆向分析专家。', settings.getApiConfig().workModel)
    const parsed = parseRobustJSON(res)
    const plan = normalizeLabelingPlan(parsed)
    if (!plan) throw new Error('无法从 Prompt 中解析出有效的列配置')

    if (!confirm(`AI 解析出 ${plan.outputColumns.length} 个输出列：\n${plan.outputColumns.map(c => '- ' + c.name).join('\n')}\n\n确认覆盖当前方案？`)) return

    labelingPlan.value = {
      ...plan,
      compiledPrompt: labelingPlan.value.compiledPrompt,
      promptDirty: false
    }
  } catch (e) {
    toast.error('同步失败: ' + e.message)
  } finally {
    isSyncingPlan.value = false
  }
}

// ── 核心：逐行 AI 打标 ──
// ── 导出 ──
function exportResults() {
  const plan = labelingPlan.value
  exportData(() => rows.value.map((row, ri) => {
    const res = analysisMap.value[ri]
    const padded = [...row]
    while (padded.length < headers.value.length) padded.push('')
    plan.outputColumns.forEach(c => {
      const val = res?.values?.[c.key]
      if (val == null) padded.push('')
      else if (Array.isArray(val)) padded.push(val.join(', '))
      else padded.push(String(val))
    })
    return padded
  }), 'AI打标结果.xlsx', () => [...headers.value, ...plan.outputColumns.map(c => `${c.name} (AI)`)])
}
</script>
