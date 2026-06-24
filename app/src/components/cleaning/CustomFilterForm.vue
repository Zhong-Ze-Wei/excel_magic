<template>
  <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="$emit('cancel')">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
      <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
        <h3 class="font-bold text-sm text-slate-800">{{ isEdit ? '编辑' : '添加' }}筛选规则</h3>
        <button @click="$emit('cancel')" class="text-slate-400 hover:text-slate-600">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
        <!-- 名称 -->
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1">规则名称</label>
          <input v-model="form.name" type="text" placeholder="如：过滤差评关键词"
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500" />
        </div>

        <!-- 类型 -->
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1">筛选类型</label>
          <select v-model="form.type" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500">
            <option v-for="t in filterTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>

        <!-- 作用列 (labelColumnEquals 类型不使用数据列) -->
        <div v-if="form.type !== 'labelColumnEquals'">
          <label class="block text-xs font-bold text-slate-600 mb-1">作用列</label>
          <select v-model.number="form.config.column" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500">
            <option :value="-1">清洗目标列 (当前选中的列)</option>
            <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>

        <!-- 类型特有配置 -->
        <div class="bg-slate-50 p-3 rounded-lg border border-slate-200/60 space-y-2.5">
          <!-- textContains / textNotContains -->
          <template v-if="form.type === 'textContains' || form.type === 'textNotContains'">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-1">关键词 (逗号分隔)</label>
              <textarea v-model="configStr" rows="2" placeholder="差评, 退货, 假货"
                class="w-full p-2 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none resize-none bg-white"></textarea>
            </div>
            <div class="flex gap-4">
              <label class="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
                <input type="checkbox" v-model="form.config.matchAll" class="rounded text-orange-600 focus:ring-orange-500" />
                全部匹配 (AND)
              </label>
              <label class="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
                <input type="checkbox" v-model="form.config.caseSensitive" class="rounded text-orange-600 focus:ring-orange-500" />
                区分大小写
              </label>
            </div>
          </template>

          <!-- textEquals -->
          <template v-if="form.type === 'textEquals'">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-1">匹配值</label>
              <input v-model="form.config.value" type="text" placeholder="精确匹配的文本"
                class="w-full p-2 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none bg-white" />
            </div>
            <label class="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
              <input type="checkbox" v-model="form.config.caseSensitive" class="rounded text-orange-600 focus:ring-orange-500" />
              区分大小写
            </label>
          </template>

          <!-- regexMatch -->
          <template v-if="form.type === 'regexMatch'">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-1">正则表达式</label>
              <input v-model="form.config.pattern" type="text" placeholder="如: ^(差评|退货).*$"
                class="w-full p-2 border border-slate-200 rounded text-xs font-mono focus:border-orange-500 outline-none bg-white" />
              <p v-if="regexError" class="text-[9px] text-red-500 mt-1">{{ regexError }}</p>
            </div>
          </template>

          <!-- textLength -->
          <template v-if="form.type === 'textLength'">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 mb-1">比较方式</label>
                <select v-model="form.config.operator" class="w-full p-2 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none bg-white">
                  <option value="lt">小于</option>
                  <option value="gt">大于</option>
                  <option value="eq">等于</option>
                  <option value="lte">小于等于</option>
                  <option value="gte">大于等于</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 mb-1">长度值</label>
                <input v-model.number="form.config.value" type="number" min="0"
                  class="w-full p-2 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none bg-white font-mono" />
              </div>
            </div>
          </template>

          <!-- columnEquals -->
          <template v-if="form.type === 'columnEquals'">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-1">匹配值 (多个用逗号分隔)</label>
              <textarea v-model="columnValuesStr" rows="2" placeholder="负面, 差评, 不满意"
                class="w-full p-2 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none resize-none bg-white"></textarea>
            </div>
          </template>

          <!-- columnGt / columnLt -->
          <template v-if="form.type === 'columnGt' || form.type === 'columnLt'">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-1">数值</label>
              <input v-model.number="form.config.value" type="number"
                class="w-full p-2 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none bg-white font-mono" />
            </div>
          </template>

          <!-- labelColumnEquals — AI 打标列匹配 -->
          <template v-if="form.type === 'labelColumnEquals'">
            <div v-if="!labelingOutputColumns.length" class="text-[10px] text-amber-600 bg-amber-50 p-2 rounded">
              暂无 AI 打标结果，请先在「数据分析」页完成打标
            </div>
            <template v-else>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 mb-1">AI 打标列</label>
                <select v-model="form.config.outputKey" class="w-full p-2 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none bg-white">
                  <option v-for="col in labelingOutputColumns" :key="col.key" :value="col.key">{{ col.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 mb-1">匹配标签值 (多个用逗号分隔)</label>
                <textarea v-model="labelValuesStr" rows="2" placeholder="如: 负面, 差评"
                  class="w-full p-2 border border-slate-200 rounded text-xs focus:border-orange-500 outline-none resize-none bg-white"></textarea>
              </div>
            </template>
          </template>
        </div>

        <!-- 策略 -->
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1.5">命中后操作</label>
          <div class="flex gap-3">
            <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input type="radio" v-model="form.policy" value="delete" class="text-orange-600 focus:ring-orange-500" />
              直接删除
            </label>
            <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input type="radio" v-model="form.policy" value="suspect" class="text-orange-600 focus:ring-orange-500" />
              标记待确认
            </label>
          </div>
        </div>
      </div>

      <div class="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
        <button @click="$emit('cancel')"
          class="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all">
          取消
        </button>
        <button @click="save" :disabled="!form.name.trim()"
          class="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-all disabled:opacity-50 flex items-center gap-1">
          <Check class="w-3.5 h-3.5" /> {{ isEdit ? '保存' : '添加' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { X, Check } from 'lucide-vue-next'

const props = defineProps({
  filter: { type: Object, default: null },
  headers: { type: Array, default: () => [] },
  labelingResults: { type: Object, default: null }
})
const emit = defineEmits(['save', 'cancel'])

const isEdit = computed(() => !!props.filter)

const filterTypes = computed(() => {
  const types = [
    { value: 'textContains', label: '文本包含关键词' },
    { value: 'textNotContains', label: '文本不包含关键词' },
    { value: 'textEquals', label: '文本精确匹配' },
    { value: 'regexMatch', label: '正则匹配' },
    { value: 'textLength', label: '文本长度筛选' },
    { value: 'columnEquals', label: '列值精确匹配' },
    { value: 'columnGt', label: '数值列大于' },
    { value: 'columnLt', label: '数值列小于' }
  ]
  if (labelingOutputColumns.value.length) {
    types.push({ value: 'labelColumnEquals', label: 'AI 打标列匹配' })
  }
  return types
})

const labelingOutputColumns = computed(() => props.labelingResults?.outputColumns || [])

function makeDefaultConfig(type) {
  const base = { column: -1 } // -1 = 清洗目标列
  switch (type) {
    case 'textContains':
    case 'textNotContains':
      return { ...base, keywords: [], matchAll: false, caseSensitive: false }
    case 'textEquals':
      return { ...base, value: '', caseSensitive: false }
    case 'regexMatch':
      return { ...base, pattern: '' }
    case 'textLength':
      return { ...base, operator: 'lt', value: 5 }
    case 'columnEquals':
      return { ...base, column: 0, value: '', values: [] }
    case 'columnGt':
    case 'columnLt':
      return { ...base, column: 0, value: 0 }
    case 'labelColumnEquals':
      return { outputKey: labelingOutputColumns.value[0]?.key || '', value: '', values: [] }
    default:
      return base
  }
}

const form = ref({
  name: props.filter?.name || '',
  type: props.filter?.type || 'textContains',
  policy: props.filter?.policy || 'delete',
  config: props.filter?.config ? { ...props.filter.config } : makeDefaultConfig('textContains')
})

// 关键词 <-> 字符串双向绑定
const configStr = computed({
  get() {
    return (form.value.config.keywords || []).join(', ')
  },
  set(val) {
    form.value.config.keywords = val.split(/[,，]/).map(s => s.trim()).filter(Boolean)
  }
})

// 列值多选 <-> 字符串双向绑定
const columnValuesStr = computed({
  get() {
    return (form.value.config.values || []).join(', ')
  },
  set(val) {
    form.value.config.values = val.split(/[,，]/).map(s => s.trim()).filter(Boolean)
  }
})

// AI 标签值 <-> 字符串双向绑定
const labelValuesStr = computed({
  get() {
    return (form.value.config.values || []).join(', ')
  },
  set(val) {
    form.value.config.values = val.split(/[,，]/).map(s => s.trim()).filter(Boolean)
  }
})

// 切换类型时重置 config
watch(() => form.value.type, (newType) => {
  const prevCol = form.value.config.column
  form.value.config = makeDefaultConfig(newType)
  // 保留之前选择的作用列
  if (prevCol != null) form.value.config.column = prevCol
})

// 正则校验
const regexError = computed(() => {
  if (form.value.type !== 'regexMatch' || !form.value.config.pattern) return ''
  try {
    new RegExp(form.value.config.pattern)
    return ''
  } catch (e) {
    return '正则表达式语法错误: ' + e.message
  }
})

function save() {
  if (!form.value.name.trim()) return
  emit('save', {
    name: form.value.name.trim(),
    type: form.value.type,
    enabled: props.filter?.enabled ?? true,
    policy: form.value.policy,
    config: { ...form.value.config }
  })
}
</script>
