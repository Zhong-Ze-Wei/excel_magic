<template>
  <!-- ===== 移动端模板 ===== -->
  <div v-if="isMobile" class="px-3 py-3 space-y-3 pb-20 animate-fade-in">
    <!-- 移动端标题 -->
    <div class="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl border border-orange-200/50 p-3">
      <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
        <Eraser class="w-5 h-5 text-orange-600" /> 数据清洗
      </h2>
      <p class="text-[10px] text-slate-500 mt-0.5">原子规则打标，不直接删除，支持审计与修正。</p>
    </div>

    <!-- 全局关联状态 -->
    <div v-if="hasData && dataShare.hasData"
      class="bg-emerald-500/10 rounded-lg border border-emerald-500/20 px-3 py-2 flex justify-between items-center text-[10px]">
      <div class="flex items-center gap-1.5 text-emerald-800 min-w-0">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        <span class="truncate">已关联 <strong>{{ dataShare.sourceName }}</strong></span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 font-bold shrink-0 ml-2">断开</button>
    </div>

    <!-- 折叠面板：文件上传/信息 -->
    <MobileCollapsible title="数据文件" :default-open="!hasData">
      <FileUploader v-if="!hasData" label="上传 Excel/CSV" :icon="Eraser" iconBg="bg-orange-50" iconColor="text-orange-600" @file="handleFile" />
      <div v-else class="space-y-2">
        <div class="text-xs text-slate-600">
          <span class="font-bold">{{ rows.length }} 行 × {{ headers.length }} 列</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-slate-500 shrink-0">清洗列:</span>
          <select :value="dataShare.coreColumn" @change="e => { dataShare.setCoreColumn(e.target.value); runPipeline(); }"
            class="flex-1 min-w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>
      </div>
      <button v-if="!hasData" @click="loadDemo"
        class="w-full mt-2 py-2 bg-white border border-orange-200 text-orange-600 rounded-lg text-xs font-bold active:bg-orange-50">
        加载演示数据
      </button>
    </MobileCollapsible>

    <!-- 折叠面板：清洗规则 -->
    <MobileCollapsible v-if="hasData" title="清洗规则" :default-open="true">
      <input type="file" ref="configFileRef" accept=".json" class="hidden" @change="handleImportConfig" />
      <!-- 弱规则策略 -->
      <div class="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200/60 space-y-1.5 mb-3">
        <label class="block text-[10px] font-bold text-slate-700">弱规则策略</label>
        <div class="flex gap-3">
          <label class="flex items-center gap-1 text-[10px] text-slate-600">
            <input type="radio" v-model="rulesConfig.weakPolicy" value="mark" @change="runPipeline" class="text-orange-600"> 标记待确认
          </label>
          <label class="flex items-center gap-1 text-[10px] text-slate-600">
            <input type="radio" v-model="rulesConfig.weakPolicy" value="delete" @change="runPipeline" class="text-orange-600"> 直接强删
          </label>
        </div>
      </div>

      <!-- 规则开关列表 -->
      <div class="space-y-1.5 max-h-[50vh] overflow-y-auto">
        <div v-for="rule in rulesMeta" :key="rule.key"
          class="border rounded-lg p-2 space-y-1"
          :class="rulesConfig[rule.key].enable ? 'border-orange-200 bg-orange-50/10' : 'border-slate-200'">
          <label class="flex items-center gap-1.5">
            <input type="checkbox" v-model="rulesConfig[rule.key].enable" @change="runPipeline" class="rounded text-orange-600" />
            <span class="text-[10px] font-bold text-slate-700">{{ rule.title }}</span>
            <span class="px-1 rounded text-[8px] font-bold"
              :class="rule.isWeak ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'">
              {{ rule.isWeak ? '弱' : '强删' }}
            </span>
          </label>
          <div v-show="expandedRules[rule.key]" class="pl-5 pt-1 space-y-1">
            <div v-if="rule.key === 'tooShort'">
              <input type="number" v-model.number="rulesConfig.tooShort.minLength" min="1" @input="runPipeline"
                class="w-full p-1.5 border border-slate-200 rounded text-[10px]" />
            </div>
            <div v-if="rule.key === 'duplicate'">
              <input type="number" v-model.number="rulesConfig.duplicate.minCount" min="2" @input="runPipeline"
                class="w-full p-1.5 border border-slate-200 rounded text-[10px]" />
            </div>
            <div v-if="rule.key === 'topicOnly'">
              <input type="number" step="0.1" v-model.number="rulesConfig.topicOnly.ratioThreshold" min="0.1" max="1.0" @input="runPipeline"
                class="w-full p-1.5 border border-slate-200 rounded text-[10px]" />
            </div>
            <div v-if="rule.key === 'shortMeaningless'">
              <textarea v-model="rulesConfig.shortMeaningless.phrasesStr" rows="2" @input="handlePhrasesInput"
                class="w-full p-1.5 border border-slate-200 rounded text-[10px] resize-none font-mono"></textarea>
            </div>
            <div v-if="rule.key === 'adLink'">
              <textarea v-model="rulesConfig.adLink.keywordsStr" rows="2" @input="handleKeywordsInput"
                class="w-full p-1.5 border border-slate-200 rounded text-[10px] resize-none font-mono"></textarea>
            </div>
            <div v-if="rule.key === 'garbledText'">
              <input type="number" step="0.05" v-model.number="rulesConfig.garbledText.threshold" min="0.1" max="1.0" @input="runPipeline"
                class="w-full p-1.5 border border-slate-200 rounded text-[10px]" />
            </div>
          </div>
        </div>
      </div>

      <!-- 自定义筛选 -->
      <div class="mt-3 pt-2 border-t border-slate-200 space-y-2">
        <div class="flex items-center gap-1.5">
          <Sparkles class="w-3 h-3 text-violet-500" />
          <span class="text-[10px] font-bold text-violet-700">AI 智能筛选</span>
        </div>
        <div class="flex gap-1.5">
          <input v-model="smartFilterInput" type="text" placeholder="描述筛选意图"
            class="flex-1 px-2 py-1.5 text-[10px] border border-violet-200 rounded-lg outline-none bg-white"
            @keydown.enter="generateSmartFilter" />
          <button @click="generateSmartFilter" :disabled="isGeneratingFilter"
            class="px-2 py-1.5 bg-violet-600 text-white rounded-lg text-[10px] font-bold disabled:opacity-50 shrink-0">
            {{ isGeneratingFilter ? '...' : '生成' }}
          </button>
        </div>
        <div class="space-y-1 max-h-[120px] overflow-y-auto">
          <div v-for="filter in (settings.rulesConfig.customFilters || [])" :key="filter.id"
            class="border rounded-lg p-1.5 flex items-center justify-between"
            :class="filter.enabled ? 'border-orange-200 bg-orange-50/10' : 'border-slate-200 opacity-60'">
            <label class="flex items-center gap-1 min-w-0 flex-1">
              <input type="checkbox" v-model="filter.enabled" @change="runPipeline" class="rounded text-orange-600 shrink-0" />
              <span class="text-[10px] font-bold text-slate-700 truncate">{{ filter.name }}</span>
            </label>
            <div class="flex items-center gap-1 shrink-0">
              <button @click="editCustomFilter(filter)" class="text-slate-400 active:text-violet-500"><Pencil class="w-3 h-3" /></button>
              <button @click="removeCustomFilter(filter.id)" class="text-slate-400 active:text-rose-500"><X class="w-3 h-3" /></button>
            </div>
          </div>
        </div>
        <button @click="editingFilter = null; showAddFilterForm = true"
          class="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-[10px] text-slate-500 active:border-orange-400 active:text-orange-600">
          <Plus class="w-3 h-3 inline" /> 手动添加
        </button>
      </div>
    </MobileCollapsible>

    <!-- 折叠面板：统计与操作 -->
    <MobileCollapsible v-if="hasData" title="统计与操作" :default-open="true">
      <!-- 统计卡片 2x2 -->
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="bg-white rounded-lg border border-slate-200 p-2.5">
          <div class="text-[9px] font-bold text-slate-400 uppercase">总量</div>
          <div class="text-lg font-black text-slate-800 font-mono">{{ totalCount }}</div>
        </div>
        <div class="bg-emerald-50 rounded-lg border border-emerald-200 p-2.5">
          <div class="text-[9px] font-bold text-emerald-600 uppercase">保留</div>
          <div class="text-lg font-black text-emerald-800 font-mono">{{ stats.keep }}</div>
        </div>
        <div class="bg-rose-50 rounded-lg border border-rose-200 p-2.5">
          <div class="text-[9px] font-bold text-rose-600 uppercase">过滤</div>
          <div class="text-lg font-black text-rose-800 font-mono">{{ stats.delete }}</div>
        </div>
        <div class="bg-amber-50 rounded-lg border border-amber-200 p-2.5">
          <div class="text-[9px] font-bold text-amber-600 uppercase">待确认</div>
          <div class="text-lg font-black text-amber-800 font-mono">{{ stats.suspect }}</div>
        </div>
      </div>
      <!-- 操作按钮 -->
      <div class="space-y-2">
        <button @click="exportCleanedOnly"
          class="w-full py-2.5 bg-orange-600 text-white rounded-lg text-xs font-bold active:bg-orange-700">
          导出保留数据
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button @click="exportFullAudit"
            class="py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold active:bg-slate-50">
            导出审计报表
          </button>
          <button @click="resetAllOverrides"
            class="py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold active:bg-slate-50">
            重置覆写
          </button>
        </div>
        <div v-if="dataShare.hasData" class="grid grid-cols-2 gap-2">
          <button @click="applyToGlobal"
            class="py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold active:bg-emerald-700">
            应用到全局
          </button>
          <div class="relative">
            <button @click="showShareMenu = !showShareMenu"
              class="w-full py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold active:bg-blue-700">
              共享至...
            </button>
            <div v-show="showShareMenu" class="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1 text-xs">
              <button @click="shareDataTo('/translate')" class="w-full text-left px-3 py-2 active:bg-slate-50 text-slate-700 border-b border-slate-100">批量翻译</button>
              <button @click="shareDataTo('/analysis')" class="w-full text-left px-3 py-2 active:bg-slate-50 text-slate-700 border-b border-slate-100">评论分析</button>
              <button @click="shareDataTo('/summary')" class="w-full text-left px-3 py-2 active:bg-slate-50 text-slate-700">数据摘要</button>
            </div>
          </div>
        </div>
      </div>
    </MobileCollapsible>

    <!-- 折叠面板：审计表格 -->
    <MobileCollapsible v-if="hasData" title="审计表格" :default-open="true">
      <MobileTableWrapper title="清洗预览" :row-count="displayCleanedRows.length" height-class="h-[40vh]">
        <table class="w-full text-left border-collapse text-[10px]">
          <thead class="bg-slate-50 sticky top-0 z-10 text-[8px] font-bold text-slate-500 uppercase border-b border-slate-200">
            <tr>
              <th class="px-2 py-2 text-center sticky left-0 bg-slate-50 z-20 w-12">状态</th>
              <th class="px-2 py-2">命中规则</th>
              <th class="px-2 py-2">原文</th>
              <th class="px-2 py-2 w-16 text-center">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-600">
            <tr v-for="(item, ri) in displayCleanedRows" :key="ri"
              :class="rowClass(item.decision)">
              <td class="px-2 py-1.5 text-center whitespace-nowrap sticky left-0 z-10 bg-white"
                :class="{ 'bg-rose-50/80': item.decision === 'delete', 'bg-amber-50/80': item.decision === 'suspect' }">
                <span class="px-1 py-0.5 rounded-full text-[8px] font-bold" :class="statusBadgeClass(item.decision)">
                  {{ statusLabel(item.decision) }}
                </span>
              </td>
              <td class="px-2 py-1.5">
                <span class="font-mono text-[9px] font-bold" :class="ruleClass(item.decision)">{{ item.hitRule }}</span>
                <div class="text-[8px] text-slate-400 truncate max-w-[120px]">{{ item.reason }}</div>
              </td>
              <td class="px-2 py-1.5 truncate max-w-[150px]">{{ item.originalText || '' }}</td>
              <td class="px-2 py-1.5 text-center whitespace-nowrap">
                <div class="inline-flex rounded border border-slate-200 overflow-hidden">
                  <button @click="overwriteDecision(ri, 'keep')"
                    class="p-1"
                    :class="item.decision === 'keep' ? 'bg-emerald-500 text-white' : 'text-slate-400'">
                    <Check class="w-2.5 h-2.5" />
                  </button>
                  <button @click="overwriteDecision(ri, 'delete')"
                    class="p-1"
                    :class="item.decision === 'delete' ? 'bg-rose-500 text-white' : 'text-slate-400'">
                    <X class="w-2.5 h-2.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </MobileTableWrapper>
    </MobileCollapsible>

    <!-- 自定义筛选规则编辑弹窗 -->
    <CustomFilterForm v-if="showAddFilterForm"
      :filter="editingFilter"
      :headers="headers"
      @save="handleSaveFilter"
      @cancel="showAddFilterForm = false; editingFilter = null" />
  </div>

  <!-- ===== 桌面端模板（原样保留）===== -->
  <div v-else class="animate-fade-in max-w-7xl mx-auto space-y-6">
    <!-- Header Summary Card -->
    <div class="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-2xl border border-orange-200/50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Eraser class="w-6 h-6 text-orange-600 animate-bounce" /> 智能数据清洗系统
        </h2>
        <p class="text-xs text-slate-500 mt-1">
          采用“原子判定规则” + “策略汇聚判定”架构，仅做风险打标而不直接删除，完全支持审计留痕与手动修正。
        </p>
      </div>
      <button v-if="!hasData" @click="loadDemo" class="px-4 py-2 bg-white hover:bg-orange-50 border border-orange-200 text-orange-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5">
        <RefreshCw class="w-3.5 h-3.5" /> 加载社媒评论脏数据示例
      </button>
    </div>

    <!-- 全局活跃 Excel 关联状态横幅 -->
    <div v-if="hasData && dataShare.hasData" 
      class="bg-emerald-500/10 rounded-xl border border-emerald-500/20 px-4 py-3 flex justify-between items-center text-xs animate-fade-in">
      <div class="flex items-center gap-2 text-emerald-800">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>当前已成功关联全局活跃工作表：<strong class="font-semibold">{{ dataShare.sourceName }}</strong> (全表 {{ rows.length }} 行)</span>
      </div>
      <button @click="disconnectGlobalExcel" class="text-rose-500 hover:text-rose-600 font-bold hover:underline">
        断开全局关联
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Panel: Rules Configuration -->
      <div class="lg:col-span-4 space-y-6">
        <FileUploader v-if="!hasData" label="上传需要清洗的 Excel/CSV 文件" :icon="Eraser" iconBg="bg-orange-50" iconColor="text-orange-600" @file="handleFile" />

        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 animate-fade-in">
          <input type="file" ref="configFileRef" accept=".json" class="hidden" @change="handleImportConfig" />
          
          <div class="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Settings2 class="w-4.5 h-4.5 text-slate-500" /> 清洗配置面板
            </h3>
            <div class="flex items-center gap-1.5 text-[11px]">
              <button @click="importConfigTrigger" class="text-emerald-600 hover:underline">导入</button>
              <span class="text-slate-300">|</span>
              <button @click="exportConfig" class="text-blue-600 hover:underline">导出</button>
              <span class="text-slate-300">|</span>
              <button @click="reset" class="text-red-500 hover:underline">重置</button>
            </div>
          </div>

          <!-- Target Column Selector -->
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-600">清洗目标列 (需清洗的文本列)</label>
            <select v-if="headers.length > 0" :value="dataShare.coreColumn" @change="e => { dataShare.setCoreColumn(e.target.value); runPipeline(); }" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500">
              <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
            </select>
          </div>

          <!-- Weak Rules Policy Selector -->
          <div class="bg-slate-50/60 p-3 rounded-lg border border-slate-200/60 space-y-2">
            <label class="block text-xs font-bold text-slate-700">弱规则过滤策略</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input type="radio" v-model="rulesConfig.weakPolicy" value="mark" @change="runPipeline" class="text-orange-600 focus:ring-orange-500">
                标记为待确认 🟡
              </label>
              <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input type="radio" v-model="rulesConfig.weakPolicy" value="delete" @change="runPipeline" class="text-orange-600 focus:ring-orange-500">
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
              <!-- Normalize (Always Active / Not Deleting) -->
              <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
                <div>
                  <div class="font-bold text-slate-700">文本标准化 (normalize)</div>
                  <div class="text-[10px] text-slate-400">去除控制字符、压缩多余空白、统一去首尾空格</div>
                </div>
                <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">默认开启</span>
              </div>

              <!-- Loop other Rules -->
              <div v-for="rule in rulesMeta" :key="rule.key" 
                class="border border-slate-200 rounded-lg p-2.5 bg-white space-y-2 transition-all"
                :class="{ 'border-orange-200 bg-orange-50/10': rulesConfig[rule.key].enable }">
                
                <div class="flex justify-between items-start">
                  <label class="flex items-center gap-2 cursor-pointer flex-1">
                    <input type="checkbox" v-model="rulesConfig[rule.key].enable" @change="runPipeline" class="rounded text-orange-600 focus:ring-orange-500" />
                    <div>
                      <span class="text-xs font-bold text-slate-700">{{ rule.title }}</span>
                      <span class="ml-1.5 px-1 py-0.5 rounded text-[8px] font-bold" 
                        :class="rule.isWeak ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'">
                        {{ rule.isWeak ? '弱规则' : '强删规则' }}
                      </span>
                    </div>
                  </label>
                  <button @click="toggleRuleExpand(rule.key)" class="text-slate-400 hover:text-slate-600">
                    <ChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': expandedRules[rule.key] }" />
                  </button>
                </div>

                <p class="text-[10px] text-slate-400 pl-6 leading-tight">{{ rule.description }}</p>

                <!-- Expanded Rule Configuration -->
                <div v-show="expandedRules[rule.key]" class="pl-6 pt-2 border-t border-slate-100 space-y-2 animate-fade-in">
                  <!-- TooShort minLength -->
                  <div v-if="rule.key === 'tooShort'" class="space-y-1">
                    <span class="text-[10px] text-slate-500 font-medium">字数过滤长度阈值 (有效字符少于此值则删除):</span>
                    <input type="number" v-model.number="rulesConfig.tooShort.minLength" min="1" @input="runPipeline"
                      class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none" />
                  </div>

                  <!-- Duplicate minCount -->
                  <div v-if="rule.key === 'duplicate'" class="space-y-1">
                    <span class="text-[10px] text-slate-500 font-medium">触发去重的重复次数阈值:</span>
                    <input type="number" v-model.number="rulesConfig.duplicate.minCount" min="2" @input="runPipeline"
                      class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none" />
                  </div>

                  <!-- TopicOnly ratioThreshold -->
                  <div v-if="rule.key === 'topicOnly'" class="space-y-1">
                    <span class="text-[10px] text-slate-500 font-medium">纯话题标签字符占比阈值 (0-1):</span>
                    <input type="number" step="0.1" v-model.number="rulesConfig.topicOnly.ratioThreshold" min="0.1" max="1.0" @input="runPipeline"
                      class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none" />
                  </div>

                  <!-- ShortMeaningless Phrases -->
                  <div v-if="rule.key === 'shortMeaningless'" class="space-y-1">
                    <span class="text-[10px] text-slate-500 font-medium">无意义短词库 (逗号隔开):</span>
                    <textarea v-model="rulesConfig.shortMeaningless.phrasesStr" rows="2" @input="handlePhrasesInput"
                      class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none resize-none font-mono"></textarea>
                  </div>

                  <!-- AdLink Keywords -->
                  <div v-if="rule.key === 'adLink'" class="space-y-1">
                    <span class="text-[10px] text-slate-500 font-medium">广告引流敏感词 (逗号隔开):</span>
                    <textarea v-model="rulesConfig.adLink.keywordsStr" rows="2" @input="handleKeywordsInput"
                      class="w-full p-1.5 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none resize-none font-mono"></textarea>
                  </div>

                  <!-- GarbledText threshold -->
                  <div v-if="rule.key === 'garbledText'" class="space-y-1">
                    <span class="text-[10px] text-slate-500 font-medium">判定乱码的杂乱字符比率 (0-1):</span>
                    <input type="number" step="0.05" v-model.number="rulesConfig.garbledText.threshold" min="0.1" max="1.0" @input="runPipeline"
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

            <!-- AI 智能筛选 -->
            <div class="bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200 rounded-lg p-2.5 space-y-2">
              <div class="flex items-center gap-1.5">
                <Sparkles class="w-3.5 h-3.5 text-violet-500" />
                <span class="text-[10px] font-bold text-violet-700">AI 智能筛选</span>
              </div>
              <div class="flex gap-1.5">
                <input v-model="smartFilterInput" type="text"
                  placeholder="描述筛选意图，如：过滤掉负面评论"
                  class="flex-1 px-2 py-1.5 text-[10px] border border-violet-200 rounded-lg focus:border-violet-400 outline-none bg-white"
                  @keydown.enter="generateSmartFilter" />
                <button @click="generateSmartFilter" :disabled="isGeneratingFilter"
                  class="px-2.5 py-1.5 bg-violet-600 text-white rounded-lg text-[10px] font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1 shrink-0">
                  <Sparkles class="w-3 h-3" :class="{ 'animate-spin': isGeneratingFilter }" />
                  {{ isGeneratingFilter ? '生成中' : '生成' }}
                </button>
              </div>
            </div>

            <!-- 自定义规则列表 -->
            <div class="max-h-[180px] overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
              <div v-for="filter in (settings.rulesConfig.customFilters || [])" :key="filter.id"
                class="border rounded-lg p-2 transition-all"
                :class="filter.enabled ? 'border-orange-200 bg-orange-50/10' : 'border-slate-200 bg-white opacity-60'">
                <div class="flex justify-between items-center">
                  <label class="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0">
                    <input type="checkbox" v-model="filter.enabled" @change="runPipeline"
                      class="rounded text-orange-600 focus:ring-orange-500 shrink-0" />
                    <span class="text-[10px] font-bold text-slate-700 truncate">{{ filter.name }}</span>
                  </label>
                  <div class="flex items-center gap-1 shrink-0">
                    <span class="text-[9px] px-1 py-0.5 rounded"
                      :class="filter.policy === 'delete' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'">
                      {{ filter.policy === 'delete' ? '删除' : '待确认' }}
                    </span>
                    <button @click="editCustomFilter(filter)" class="text-slate-400 hover:text-violet-500">
                      <Pencil class="w-3 h-3" />
                    </button>
                    <button @click="removeCustomFilter(filter.id)" class="text-slate-400 hover:text-rose-500">
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

            <!-- 手动添加按钮 -->
            <button @click="editingFilter = null; showAddFilterForm = true"
              class="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-[10px] text-slate-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/30 transition-all flex items-center justify-center gap-1">
              <Plus class="w-3 h-3" /> 手动添加规则
            </button>
          </div>
        </div>
      </div>

      <!-- Right Panel: Data Preview & Audit Table -->
      <div class="lg:col-span-8 space-y-6">
        <!-- Empty State -->
        <div v-if="!hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center text-slate-400">
          <Eraser class="w-16 h-16 mb-4 opacity-30 text-orange-500" />
          <h3 class="font-bold text-slate-700 text-sm">暂无数据</h3>
          <p class="text-xs text-slate-400 mt-1 max-w-sm text-center">
            请在左侧上传您的 Excel/CSV 表格，或者点击顶部按钮一键加载极具针对性的脏数据评论样本进行体验。
          </p>
        </div>

        <!-- Dashboard Statistics Cards -->
        <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-slate-400 uppercase">原始数据量</div>
            <div class="text-2xl font-black text-slate-800 mt-1 font-mono">{{ totalCount }}</div>
            <div class="text-[9px] text-slate-400 mt-0.5">全表 100% 数据</div>
          </div>

          <div class="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-emerald-600 uppercase">建议保留</div>
            <div class="text-2xl font-black text-emerald-800 mt-1 font-mono">{{ stats.keep }}</div>
            <div class="text-[9px] text-emerald-600/80 mt-0.5">占比 {{ Math.round(stats.keep/totalCount*100) || 0 }}%</div>
          </div>

          <div class="bg-rose-50 rounded-xl border border-rose-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-rose-600 uppercase">建议过滤</div>
            <div class="text-2xl font-black text-rose-800 mt-1 font-mono">{{ stats.delete }}</div>
            <div class="text-[9px] text-rose-600/80 mt-0.5">占比 {{ Math.round(stats.delete/totalCount*100) || 0 }}%</div>
          </div>

          <div class="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
            <div class="text-[10px] font-bold text-amber-600 uppercase">待人工确认</div>
            <div class="text-2xl font-black text-amber-800 mt-1 font-mono">{{ stats.suspect }}</div>
            <div class="text-[9px] text-amber-600/80 mt-0.5">占比 {{ Math.round(stats.suspect/totalCount*100) || 0 }}%</div>
          </div>
        </div>

        <!-- Live Audit Table Card -->
        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px] overflow-hidden animate-fade-in">
          <div class="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-700">数据清洗审计与预览</span>
              <span class="text-[10px] text-slate-400">(仅加载前 100 行样本进行审计与决策覆写)</span>
            </div>

            <!-- Export & Share Selector -->
            <div class="flex items-center gap-2">
              <!-- 一键共享工作流下拉组件 -->
              <div class="relative">
                <button @click="showShareMenu = !showShareMenu"
                  class="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all flex items-center gap-1 shadow-sm">
                  🚀 共享结果至...
                </button>
                
                <!-- 下拉菜单卡片 -->
                <div v-show="showShareMenu" class="absolute right-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1 text-xs animate-fade-in">
                  <button @click="shareDataTo('/translate')" class="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between border-b border-slate-100">
                    <span>批量翻译 ➡️</span>
                  </button>
                  <button @click="shareDataTo('/analysis')" class="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between border-b border-slate-100">
                    <span>评论分析 ➡️</span>
                  </button>
                  <button @click="shareDataTo('/summary')" class="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between">
                    <span>数据摘要 ➡️</span>
                  </button>
                </div>
              </div>

              <button @click="applyToGlobal" v-if="dataShare.hasData"
                class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1 shadow-sm mr-1">
                💾 应用清洗结果到全局
              </button>

              <button @click="resetAllOverrides"
                class="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:border-amber-300 hover:text-amber-600 transition-all flex items-center gap-1 shadow-sm">
                <RotateCcw class="w-3.5 h-3.5" /> 重置所有覆写
              </button>

              <button @click="exportCleanedOnly"
                class="px-2.5 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 transition-all flex items-center gap-1 shadow-sm">
                <Download class="w-3.5 h-3.5" /> 导出保留数据
              </button>
              <button @click="exportFullAudit"
                class="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:border-orange-300 hover:text-orange-600 transition-all flex items-center gap-1 shadow-sm">
                <Download class="w-3.5 h-3.5" /> 导出审计报表.xlsx
              </button>
            </div>
          </div>

          <!-- Audit Table Body -->
          <div class="flex-1 overflow-auto">
            <table class="w-full text-left border-collapse min-w-[900px]">
              <thead class="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                <tr>
                  <th class="px-3 py-3 w-16 text-center">状态</th>
                  <th class="px-4 py-3">命中规则与置信度</th>
                  <th class="px-4 py-3">原文 (清洗列)</th>
                  <th class="px-4 py-3">标准化文本</th>
                  <th class="px-4 py-3 w-28 text-center">决策覆写</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-[11px] text-slate-600">
                <tr v-for="(item, ri) in displayCleanedRows" :key="ri" 
                  class="hover:bg-slate-50/50 transition-colors"
                  :class="rowClass(item.decision)">
                  
                  <!-- Decision Status Tag -->
                  <td class="px-3 py-2 text-center whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-bold" :class="statusBadgeClass(item.decision)">
                      {{ statusLabel(item.decision) }}
                    </span>
                  </td>

                  <!-- Hit Rule and Reason -->
                  <td class="px-4 py-2">
                    <div class="flex items-center gap-1">
                      <span class="font-mono text-[10px] font-bold" :class="ruleClass(item.decision)">{{ item.hitRule }}</span>
                      <span v-if="item.confidence > 0 && item.confidence < 1" class="text-[9px] text-slate-400">({{ item.confidence }})</span>
                    </div>
                    <div class="text-[9px] text-slate-400 leading-tight mt-0.5">{{ item.reason }}</div>
                  </td>
                  
                  <!-- Original Text -->
                  <td class="px-4 py-2 truncate max-w-[220px]" :title="item.originalText">
                    {{ item.originalText || '' }}
                  </td>

                  <!-- Normalized Text -->
                  <td class="px-4 py-2 truncate max-w-[220px]" :title="item.normalizedText">
                    {{ item.normalizedText || '' }}
                  </td>

                  <!-- User Overwrite Actions -->
                  <td class="px-4 py-2 text-center whitespace-nowrap">
                    <div class="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white shadow-sm gap-0.5">
                      <button @click="overwriteDecision(ri, 'keep')" title="标记保留"
                        class="p-1 rounded transition-colors"
                        :class="item.decision === 'keep' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-emerald-500 hover:bg-slate-50'">
                        <Check class="w-3 h-3" />
                      </button>
                      <button @click="overwriteDecision(ri, 'delete')" title="标记删除"
                        class="p-1 rounded transition-colors"
                        :class="item.decision === 'delete' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-rose-500 hover:bg-slate-50'">
                        <X class="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>

    <!-- 自定义筛选规则编辑弹窗 -->
    <CustomFilterForm v-if="showAddFilterForm"
      :filter="editingFilter"
      :headers="headers"
      @save="handleSaveFilter"
      @cancel="showAddFilterForm = false; editingFilter = null" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Eraser, Settings2, Download, ChevronDown, Check, X, RefreshCw, Sparkles, Plus, Pencil, RotateCcw } from 'lucide-vue-next'
import FileUploader from '../components/common/FileUploader.vue'
import CustomFilterForm from '../components/cleaning/CustomFilterForm.vue'
import MobileCollapsible from '../components/common/MobileCollapsible.vue'
import MobileTableWrapper from '../components/common/MobileTableWrapper.vue'
import { readFile, exportToXlsx } from '../services/excel'
import { runCleaningPipeline } from '../services/cleaningRules'
import { useDataShareStore } from '../stores/dataShare'
import { useSettingsStore } from '../stores/settings'
import { useDevice } from '../composables/useDevice'
import { callAI } from '../services/ai'
import { getSmartFilterPrompt } from '../services/prompts'
import { useToast } from '../services/toast'

const toast = useToast()
const router = useRouter()
const dataShare = useDataShareStore()
const { isMobile } = useDevice()
const showShareMenu = ref(false)

const headers = ref([])
const rows = ref([])
const sourceCol = computed(() => dataShare.coreColumn)

onMounted(() => {
  if (dataShare.hasData && rows.value.length === 0) {
    importGlobalExcel()
  }
})

function importGlobalExcel() {
  headers.value = [...dataShare.headers]
  rows.value = dataShare.rows.map(r => [...r])
  runPipeline()
}

// 监听全局核心列变动，重新运行清洗 Pipeline
watch(() => dataShare.coreColumn, () => {
  runPipeline()
})

function disconnectGlobalExcel() {
  dataShare.clearSharedData()
  reset()
}

const configFileRef = ref(null)

const settings = useSettingsStore()
const rulesConfig = computed(() => settings.rulesConfig)

// 监听全局清洗配置变动，自动重新运行 Pipeline
watch(() => settings.rulesConfig, () => {
  runPipeline()
}, { deep: true })

// 规则配置折叠状态
const expandedRules = reactive({
  duplicate: false,
  tooShort: false,
  topicOnly: false,
  shortMeaningless: false,
  adLink: false,
  garbledText: false
})

// 经过 Pipeline 清洗打标后的所有数据
const cleanedRows = ref([])
// 缓存在非响应式下全表运行统计的数值
const fullStats = ref({ keep: 0, delete: 0, suspect: 0 })

const hasData = computed(() => rows.value.length > 0)
const totalCount = computed(() => rows.value.length)
const displayCleanedRows = computed(() => cleanedRows.value) // cleanedRows 内部已经做过 slice(0, 100)

// 自定义筛选相关状态
const smartFilterInput = ref('')
const isGeneratingFilter = ref(false)
const showAddFilterForm = ref(false)
const editingFilter = ref(null)

const customFiltersCount = computed(() => (settings.rulesConfig.customFilters || []).filter(f => f.enabled).length)

function describeFilter(filter) {
  const c = filter.config || {}
  const colName = (c.column != null && c.column >= 0) ? (headers.value[c.column] || `列${c.column}`) : '目标列'
  const typeMap = {
    textContains: () => `${colName} 包含: ${(c.keywords || []).join(', ')}`,
    textNotContains: () => `${colName} 不包含: ${(c.keywords || []).join(', ')}`,
    textEquals: () => `${colName} 等于: ${c.value}`,
    regexMatch: () => `${colName} 正则: ${c.pattern}`,
    textLength: () => `${colName} 长度 ${c.operator} ${c.value}`,
    columnEquals: () => `${colName} = ${(c.values || []).join('/') || c.value}`,
    columnGt: () => `${colName} > ${c.value}`,
    columnLt: () => `${colName} < ${c.value}`
  }
  return (typeMap[filter.type] || (() => ''))()
}

async function generateSmartFilter() {
  const input = smartFilterInput.value.trim()
  if (!input || isGeneratingFilter.value) return
  const s = useSettingsStore()
  if (!s.isConfigured) { s.showSettings = true; toast.warn('请先配置 API 密钥'); return }
  if (!rows.value.length) { toast.warn('请先上传数据'); return }

  isGeneratingFilter.value = true
  try {
    // 收集每列的样例值（前20行）
    const allColumnSamples = {}
    for (let c = 0; c < headers.value.length; c++) {
      allColumnSamples[c] = rows.value.slice(0, 20).map(r => r[c] != null ? String(r[c]) : '')
    }
    const prompt = getSmartFilterPrompt(input, headers.value, sourceCol.value, allColumnSamples, rulesMeta)
    const raw = await callAI(prompt, '你是一个数据清洗专家。', s.getApiConfig().workModel)

    let cleaned = raw.trim().replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim()
    const startIdx = cleaned.indexOf('{')
    const endIdx = cleaned.lastIndexOf('}')
    if (startIdx !== -1 && endIdx > startIdx) cleaned = cleaned.substring(startIdx, endIdx + 1)
    const parsed = JSON.parse(cleaned)

    // 应用内置规则配置
    if (parsed.builtinConfig) {
      const bc = parsed.builtinConfig
      if (bc.rulesToEnable) bc.rulesToEnable.forEach(k => { if (settings.rulesConfig[k]) settings.rulesConfig[k].enable = true })
      if (bc.rulesToDisable) bc.rulesToDisable.forEach(k => { if (settings.rulesConfig[k]) settings.rulesConfig[k].enable = false })
      if (bc.paramOverrides) {
        for (const [key, overrides] of Object.entries(bc.paramOverrides)) {
          if (settings.rulesConfig[key]) Object.assign(settings.rulesConfig[key], overrides)
        }
      }
    }

    // 添加自定义规则
    if (parsed.customFilters?.length) {
      for (const cf of parsed.customFilters) {
        if (!settings.rulesConfig.customFilters) settings.rulesConfig.customFilters = []
        settings.rulesConfig.customFilters.push({
          id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: cf.name || 'AI 生成规则',
          type: cf.type,
          enabled: true,
          policy: cf.policy || 'delete',
          config: cf.config || {}
        })
      }
    }

    smartFilterInput.value = ''
    runPipeline()
  } catch (err) {
    toast.error('AI 生成筛选规则失败: ' + err.message)
  } finally {
    isGeneratingFilter.value = false
  }
}

function removeCustomFilter(filterId) {
  if (!settings.rulesConfig.customFilters) return
  const idx = settings.rulesConfig.customFilters.findIndex(f => f.id === filterId)
  if (idx !== -1) {
    settings.rulesConfig.customFilters.splice(idx, 1)
    runPipeline()
  }
}

function editCustomFilter(filter) {
  editingFilter.value = { ...filter, config: { ...filter.config } }
  showAddFilterForm.value = true
}

function handleSaveFilter(filterData) {
  if (!settings.rulesConfig.customFilters) settings.rulesConfig.customFilters = []
  if (editingFilter.value) {
    const idx = settings.rulesConfig.customFilters.findIndex(f => f.id === editingFilter.value.id)
    if (idx !== -1) {
      settings.rulesConfig.customFilters[idx] = { ...filterData, id: editingFilter.value.id }
    }
    editingFilter.value = null
  } else {
    settings.rulesConfig.customFilters.push({
      ...filterData,
      id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    })
  }
  showAddFilterForm.value = false
  runPipeline()
}

// 统计被启用的规则数
const enabledRulesCount = computed(() => {
  let count = 0
  const cfg = settings.rulesConfig
  if (cfg.empty?.enable) count++
  if (cfg.tooShort?.enable) count++
  if (cfg.duplicate?.enable) count++
  if (cfg.pureEmoji?.enable) count++
  if (cfg.pureSymbol?.enable) count++
  if (cfg.linkOnly?.enable) count++
  if (cfg.topicOnly?.enable) count++
  if (cfg.shortMeaningless?.enable) count++
  if (cfg.adLink?.enable) count++
  if (cfg.garbledText?.enable) count++
  return count
})

// 流式打标决策汇总指标指向 fullStats 响应式缓存
const stats = computed(() => fullStats.value)

// 规则源信息列表
const rulesMeta = [
  { key: 'tooShort', title: '字数过短过滤', description: '过滤除标点外核心有效字符数少于指定长度的简短无意义单元格。', isWeak: false },
  { key: 'duplicate', title: '全表精确去重', description: '重复文本数量达到指定阈值时，自动将除首条外的所有重复行标记为删除。', isWeak: false },
  { key: 'empty', title: '空文本过滤', description: '标准化后字符为空的单元格自动删除。', isWeak: false },
  { key: 'pureEmoji', title: '纯表情过滤', description: '内容全部由表情符号(Emoji)构成的行自动标记为删除。', isWeak: false },
  { key: 'pureSymbol', title: '纯标点符号过滤', description: '去除空格后全是非字母数字及中文汉字的标点/杂乱字符时标记为删除。', isWeak: false },
  { key: 'linkOnly', title: '纯网址链接过滤', description: '内容为单独一个 HTTP/HTTPS/短链网址 of 行标记为删除。', isWeak: false },
  { key: 'topicOnly', title: '纯话题过滤', description: '包含一个或多个微博/贴吧话题（#话题内容#），但非话题文本比率极低时过滤。', isWeak: false },
  { key: 'shortMeaningless', title: '无意义短词过滤', description: '精确匹配水贴词汇（如：哈哈、打卡、顶、赞、支持），清除无营养灌水信息。', isWeak: false },
  { key: 'adLink', title: '引流广告过滤', description: '匹配微商、客服引流关键字。若含链接则直接强删，仅有关键字则转入“待确认”或删除。', isWeak: true },
  { key: 'garbledText', title: '疑似乱码清洗', description: '统计文本中包含的非汉字英数常规符号占比，超出判定阈值即怀疑为乱码。', isWeak: true }
]

function toggleRuleExpand(key) {
  expandedRules[key] = !expandedRules[key]
}

// 关键词解析辅助
function handlePhrasesInput() {
  const cfg = settings.rulesConfig
  const raw = cfg.shortMeaningless.phrasesStr || ''
  cfg.shortMeaningless.phrases = raw.split(/[,，\n]/).map(x => x.trim()).filter(Boolean)
  runPipeline()
}

function handleKeywordsInput() {
  const cfg = settings.rulesConfig
  const raw = cfg.adLink.keywordsStr || ''
  cfg.adLink.keywords = raw.split(/[,，\n]/).map(x => x.trim()).filter(Boolean)
  runPipeline()
}

// 执行打标判定与全量统计
function runPipeline() {
  if (!rows.value.length) return
  // 仅对前 100 行原始数据进行预览清洗打标，这保证了极速渲染和 0 内存开销！
  const previewRows = rows.value.slice(0, 100)
  cleanedRows.value = runCleaningPipeline(previewRows, headers.value, sourceCol.value, settings.rulesConfig)
  
  // 极速计算全表的真实指标统计（Stats）
  calculateFullStats()
}

// 快速运行全表清洗统计 (非响应式，耗时极短，绝不卡死)
function calculateFullStats() {
  if (!rows.value.length) {
    fullStats.value = { keep: 0, delete: 0, suspect: 0 }
    return
  }
  const fullResult = runCleaningPipeline(rows.value, headers.value, sourceCol.value, settings.rulesConfig)
  let keep = 0
  let del = 0
  let suspect = 0
  fullResult.forEach(r => {
    if (r.decision === 'keep') keep++
    if (r.decision === 'delete') del++
    if (r.decision === 'suspect') suspect++
  })
  fullStats.value = { keep, delete: del, suspect }
}

// 文件加载处理
async function handleFile(file) {
  try {
    const data = await readFile(file)
    headers.value = data.headers.map(String)
    rows.value = data.rows
    
    // 直接同步到全局，全局会自动判断核心处理列 (传递 true 启用首次推荐)
    dataShare.setSharedData(headers.value, rows.value, file.name, true)
    
    runPipeline()
  } catch (err) { toast.error(err.message) }
}

// 启发式选择需要清洗的列
function heuristicDetectCleanColumn(headersList, rowsList) {
  if (!rowsList || rowsList.length === 0) return 0
  let bestColIdx = 0
  let maxAvgLength = 0
  const sampleRows = rowsList.slice(0, 15)
  for (let c = 0; c < headersList.length; c++) {
    let totalLen = 0
    let count = 0
    sampleRows.forEach(row => {
      if (row[c] != null) {
        totalLen += String(row[c]).trim().length
        count++
      }
    })
    const avg = count > 0 ? (totalLen / count) : 0
    if (avg > maxAvgLength) {
      maxAvgLength = avg
      bestColIdx = c
    }
  }
  return bestColIdx
}

// 加载包含各种垃圾特征的高价值 Demo 数据
function loadDemo() {
  headers.value = ['序号', '用户ID', '评论内容']
  rows.value = [
    ['1', 'User_001', '商品收到，质量非常好，非常喜欢！'],
    ['2', 'User_002', '[赞][赞][赞][赞][赞][赞][赞][赞][赞][赞]  [赞][赞][赞][赞][赞][赞][赞][赞][赞][赞]'], // 文字表情
    ['3', 'User_003', '    '], // 空白
    ['4', 'User_004', 'http://t.cn/abcde'], // 纯网址
    ['5', 'User_005', '666'], // 短无意义
    ['6', 'User_006', '加微信领取优惠大礼包，微信号 abc123456'], // 广告引流
    ['7', 'User_007', '#年中大促# #新机首发# 非常期待这款手机的性能！'], // 话题
    ['8', 'User_008', '商品收到，质量非常好，非常喜欢！'], // 重复行 1
    ['9', 'User_009', '商品收到，质量非常好，非常喜欢！'], // 重复行 2
    ['10', 'User_010', '商品收到，质量非常好，非常喜欢！'], // 重复行 3
    ['11', 'User_011', 'ä½ å¥½å•Šæ•°æ ®æ¸…æ´—ä¹±ç  '], // 乱码
    ['12', 'User_012', '东西还不错，物流也挺快的，包装完整。'],
    ['13', 'User_013', '[打call]'], // 文字表情 2
    ['14', 'User_014', '求'], // 字数过短过滤 (有效长度 1)
    ['15', 'User_015', '-'], // 无意义字符 (有效长度 0)
    ['16', 'User_016', '感觉一般，没有想象中好用，退货了。']
  ]
  sourceCol.value = 2 // 默认清洗评论内容列
  runPipeline()
}

function reset() {
  headers.value = []
  rows.value = []
  cleanedRows.value = []
}

// 用户手动进行决策覆写
function overwriteDecision(index, targetDecision) {
  if (cleanedRows.value[index]) {
    const prevDecision = cleanedRows.value[index].decision
    const cur = cleanedRows.value[index].decision
    let nextDecision = ''
    
    if (cur === targetDecision) {
      nextDecision = 'keep'
      cleanedRows.value[index].decision = 'keep' // 再次点击取消覆盖，变回保留
      cleanedRows.value[index].hitRule = 'user_reset'
      cleanedRows.value[index].reason = '用户重置为保留'
    } else {
      nextDecision = targetDecision
      cleanedRows.value[index].decision = targetDecision
      cleanedRows.value[index].hitRule = 'user_override'
      cleanedRows.value[index].reason = targetDecision === 'keep' ? '用户强制保留' : '用户强制删除'
    }
    
    // 微调差值实时更新统计面板（避免触发 CPU 全量重新计算）
    if (prevDecision !== nextDecision) {
      if (fullStats.value[prevDecision] > 0) {
        fullStats.value[prevDecision]--
      }
      fullStats.value[nextDecision]++
    }
  }
}

// 重置所有用户覆写，恢复为 Pipeline 原始判定
function resetAllOverrides() {
  runPipeline()
  toast.success('已重置所有覆写，恢复为 AI 原始判定')
}

// UI 样式控制辅助
function rowClass(decision) {
  if (decision === 'delete') return 'bg-rose-50/20 text-rose-700/90'
  if (decision === 'suspect') return 'bg-amber-50/20 text-amber-700/90'
  return 'hover:bg-slate-50/50'
}

function statusBadgeClass(decision) {
  if (decision === 'delete') return 'bg-rose-100 text-rose-800'
  if (decision === 'suspect') return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
}

function statusLabel(decision) {
  if (decision === 'delete') return '已删除'
  if (decision === 'suspect') return '待确认'
  return '保留'
}

function ruleClass(decision) {
  if (decision === 'delete') return 'text-rose-600 bg-rose-50 px-1 py-0.5 rounded'
  if (decision === 'suspect') return 'text-amber-600 bg-amber-50 px-1 py-0.5 rounded'
  return 'text-slate-400 bg-slate-100 px-1 py-0.5 rounded'
}

// 导出清洗后健康数据 (仅保留行)
function exportCleanedOnly() {
  if (!rows.value.length) return
  // 全量在内存中快速跑判定，不带 Vue 响应式代理开销
  const fullResult = runCleaningPipeline(rows.value, headers.value, sourceCol.value, settings.rulesConfig)
  
  // 覆盖前 100 行中用户手动标记的覆写结果
  cleanedRows.value.forEach((previewRow, idx) => {
    if (previewRow.hitRule === 'user_override' || previewRow.hitRule === 'user_reset') {
      fullResult[idx].decision = previewRow.decision
      fullResult[idx].hitRule = previewRow.hitRule
      fullResult[idx].reason = previewRow.reason
    }
  })
  
  const expHeaders = [...headers.value]
  const expRows = fullResult
    .filter(r => r.decision === 'keep')
    .map(r => r.originalRow)
  exportToXlsx(expHeaders, expRows, '干净清洗数据.xlsx')
}

// 导出完整审计报表 (含标准化文本、状态、命中原因)
function exportFullAudit() {
  if (!rows.value.length) return
  const fullResult = runCleaningPipeline(rows.value, headers.value, sourceCol.value, settings.rulesConfig)
  
  // 覆盖前 100 行中用户手动标记的覆写结果
  cleanedRows.value.forEach((previewRow, idx) => {
    if (previewRow.hitRule === 'user_override' || previewRow.hitRule === 'user_reset') {
      fullResult[idx].decision = previewRow.decision
      fullResult[idx].hitRule = previewRow.hitRule
      fullResult[idx].reason = previewRow.reason
    }
  })
  
  const expHeaders = [...headers.value, '标准化文本', '清洗决策状态', '判定原因描述']
  const expRows = fullResult.map(r => {
    const label = statusLabel(r.decision)
    const padded = [...r.originalRow]
    while (padded.length < headers.value.length) padded.push('')
    padded.push(r.normalizedText, label, `${r.hitRule} (${r.reason})`)
    return padded
  })
  exportToXlsx(expHeaders, expRows, '数据清洗审计报表.xlsx')
}

// 共享清洗结果并跳转
function shareDataTo(targetPath) {
  if (!rows.value.length) return
  
  // 全量在内存中跑判定
  const fullResult = runCleaningPipeline(rows.value, headers.value, sourceCol.value, settings.rulesConfig)
  
  // 覆盖前 100 行用户手动修改的覆写结果
  cleanedRows.value.forEach((previewRow, idx) => {
    if (previewRow.hitRule === 'user_override' || previewRow.hitRule === 'user_reset') {
      fullResult[idx].decision = previewRow.decision
      fullResult[idx].hitRule = previewRow.hitRule
      fullResult[idx].reason = previewRow.reason
    }
  })
  
  // 提取保留的数据
  const cleanHeaders = [...headers.value]
  const cleanRows = fullResult
    .filter(r => r.decision === 'keep')
    .map(r => r.originalRow)
    
  // 存入 store 共享
  dataShare.setSharedData(cleanHeaders, cleanRows, '清洗后数据')
  
  showShareMenu.value = false
  // 跳转到目标页面
  router.push(targetPath)
}

// 应用清洗结果至全局 Excel Store
function applyToGlobal() {
  if (!rows.value.length) return
  
  // 全量在内存中跑判定
  const fullResult = runCleaningPipeline(rows.value, headers.value, sourceCol.value, settings.rulesConfig)
  
  // 覆盖前 100 行中用户手动标记的覆写结果
  cleanedRows.value.forEach((previewRow, idx) => {
    if (previewRow.hitRule === 'user_override' || previewRow.hitRule === 'user_reset') {
      fullResult[idx].decision = previewRow.decision
      fullResult[idx].hitRule = previewRow.hitRule
      fullResult[idx].reason = previewRow.reason
    }
  })
  
  // 提取保留的数据
  const cleanHeaders = [...headers.value]
  const cleanRows = fullResult
    .filter(r => r.decision === 'keep')
    .map(r => r.originalRow)
    
  // 更新到全局 Store 共享
  dataShare.setSharedData(cleanHeaders, cleanRows, dataShare.sourceName || '已清洗数据.xlsx')
  
  toast.success('清洗后的健康数据已成功应用至全局 Excel！现在您可以直接切换到批量翻译或评论分析进行下一步处理。')
}

// 导出当前配置 JSON (兼容导出全局整包配置)
function exportConfig() {
  settings.exportGlobalConfig()
}

// 触发隐藏的文件 input 点击
function importConfigTrigger() {
  if (configFileRef.value) {
    configFileRef.value.click()
  }
}

// 处理导入的配置 JSON 文件 (兼容旧版本仅规则 JSON 或新版本整包配置 JSON)
function handleImportConfig(e) {
  const file = e.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result)
      let success = false
      
      if (parsed.rulesConfig) {
        // 全局配置导入
        success = settings.importGlobalConfig(parsed)
      } else if (parsed.tooShort && parsed.duplicate && parsed.shortMeaningless) {
        // 老版本纯清洗配置导入
        Object.assign(settings.rulesConfig, parsed)
        success = true
      }
      
      if (success) {
        toast.success('导入规则配置成功！已应用并重新运行数据清洗。')
        runPipeline()
      } else {
        toast.error('导入失败：非法的规则配置文件格式')
      }
    } catch (err) {
      toast.error('导入配置解析失败: ' + err.message)
    }
    e.target.value = ''
  }
  reader.readAsText(file)
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>

