<template>
  <Teleport to="body">
    <div v-if="settings.showSettings" class="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center backdrop-blur-sm" @click.self="settings.showSettings = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[620px] max-h-[90vh] overflow-hidden animate-fade-in flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Settings2 class="w-5 h-5 text-blue-600" /> 系统设置中心
            </h3>
            <p class="text-[11px] text-slate-400 mt-0.5">配置您的 API 接口底座与数据清洗原子规则默认阈值</p>
          </div>
          <button @click="settings.showSettings = false" class="text-slate-400 hover:text-slate-600 transition-colors">
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
          <button @click="activeTab = 'rules'" 
            class="py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5"
            :class="activeTab === 'rules' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'">
            <Eraser class="w-3.5 h-3.5" /> 清洗规则与阈值
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <!-- Tab 1: API Configuration -->
          <div v-show="activeTab === 'api'" class="space-y-5 animate-fade-in">
            <!-- Platform Selection -->
            <div class="grid grid-cols-2 gap-4">
              <div v-for="(config, key) in settings.API_PLATFORMS" :key="key"
                @click="localPlatform = key"
                class="cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center text-center transition-all relative"
                :class="localPlatform === key
                  ? (key === 'siliconflow' ? 'border-blue-500 bg-blue-50/50' : 'border-purple-500 bg-purple-50/50')
                  : 'border-transparent bg-slate-50 hover:bg-slate-100/85'">
                <CheckCircle2 v-if="localPlatform === key" class="absolute top-2 right-2 w-5 h-5"
                  :class="key === 'siliconflow' ? 'text-blue-600' : 'text-purple-600'" />
                <span class="font-bold text-slate-800" :class="localPlatform === key ? (key === 'siliconflow' ? 'text-blue-700' : 'text-purple-700') : 'text-slate-700'">
                  {{ config.name }}
                </span>
                <span class="text-[10px] text-slate-400 mt-1">{{ key === 'siliconflow' ? 'SiliconCloud 平台' : 'AI 聚合开放平台' }}</span>
              </div>
            </div>

            <!-- Dynamic Config fields -->
            <div v-for="(config, key) in settings.API_PLATFORMS" :key="'cfg-'+key" v-show="localPlatform === key" class="space-y-5">
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
                  <input :type="showKey[key] ? 'text' : 'password'" v-model="localKeys[key]"
                    class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 outline-none transition-all font-mono text-xs"
                    :class="key === 'siliconflow' ? 'focus:ring-blue-500 focus:border-blue-500' : 'focus:ring-purple-500 focus:border-purple-500'"
                    placeholder="sk-..." />
                  <button @click="showKey[key] = !showKey[key]" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <component :is="showKey[key] ? EyeOff : Eye" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Model Selection -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1.5">翻译专用模型</label>
                  <input v-model="localTranslateModels[key]" :list="`translate-list-${key}`"
                    class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 outline-none"
                    :class="key === 'siliconflow' ? 'focus:ring-blue-500' : 'focus:ring-purple-500'"
                    placeholder="选择或输入模型名称" />
                  <datalist :id="`translate-list-${key}`">
                    <option v-for="m in config.translateModels" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </datalist>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1.5">常规分析模型</label>
                  <input v-model="localWorkModels[key]" :list="`work-list-${key}`"
                    class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 outline-none"
                    :class="key === 'siliconflow' ? 'focus:ring-blue-500' : 'focus:ring-purple-500'"
                    placeholder="选择或输入模型名称" />
                  <datalist :id="`work-list-${key}`">
                    <option v-for="m in config.workModels" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </datalist>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 2: Cleaning Rules Configurations -->
          <div v-show="activeTab === 'rules'" class="space-y-4 animate-fade-in">
            <!-- Weak Policy setting -->
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2">
              <label class="block text-xs font-bold text-slate-800">弱规则全局过滤策略</label>
              <div class="flex gap-6 mt-1">
                <label class="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="radio" v-model="settings.rulesConfig.weakPolicy" value="mark" class="text-blue-600 focus:ring-blue-500">
                  标记为待人工确认 🟡
                </label>
                <label class="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="radio" v-model="settings.rulesConfig.weakPolicy" value="delete" class="text-blue-600 focus:ring-blue-500">
                  直接进行强制删除 🔴
                </label>
              </div>
              <p class="text-[10px] text-slate-400 leading-normal">
                * 弱规则（如疑似乱码、疑似引流敏感词）命中时，是转移至审计页由人手动确立还是自动过滤。
              </p>
            </div>

            <!-- Rules Grid list -->
            <div class="space-y-3">
              <!-- 字数过滤 -->
              <div class="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div class="flex justify-between items-center">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="settings.rulesConfig.tooShort.enable" class="rounded text-blue-600 focus:ring-blue-500" />
                    <span class="text-xs font-bold text-slate-700">字数过短过滤 (tooShort)</span>
                  </label>
                  <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-800">强删规则</span>
                </div>
                <div v-if="settings.rulesConfig.tooShort.enable" class="pl-6 space-y-1.5">
                  <span class="text-[10px] text-slate-500">字数过滤长度阈值 (有效汉字英数少于此值则删除):</span>
                  <input type="number" v-model.number="settings.rulesConfig.tooShort.minLength" min="1" 
                    class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 font-mono" />
                </div>
              </div>

              <!-- 精确去重 -->
              <div class="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div class="flex justify-between items-center">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="settings.rulesConfig.duplicate.enable" class="rounded text-blue-600 focus:ring-blue-500" />
                    <span class="text-xs font-bold text-slate-700">全表数据精确去重 (duplicate)</span>
                  </label>
                  <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-800">强删规则</span>
                </div>
                <div v-if="settings.rulesConfig.duplicate.enable" class="pl-6 space-y-1.5">
                  <span class="text-[10px] text-slate-500">触发去重的重复次数阈值:</span>
                  <input type="number" v-model.number="settings.rulesConfig.duplicate.minCount" min="2" 
                    class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 font-mono" />
                </div>
              </div>

              <!-- 纯话题过滤 -->
              <div class="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div class="flex justify-between items-center">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="settings.rulesConfig.topicOnly.enable" class="rounded text-blue-600 focus:ring-blue-500" />
                    <span class="text-xs font-bold text-slate-700">纯话题标签过滤 (topicOnly)</span>
                  </label>
                  <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-800">强删规则</span>
                </div>
                <div v-if="settings.rulesConfig.topicOnly.enable" class="pl-6 space-y-1.5">
                  <span class="text-[10px] text-slate-500">话题标签字符占比阈值 (0.1 ~ 1.0):</span>
                  <input type="number" step="0.1" v-model.number="settings.rulesConfig.topicOnly.ratioThreshold" min="0.1" max="1.0" 
                    class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 font-mono" />
                </div>
              </div>

              <!-- 无意义短词 -->
              <div class="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div class="flex justify-between items-center">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="settings.rulesConfig.shortMeaningless.enable" class="rounded text-blue-600 focus:ring-blue-500" />
                    <span class="text-xs font-bold text-slate-700">无意义短词灌水过滤 (shortMeaningless)</span>
                  </label>
                  <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-800">强删规则</span>
                </div>
                <div v-if="settings.rulesConfig.shortMeaningless.enable" class="pl-6 space-y-1.5">
                  <span class="text-[10px] text-slate-500">水贴高频词库 (逗号/换行分隔):</span>
                  <textarea v-model="settings.rulesConfig.shortMeaningless.phrasesStr" rows="2" @input="syncPhrases" 
                    class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 resize-none font-mono"></textarea>
                </div>
              </div>

              <!-- 营销广告 -->
              <div class="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div class="flex justify-between items-center">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="settings.rulesConfig.adLink.enable" class="rounded text-blue-600 focus:ring-blue-500" />
                    <span class="text-xs font-bold text-slate-700">微商引流广告过滤 (adLink)</span>
                  </label>
                  <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-800">弱规则</span>
                </div>
                <div v-if="settings.rulesConfig.adLink.enable" class="pl-6 space-y-1.5">
                  <span class="text-[10px] text-slate-500">引流推广敏感词库 (逗号/换行分隔):</span>
                  <textarea v-model="settings.rulesConfig.adLink.keywordsStr" rows="2" @input="syncKeywords" 
                    class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 resize-none font-mono"></textarea>
                </div>
              </div>

              <!-- 乱码清洗 -->
              <div class="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div class="flex justify-between items-center">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="settings.rulesConfig.garbledText.enable" class="rounded text-blue-600 focus:ring-blue-500" />
                    <span class="text-xs font-bold text-slate-700">非法乱码字符清洗 (garbledText)</span>
                  </label>
                  <span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-800">弱规则</span>
                </div>
                <div v-if="settings.rulesConfig.garbledText.enable" class="pl-6 space-y-1.5">
                  <span class="text-[10px] text-slate-500">乱码判定非规则字符占比阈值 (0.1 ~ 1.0):</span>
                  <input type="number" step="0.05" v-model.number="settings.rulesConfig.garbledText.threshold" min="0.1" max="1.0" 
                    class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 font-mono" />
                </div>
              </div>

              <!-- 基础快捷规则 -->
              <div class="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5">
                <span class="text-xs font-bold text-slate-800 block">基础过滤开关</span>
                <div class="grid grid-cols-2 gap-3.5">
                  <label class="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                    <input type="checkbox" v-model="settings.rulesConfig.empty.enable" class="rounded text-blue-600 focus:ring-blue-500" />
                    空文本过滤
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                    <input type="checkbox" v-model="settings.rulesConfig.pureEmoji.enable" class="rounded text-blue-600 focus:ring-blue-500" />
                    纯 Emoji 表情过滤
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                    <input type="checkbox" v-model="settings.rulesConfig.pureSymbol.enable" class="rounded text-blue-600 focus:ring-blue-500" />
                    纯标点特殊符号过滤
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                    <input type="checkbox" v-model="settings.rulesConfig.linkOnly.enable" class="rounded text-blue-600 focus:ring-blue-500" />
                    纯 HTTP 链接过滤
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center flex-wrap gap-3">
          <!-- Global Config Import/Export -->
          <div class="flex items-center gap-2">
            <input type="file" ref="globalConfigFileRef" accept=".json" class="hidden" @change="handleImportGlobalConfig" />
            <button @click="triggerImport" class="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium transition-colors">
              <Upload class="w-3.5 h-3.5" /> 导入配置
            </button>
            <span class="text-slate-300">|</span>
            <button @click="settings.exportGlobalConfig" class="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium transition-colors">
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
import { testConnection } from '../../services/ai'
import { X, CheckCircle2, Gift, Copy, Eye, EyeOff, Settings2, Eraser, Key, Download, Upload, RotateCcw } from 'lucide-vue-next'
import { useToast } from '../../services/toast'

const toast = useToast()
const settings = useSettingsStore()

const activeTab = ref('api')
const globalConfigFileRef = ref(null)

const localPlatform = ref(settings.currentPlatform)
const localKeys = reactive({
  siliconflow: localStorage.getItem('siliconflow_api_key') || '',
  aiping: localStorage.getItem('aiping_api_key') || ''
})
const localTranslateModels = reactive({
  siliconflow: settings.selectedTranslateModel.siliconflow,
  aiping: settings.selectedTranslateModel.aiping
})
const localWorkModels = reactive({
  siliconflow: settings.selectedWorkModel.siliconflow,
  aiping: settings.selectedWorkModel.aiping
})
const showKey = reactive({ siliconflow: false, aiping: false })
const testing = ref(false)
const testResult = reactive({ text: '', class: '' })

// 监听弹窗显示，自动回显最新数据 (比如当在别处导入配置后打开)
watch(() => settings.showSettings, (val) => {
  if (val) {
    localPlatform.value = settings.currentPlatform
    localKeys.siliconflow = localStorage.getItem('siliconflow_api_key') || ''
    localKeys.aiping = localStorage.getItem('aiping_api_key') || ''
    localTranslateModels.siliconflow = settings.selectedTranslateModel.siliconflow
    localTranslateModels.aiping = settings.selectedTranslateModel.aiping
    localWorkModels.siliconflow = settings.selectedWorkModel.siliconflow
    localWorkModels.aiping = settings.selectedWorkModel.aiping
  }
})

function copyText(text) {
  navigator.clipboard.writeText(text)
}

async function handleTest() {
  const key = localKeys[localPlatform.value]
  if (!key) { testResult.text = '请先输入 API Key'; testResult.class = 'text-red-600'; return }
  testing.value = true
  testResult.text = '正在测试...'
  testResult.class = 'text-blue-600 animate-pulse'
  try {
    await testConnection(localPlatform.value, key)
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
  settings.setPlatform(localPlatform.value)
  for (const p of ['siliconflow', 'aiping']) {
    if (localKeys[p] !== undefined) settings.saveApiKey(p, localKeys[p])
    settings.saveModelSelection(p, 'translate', localTranslateModels[p])
    settings.saveModelSelection(p, 'work', localWorkModels[p])
  }
  settings.showSettings = false
  toast.success('系统设置已成功保存！')
}

// 词库分词同步
function syncPhrases() {
  const cfg = settings.rulesConfig
  const raw = cfg.shortMeaningless.phrasesStr || ''
  cfg.shortMeaningless.phrases = raw.split(/[,，\n]/).map(x => x.trim()).filter(Boolean)
}

function syncKeywords() {
  const cfg = settings.rulesConfig
  const raw = cfg.adLink.keywordsStr || ''
  cfg.adLink.keywords = raw.split(/[,，\n]/).map(x => x.trim()).filter(Boolean)
}

// 触发隐藏的备份文件 input
function triggerImport() {
  if (globalConfigFileRef.value) {
    globalConfigFileRef.value.click()
  }
}

// 处理系统级配置包 JSON 导入
function handleImportGlobalConfig(e) {
  const file = e.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result)
      let success = false
      
      // 判断是整包还是单规则，都交给 store 的 import 方法兼容处理
      if (parsed.rulesConfig || (parsed.tooShort && parsed.duplicate)) {
        success = settings.importGlobalConfig(parsed)
      } else {
        // 说明可能是单纯的一份清洗配置
        success = settings.importGlobalConfig({ rulesConfig: parsed })
      }
      
      if (success) {
        toast.success('系统全局配置导入成功！已应用生效。')
        // 同步刷新本地 ref
        localPlatform.value = settings.currentPlatform
        localKeys.siliconflow = localStorage.getItem('siliconflow_api_key') || ''
        localKeys.aiping = localStorage.getItem('aiping_api_key') || ''
        localTranslateModels.siliconflow = settings.selectedTranslateModel.siliconflow
        localTranslateModels.aiping = settings.selectedTranslateModel.aiping
        localWorkModels.siliconflow = settings.selectedWorkModel.siliconflow
        localWorkModels.aiping = settings.selectedWorkModel.aiping
      } else {
        toast.error('导入失败：非法的备份配置文件结构')
      }
    } catch (err) {
      toast.error('导入解析失败: ' + err.message)
    }
    e.target.value = ''
  }
  reader.readAsText(file)
}

// 恢复系统出厂设置
function handleResetAll() {
  if (confirm('警告：确定要清除所有已配置的 API Key 授权凭证、模型指向选择，并将清洗规则全部恢复为默认出厂设置吗？')) {
    settings.resetAllConfig()
    toast.success('系统所有设置均已恢复至出厂状态。')
    // 同步本地 ref
    localPlatform.value = settings.currentPlatform
    localKeys.siliconflow = ''
    localKeys.aiping = ''
    localTranslateModels.siliconflow = settings.selectedTranslateModel.siliconflow
    localTranslateModels.aiping = settings.selectedTranslateModel.aiping
    localWorkModels.siliconflow = settings.selectedWorkModel.siliconflow
    localWorkModels.aiping = settings.selectedWorkModel.aiping
  }
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
