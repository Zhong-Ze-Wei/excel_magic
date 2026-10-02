<template>
  <Teleport to="body">
    <div v-if="settings.showSettings" class="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-sm"
      :class="isMobile ? 'items-stretch' : 'flex items-center justify-center'" @click.self="settings.showSettings = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full overflow-hidden animate-fade-in flex flex-col"
        :class="isMobile ? 'h-full rounded-none' : 'max-w-2xl h-[620px] max-h-[90vh]'">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Settings2 class="w-5 h-5 text-blue-600" /> 系统设置中心
            </h3>
            <p class="text-[11px] text-slate-400 mt-0.5">配置 API 接口与 AI 自动行为</p>
          </div>
          <button @click="settings.showSettings = false" aria-label="关闭设置" class="text-slate-400 hover:text-slate-600 transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Tabs Navigation -->
        <div class="px-6 border-b border-slate-100 flex gap-6 bg-slate-50/50">
          <button @click="activeTab = 'api'"
            class="py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5"
            :class="activeTab === 'api' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'">
            <Key class="w-3.5 h-3.5" /> API 密钥与模型
          </button>
          <button @click="activeTab = 'insight'"
            class="py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5"
            :class="activeTab === 'insight' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'">
            <Lightbulb class="w-3.5 h-3.5" /> AI 行为
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <!-- Tab 1: API Configuration -->
          <div v-show="activeTab === 'api'" class="space-y-5 animate-fade-in">
            <!-- Platform Selection -->
            <div class="grid gap-4" :class="isMobile ? 'grid-cols-1' : 'grid-cols-2'">
              <div v-for="(config, key) in settings.API_PLATFORMS" :key="key"
                @click="draft.apiPlatform = key"
                class="cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center text-center transition-all relative"
                :class="draft.apiPlatform === key
                  ? (key === 'siliconflow' ? 'border-blue-500 bg-blue-50/50' : 'border-purple-500 bg-purple-50/50')
                  : 'border-transparent bg-slate-50 hover:bg-slate-100/85'">
                <CheckCircle2 v-if="draft.apiPlatform === key" class="absolute top-2 right-2 w-5 h-5"
                  :class="key === 'siliconflow' ? 'text-blue-600' : 'text-purple-600'" />
                <span class="font-bold text-slate-800" :class="draft.apiPlatform === key ? (key === 'siliconflow' ? 'text-blue-700' : 'text-purple-700') : 'text-slate-700'">
                  {{ config.name }}
                </span>
                <span class="text-[10px] text-slate-400 mt-1">{{ key === 'siliconflow' ? 'SiliconCloud 平台' : 'AI 聚合开放平台' }}</span>
              </div>
            </div>

            <!-- Dynamic Config fields -->
            <div v-for="(config, key) in settings.API_PLATFORMS" :key="'cfg-'+key" v-show="draft.apiPlatform === key" class="space-y-5">
              <!-- Promo Banner -->
              <div class="rounded-xl p-4 border" :class="key === 'siliconflow' ? 'bg-blue-50/50 border-blue-100 text-blue-800' : 'bg-purple-50/50 border-purple-100 text-purple-800'">
                <div class="flex items-start gap-3">
                  <div class="p-2 rounded-lg" :class="key === 'siliconflow' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'">
                    <Gift class="w-5 h-5" />
                  </div>
                  <div>
                    <h4 class="text-xs font-bold mb-1">
                      {{ key === 'siliconflow' ? '新用户福利 — 送14元额度' : '平台福利 — 顶级模型免费高速用' }}
                    </h4>
                    <div class="flex items-center gap-3">
                      <a :href="config.registerUrl" target="_blank"
                        class="text-[10px] text-white px-2.5 py-1 rounded-md font-medium transition-colors"
                        :class="key === 'siliconflow' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'">
                        立即注册获取
                      </a>
                      <div class="flex items-center gap-2 bg-white px-2 py-0.5 rounded border text-[10px]" :class="key === 'siliconflow' ? 'border-blue-200' : 'border-purple-200'">
                        <span class="text-slate-500">邀请码:</span>
                        <code class="font-mono font-bold" :class="key === 'siliconflow' ? 'text-blue-700' : 'text-purple-700'">{{ config.inviteCode }}</code>
                        <button @click="copyText(config.inviteCode)" class="text-slate-400 hover:text-slate-600">
                          <Copy class="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- API Key -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5">
                  API Key
                  <a :href="config.keyUrl" target="_blank" class="text-[10px] ml-1 hover:underline" :class="key === 'siliconflow' ? 'text-blue-500' : 'text-purple-500'">(获取 Key 链接)</a>
                </label>
                <div class="relative">
                  <input :type="showKey[key] ? 'text' : 'password'" v-model="draft.apiKeys[key]"
                    class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all font-mono text-xs"
                    :class="key === 'siliconflow' ? 'focus:ring-blue-500 focus:border-blue-500' : 'focus:ring-purple-500 focus:border-purple-500'"
                    placeholder="sk-..." />
                  <button @click="showKey[key] = !showKey[key]" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <component :is="showKey[key] ? EyeOff : Eye" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Model Selection -->
              <div class="grid gap-4" :class="isMobile ? 'grid-cols-1' : 'grid-cols-2'">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1.5">翻译专用模型</label>
                  <input v-model="draft.selectedTranslateModel[key]" :list="`translate-list-${key}`"
                    class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 outline-none"
                    :class="key === 'siliconflow' ? 'focus:ring-blue-500' : 'focus:ring-purple-500'"
                    placeholder="选择或输入模型名称" />
                  <datalist :id="`translate-list-${key}`">
                    <option v-for="m in config.translateModels" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </datalist>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1.5">常规分析模型</label>
                  <input v-model="draft.selectedWorkModel[key]" :list="`work-list-${key}`"
                    class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 outline-none"
                    :class="key === 'siliconflow' ? 'focus:ring-blue-500' : 'focus:ring-purple-500'"
                    placeholder="选择或输入模型名称" />
                  <datalist :id="`work-list-${key}`">
                    <option v-for="m in config.workModels" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </datalist>
                </div>
              </div>
            </div>

            <!-- Concurrency Setting -->
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2">
              <label class="block text-xs font-bold text-slate-700">AI 并发调用数</label>
              <div class="flex items-center gap-3">
                <input type="range" v-model.number="draft.concurrency" min="1" max="100"
                  class="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                <span class="text-sm font-bold text-slate-800 w-8 text-center font-mono">{{ draft.concurrency }}</span>
              </div>
              <p class="text-[10px] text-slate-400">
                同时发起的 AI 请求数。部分 API 有并发限制，遇到 429 限流会自动降级。
              </p>
            </div>
          </div>


          <!-- Tab 2: AI 行为 -->
          <div v-show="activeTab === 'insight'" class="space-y-5 animate-fade-in">
            <!-- AI 行为开关 -->
            <div class="bg-slate-50 p-5 rounded-xl border border-slate-200/60 space-y-3">
              <label class="block text-xs font-bold text-slate-800">AI 自动行为</label>
              <p class="text-[10px] text-slate-500 leading-relaxed -mt-1">
                控制产品中 AI 自动介入的时机。关闭后对应环节改为手动触发，不消耗 API 额度。
              </p>
              <label class="flex items-center justify-between p-3 rounded-lg border-2 transition-all cursor-pointer"
                :class="draft.autoIntentAnalysis ? 'border-blue-500 bg-blue-50/30' : 'border-transparent bg-white hover:bg-slate-50'">
                <div class="flex items-center gap-2.5">
                  <Sparkles class="w-4 h-4 text-blue-600" />
                  <div>
                    <span class="text-xs font-bold text-slate-700">导入后自动分析表格意图</span>
                    <p class="text-[10px] text-slate-500 mt-0.5 leading-relaxed">上传数据后，AI 自动读取表格快照、推断核心列与任务目标，给出建议。关闭则改为弹窗内手动点击。</p>
                  </div>
                </div>
                <input type="checkbox" v-model="draft.autoIntentAnalysis" class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
              </label>
            </div>
          </div>
        </div>

        <p class="px-6 pb-2 text-[10px] text-slate-500">修改、导入和重置在保存后生效；导出文件包含 API Key，请妥善保管。</p>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center flex-wrap gap-3">
          <!-- Global Config Import/Export -->
          <div class="flex items-center gap-2">
            <input type="file" ref="globalConfigFileRef" accept=".json" class="hidden" @change="handleImportGlobalConfig" />
            <button @click="triggerImport" class="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium transition-colors">
              <Upload class="w-3.5 h-3.5" /> 导入配置
            </button>
            <span class="text-slate-300">|</span>
            <button @click="handleExport" class="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium transition-colors">
              <Download class="w-3.5 h-3.5" /> 导出配置
            </button>
            <span class="text-slate-300">|</span>
            <button @click="handleResetAll" class="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 font-medium transition-colors">
              <RotateCcw class="w-3.5 h-3.5" /> 重置默认
            </button>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-xs" :class="testResult.class" v-show="activeTab === 'api'">{{ testResult.text }}</span>
            <button v-show="activeTab === 'api'" @click="handleTest" :disabled="testing"
              class="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors text-sm">
              {{ testing ? '测试中...' : '测试连接' }}
            </button>
            <button @click="handleSave"
              class="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 text-sm">
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { createDefaultSettings } from '../../config/settingsConfig'
import { testConnection } from '../../services/ai'
import { X, CheckCircle2, Gift, Copy, Eye, EyeOff, Settings2, Key, Download, Upload, RotateCcw, Lightbulb, Sparkles } from 'lucide-vue-next'
import { useToast } from '../../services/toast'
import { useDevice } from '../../composables/useDevice'

const toast = useToast()
const { isMobile } = useDevice()
const settings = useSettingsStore()
const activeTab = ref('api')
const globalConfigFileRef = ref(null)
const draft = ref(settings.getConfigSnapshot())
const resetRequested = ref(false)
const showKey = reactive({ siliconflow: false, aiping: false })
const testing = ref(false)
const testResult = reactive({ text: '', class: '' })

watch(() => settings.showSettings, visible => {
  if (!visible) return
  draft.value = settings.getConfigSnapshot()
  resetRequested.value = false
  testResult.text = ''
})

function copyText(text) {
  navigator.clipboard.writeText(text)
}

async function handleTest() {
  const key = draft.value.apiKeys[draft.value.apiPlatform]
  if (!key) { testResult.text = '请先输入 API Key'; testResult.class = 'text-red-600'; return }
  testing.value = true
  testResult.text = '正在测试...'
  testResult.class = 'text-blue-600 animate-pulse'
  try {
    await testConnection(draft.value.apiPlatform, key)
    testResult.text = '✓ 连接成功！'
    testResult.class = 'text-green-600 font-medium'
  } catch (e) {
    testResult.text = '✗ 连接失败: ' + e.message
    testResult.class = 'text-red-600'
  } finally {
    testing.value = false
  }
}

function handleSave() {
  if (!settings.importGlobalConfig(draft.value)) {
    toast.error('保存失败：请检查模型名称、并发数和规则配置')
    return
  }
  if (resetRequested.value) settings.lastAiConfigAt = null
  settings.showSettings = false
  toast.success('系统设置已成功保存！')
}

function handleExport() {
  const config = settings.prepareConfigImport(draft.value)
  if (!config) { toast.error('导出失败：请先修正无效配置'); return }
  settings.exportGlobalConfig(config)
}

function triggerImport() {
  globalConfigFileRef.value.click()
}

function handleImportGlobalConfig(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = event => {
    try {
      const config = settings.prepareConfigImport(JSON.parse(event.target.result), draft.value)
      if (config) {
        draft.value = config
        toast.success('配置已导入草稿，请保存后生效。')
      } else {
        toast.error('导入失败：非法的备份配置文件结构或字段值')
      }
    } catch (err) {
      toast.error('导入解析失败: ' + err.message)
    }
    e.target.value = ''
  }
  reader.onerror = () => { toast.error('配置文件读取失败'); e.target.value = '' }
  reader.readAsText(file)
}

function handleResetAll() {
  if (!confirm('将全部设置草稿恢复为默认值，包括 API Key、模型、清洗规则、并发和自动分析；保存后才生效。是否继续？')) return
  draft.value = createDefaultSettings()
  resetRequested.value = true
  toast.success('已恢复默认设置草稿，请保存后生效。')
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
