<template>
  <div v-if="show" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="$emit('cancel')">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
      <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
        <h3 class="font-bold text-sm text-slate-800">{{ isEdit ? '编辑' : '添加' }}输出列</h3>
        <button @click="$emit('cancel')" class="text-slate-400 hover:text-slate-600"><X class="w-4 h-4" /></button>
      </div>
      <div class="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-1">列名</label>
          <input v-model="col.name" type="text" placeholder="如：情感倾向"
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500" />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-1">字段 key</label>
          <input v-model="col.key" type="text" placeholder="如：sentiment"
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-violet-500" />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-1">类型</label>
          <select v-model="col.type" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500">
            <option value="enum">单选标签 (enum)</option>
            <option value="multi_enum">多选标签 (multi_enum)</option>
            <option value="hierarchical_enum">二级分类 (hierarchical_enum)</option>
            <option value="boolean">是否判断 (boolean)</option>
            <option value="text">自由文本 (text)</option>
            <option value="number">数值评分 (number)</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-1">说明</label>
          <input v-model="col.description" type="text" placeholder="这个字段判断什么"
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500" />
        </div>
        <div v-if="col.type === 'enum' || col.type === 'multi_enum'">
          <label class="block text-[10px] font-bold text-slate-500 mb-1">选项 (逗号分隔)</label>
          <textarea v-model="optionsStr" rows="2" placeholder="选项1, 选项2, 选项3"
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-violet-500 resize-none"></textarea>
        </div>
        <div v-if="col.type === 'hierarchical_enum'">
          <label class="block text-[10px] font-bold text-slate-500 mb-1">分类体系 (JSON)</label>
          <textarea v-model="hierStr" rows="4" placeholder='{"大类1":["子1","子2"]}'
            class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-violet-500 resize-none"></textarea>
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="col.required" class="rounded text-violet-600 focus:ring-violet-500 w-4 h-4" />
          <span class="text-xs text-slate-600">必填（该列允许空值时取消勾选）</span>
        </label>
      </div>
      <div class="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
        <button @click="$emit('cancel')" class="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600">取消</button>
        <button @click="onSave" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch, computed } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  show: Boolean,
  // 正在编辑的列对象（null=新增）；index=-1 表示新增，>=0 表示编辑
  column: { type: Object, default: null },
  index: { type: Number, default: -1 }
})
const emit = defineEmits(['save', 'cancel'])

const isEdit = computed(() => props.index >= 0)

// 组件内部编辑态（避免直接改父组件对象）
const col = reactive({ key: '', name: '', type: 'enum', description: '', required: true })
const optionsStr = ref('')
const hierStr = ref('')

// 当弹窗打开/切换编辑列时，初始化内部状态
watch(() => [props.show, props.column], () => {
  if (!props.show || !props.column) return
  Object.assign(col, {
    key: props.column.key || '',
    name: props.column.name || '',
    type: props.column.type || 'enum',
    description: props.column.description || '',
    required: props.column.required !== false
  })
  if (col.type === 'enum' || col.type === 'multi_enum') {
    optionsStr.value = Array.isArray(props.column.options) ? props.column.options.join(', ') : ''
  } else if (col.type === 'hierarchical_enum') {
    hierStr.value = (props.column.options && typeof props.column.options === 'object') ? JSON.stringify(props.column.options, null, 2) : ''
  }
}, { immediate: true })

function onSave() {
  if (!col.name.trim() || !col.key.trim()) return
  // 自动生成 key
  col.key = col.key.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || col.name.trim()
  // 解析 options
  let options
  if (col.type === 'enum' || col.type === 'multi_enum') {
    options = optionsStr.value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
  } else if (col.type === 'hierarchical_enum') {
    try { options = JSON.parse(hierStr.value || '{}') } catch { options = {} }
  } else {
    options = undefined
  }
  emit('save', {
    index: props.index,
    column: { ...col, options }
  })
}
</script>
