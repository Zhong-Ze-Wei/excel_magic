<template>
  <!-- ===== 移动端模板 ===== -->
  <div v-if="isMobile" :class="PAGE.mobile + ' animate-fade-in'">
    <PageHeader :icon="Eraser" theme="clean" title="数据清洗" subtitle="10 条原子规则 + 自定义列级过滤，逐行决策保留或删除。" />
    <!-- 全局关联横幅（带折叠表格预览） -->
    <GlobalDataBanner
      :visible="hasData && dataShare.hasData"
      :source-name="dataShare.sourceName"
      :headers="headers"
      :rows="rows"
      :mobile="true"
      @disconnect="disconnectGlobalExcel"
    />

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
      <!-- 清洗分布饼图 -->
      <StatsPieChart :data="chartData" :height="180" />
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
              <button @click="shareDataTo('/process')" class="w-full text-left px-3 py-2 active:bg-slate-50 text-slate-700 border-b border-slate-100">智能加工</button>
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
      :labeling-results="dataShare.labelingResults"
      @save="handleSaveFilter"
      @cancel="showAddFilterForm = false; editingFilter = null" />
  </div>

  <!-- ===== 桌面端模板（原样保留）===== -->
  <div v-else :class="PAGE.desktop">
    <PageHeader :icon="Eraser" theme="clean" title="数据清洗"
      subtitle="10 条原子规则 + 自定义列级过滤，逐行决策保留或删除。" />
    <!-- 全局关联横幅（带折叠表格预览） -->
    <GlobalDataBanner
      :visible="hasData && dataShare.hasData"
      :source-name="dataShare.sourceName"
      :headers="headers"
      :rows="rows"
      @disconnect="disconnectGlobalExcel"
    />

    <div :class="TWO_COL.grid">
      <!-- Left Panel: Rules Configuration -->
      <div :class="TWO_COL.left">
        <FileUploader v-if="!hasData" label="上传需要清洗的 Excel/CSV 文件" :icon="Eraser" iconBg="bg-orange-50" iconColor="text-orange-600" @file="handleFile" />
        <button v-if="!hasData" @click="loadDemo"
          class="w-full mt-2 py-2 bg-white hover:bg-orange-50 border border-orange-200 text-orange-600 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5">
          <RefreshCw class="w-3.5 h-3.5" /> 加载电商评论示例
        </button>

        <CleaningRulesPanel v-if="hasData"
          :headers="headers"
          :rules-meta="rulesMeta"
          :expanded-rules="expandedRules"
          :enabled-rules-count="enabledRulesCount"
          :custom-filters-count="customFiltersCount"
          :smart-filter-input="smartFilterInput"
          :is-generating-filter="isGeneratingFilter"
          :describe-filter="describeFilter"
          @run-pipeline="runPipeline"
          @toggle-rule-expand="toggleRuleExpand"
          @handle-phrases-input="handlePhrasesInput"
          @handle-keywords-input="handleKeywordsInput"
          @generate-smart-filter="generateSmartFilter"
          @edit-custom-filter="editCustomFilter"
          @remove-custom-filter="removeCustomFilter"
          @import-config="handleImportConfig"
          @export-config="exportConfig"
          @reset="reset"
          @show-add-filter-form="editingFilter = null; showAddFilterForm = true"
          @update:smart-filter-input="val => smartFilterInput = val"
        />
      </div>

      <!-- Right Panel: Data Preview & Audit Table -->
      <div :class="TWO_COL.right">
        <!-- Empty State -->
        <div v-if="!hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center text-slate-400">
          <Eraser class="w-16 h-16 mb-4 opacity-30 text-orange-500" />
          <h3 class="font-bold text-slate-700 text-sm">暂无数据</h3>
          <p class="text-xs text-slate-400 mt-1 max-w-sm text-center">
            请在左侧上传您的 Excel/CSV 表格，或者点击左侧按钮一键加载极具针对性的脏数据评论样本进行体验。
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

        <!-- 清洗分布饼图 -->
        <div v-if="hasData" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-fade-in">
          <h3 class="text-xs font-bold text-slate-700 mb-3">数据清洗分布</h3>
          <StatsPieChart :data="chartData" :height="220" />
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
                  <button @click="shareDataTo('/process')" class="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center justify-between border-b border-slate-100">
                    <span>智能加工 ➡️</span>
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
          <CleaningAuditTable
            :rows="displayCleanedRows"
            @overwrite="({ index, decision }) => overwriteDecision(index, decision)"
          />
        </div>

      </div>
    </div>

    <!-- 自定义筛选规则编辑弹窗 -->
    <CustomFilterForm v-if="showAddFilterForm"
      :filter="editingFilter"
      :headers="headers"
      :labeling-results="dataShare.labelingResults"
      @save="handleSaveFilter"
      @cancel="showAddFilterForm = false; editingFilter = null" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useExport } from '../composables/useExport'
import { useShare } from '../composables/useShare'
import { useCleaningPipeline } from '../composables/useCleaningPipeline'
import { Eraser, Download, Check, X, RefreshCw, Sparkles, Plus, Pencil, RotateCcw } from 'lucide-vue-next'
import FileUploader from '../components/common/FileUploader.vue'
import CleaningRulesPanel from '../components/cleaning/CleaningRulesPanel.vue'
import CustomFilterForm from '../components/cleaning/CustomFilterForm.vue'
import CleaningAuditTable from '../components/cleaning/CleaningAuditTable.vue'
import GlobalDataBanner from '../components/common/GlobalDataBanner.vue'
import PageHeader from '../components/common/PageHeader.vue'
import { PAGE, TWO_COL } from '../styles/tokens'
import MobileCollapsible from '../components/common/MobileCollapsible.vue'
import MobileTableWrapper from '../components/common/MobileTableWrapper.vue'
import StatsPieChart from '../components/common/StatsPieChart.vue'
import { runCleaningPipeline, ATOMIC_RULES_META as rulesMeta } from '../services/cleaningRules'
import { useDataShareStore } from '../stores/dataShare'
import { useSettingsStore } from '../stores/settings'
import { useDevice } from '../composables/useDevice'
import { useGlobalDataSync } from '../composables/useGlobalDataSync'
import { useFileUpload } from '../composables/useFileUpload'
import { DEMO_DATA } from '../data/demoData'
import { useDatasetTask } from '../composables/useDatasetTask'
import { callAI } from '../services/ai'
import { getSmartFilterPrompt } from '../services/prompts'
import { parseRobustJSON } from '../services/jsonParser'
import { useToast } from '../services/toast'
import { normalizeRulesConfig } from '../config/settingsConfig'

const toast = useToast()
const dataShare = useDataShareStore()
const { isMobile } = useDevice()
const showShareMenu = ref(false)

const { headers, rows, hasData, importGlobalExcel, disconnectGlobalExcel } = useGlobalDataSync({
  onInit: () => { runPipeline() }
})

const { exportData } = useExport({ rows, headers })
const { shareTo, applyToGlobal: applyGlobal } = useShare({ rows, headers, importGlobalExcel })

const { handleFile } = useFileUpload({
  onFileLoaded: () => { runPipeline() }
})

const sourceCol = computed(() => dataShare.coreColumn)

// 监听全局核心列变动，重新运行清洗 Pipeline
watch(() => dataShare.coreColumn, () => {
  runPipeline()
})

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

// 清洗管道：预览前 100 行 + 全量统计（专家模式）
const { cleanedRows, fullStats, runPipeline, clear: clearCleaned } = useCleaningPipeline({
  headers, rows, sourceCol,
  getConfig: () => settings.rulesConfig,
  getLabelingResults: () => dataShare.labelingResults,
  previewLimit: 100
})

const totalCount = computed(() => rows.value.length)
const displayCleanedRows = computed(() => cleanedRows.value) // cleanedRows 内部已经做过 slice(0, 100)

// 自定义筛选相关状态
const smartFilterInput = ref('')
const filterTask = useDatasetTask()
const isGeneratingFilter = filterTask.isRunning
const showAddFilterForm = ref(false)
const editingFilter = ref(null)
watch(() => dataShare.datasetVersion, () => {
  smartFilterInput.value = ''
  showAddFilterForm.value = false
  editingFilter.value = null
})

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

  try {
    // 收集每列的样例值（前20行）
    const allColumnSamples = {}
    for (let c = 0; c < headers.value.length; c++) {
      allColumnSamples[c] = rows.value.slice(0, 20).map(r => r[c] != null ? String(r[c]) : '')
    }
    const prompt = getSmartFilterPrompt(input, headers.value, sourceCol.value, allColumnSamples, rulesMeta)
    const raw = await filterTask.run(({ signal }) => callAI(prompt, '你是一个数据清洗专家。', s.getApiConfig().workModel, { signal }))
    if (raw === undefined || input !== smartFilterInput.value.trim()) return

    const parsed = parseRobustJSON(raw)
    if (!parsed || typeof parsed !== 'object') throw new Error('AI 返回的筛选配置无效')
    const nextConfig = JSON.parse(JSON.stringify(settings.rulesConfig))

    // 应用内置规则配置
    if (parsed.builtinConfig) {
      const bc = parsed.builtinConfig
      if (bc.rulesToEnable) bc.rulesToEnable.forEach(k => { if (nextConfig[k]) nextConfig[k].enable = true })
      if (bc.rulesToDisable) bc.rulesToDisable.forEach(k => { if (nextConfig[k]) nextConfig[k].enable = false })
      if (bc.paramOverrides) {
        for (const [key, overrides] of Object.entries(bc.paramOverrides)) {
          if (nextConfig[key]) Object.assign(nextConfig[key], overrides)
        }
      }
    }

    // 添加自定义规则
    if (parsed.customFilters?.length) {
      for (const cf of parsed.customFilters) {
        nextConfig.customFilters.push({
          id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: cf.name || 'AI 生成规则',
          type: cf.type,
          enabled: true,
          policy: cf.policy || 'delete',
          config: cf.config || {}
        })
      }
    }

    settings.rulesConfig = normalizeRulesConfig(nextConfig)
    smartFilterInput.value = ''
    runPipeline()
  } catch (err) {
    toast.error('AI 生成筛选规则失败: ' + err.message)
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

const chartData = computed(() => [
  { name: '保留', value: stats.value.keep, color: '#10b981' },
  { name: '过滤', value: stats.value.delete, color: '#f43f5e' },
  { name: '待确认', value: stats.value.suspect, color: '#f59e0b' }
])

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

// 文件加载处理
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

// 加载各模块共用的电商评论示例。
function loadDemo() {
  const demo = DEMO_DATA.comments
  dataShare.setSharedData(demo.headers, demo.rows, demo.name)
  dataShare.setCoreColumn(demo.coreColumn)
  importGlobalExcel()
  runPipeline()
}

function reset() {
  disconnectGlobalExcel()
  clearCleaned()
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
function statusLabel(decision) {
  if (decision === 'delete') return '已删除'
  if (decision === 'suspect') return '待确认'
  return '保留'
}

function rowClass(decision) {
  return decision === 'delete' ? 'bg-rose-50/20 text-rose-700/90' : decision === 'suspect' ? 'bg-amber-50/20 text-amber-700/90' : ''
}

function statusBadgeClass(decision) {
  return decision === 'delete' ? 'bg-rose-100 text-rose-800' : decision === 'suspect' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
}

function ruleClass(decision) {
  return decision === 'delete' ? 'text-rose-600' : decision === 'suspect' ? 'text-amber-600' : 'text-slate-400'
}

// 运行全量清洗 Pipeline 并应用用户覆写
function getCleanedFullResult() {
  const fullResult = runCleaningPipeline(rows.value, headers.value, sourceCol.value, settings.rulesConfig, dataShare.labelingResults)
  cleanedRows.value.forEach((previewRow, idx) => {
    if (previewRow.hitRule === 'user_override' || previewRow.hitRule === 'user_reset') {
      fullResult[idx].decision = previewRow.decision
      fullResult[idx].hitRule = previewRow.hitRule
      fullResult[idx].reason = previewRow.reason
    }
  })
  return fullResult
}

function getCleanRows() {
  return getCleanedFullResult()
    .filter(r => r.decision === 'keep')
    .map(r => r.originalRow)
}

function exportCleanedOnly() {
  exportData(() => getCleanRows(), '干净清洗数据.xlsx')
}

function exportFullAudit() {
  exportData(() => {
    return getCleanedFullResult().map(r => {
      const padded = [...r.originalRow]
      while (padded.length < headers.value.length) padded.push('')
      padded.push(r.normalizedText, statusLabel(r.decision), `${r.hitRule} (${r.reason})`)
      return padded
    })
  }, '数据清洗审计报表.xlsx', () => [...headers.value, '标准化文本', '清洗决策状态', '判定原因描述'])
}

function shareDataTo(targetPath) {
  shareTo(() => ({ headers: [...headers.value], rows: getCleanRows() }), targetPath, '清洗后数据')
  showShareMenu.value = false
}

function applyToGlobal() {
  applyGlobal(() => ({ headers: [...headers.value], rows: getCleanRows() }), dataShare.sourceName || '已清洗数据.xlsx')
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
      const success = settings.importGlobalConfig(parsed)
      
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

