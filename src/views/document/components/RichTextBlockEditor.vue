<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { replaceVariables } from '@/utils/document-helpers'
import RichTextToolbar from './RichTextToolbar.vue'

const props = defineProps({ block: { type: Object, required: true } })
const emit = defineEmits(['update', 'refresh-variable', 'refresh-all-variables'])

const editorRef = ref()
const isEditing = ref(false)
const renderedHtml = ref('')
const refreshingApi = ref(null)

const apiGroups = computed(() => {
  const map = new Map()
  for (const v of props.block.content.variables) {
    const api = v.sourceApi || '(无接口)'
    const list = map.get(api) ?? []
    list.push(v)
    map.set(api, list)
  }
  return Array.from(map.entries()).map(([api, variables]) => ({ api, variables }))
})

function renderWithVariables() {
  renderedHtml.value = replaceVariables(props.block.content.html, props.block.content.variables)
}

onMounted(renderWithVariables)
watch(() => props.block.content, renderWithVariables, { deep: true })

function startEdit() {
  isEditing.value = true
  setTimeout(() => {
    if (editorRef.value) {
      editorRef.value.innerHTML = props.block.content.html
      editorRef.value.focus()
    }
  })
}

function finishEdit() {
  if (!editorRef.value) return
  const html = editorRef.value.innerHTML
  const rawText = editorRef.value.innerText
  isEditing.value = false
  emit('update', html, rawText)
}

function onKeydown(e) {
  if (e.key === 'Escape') finishEdit()
}

function onImportHtml(html) {
  if (!editorRef.value) return
  editorRef.value.innerHTML = html
  editorRef.value.focus()
}

function onRefreshByApi(group) {
  refreshingApi.value = group.api
  emit('refresh-variable', group.variables[0])
  setTimeout(() => { refreshingApi.value = null }, 800)
}

function formatTime(iso) {
  if (!iso) return '未获取'
  return new Date(iso).toLocaleString('zh-CN')
}

function shortApi(api) {
  return api.replace(/^\/api\//, '').replace(/\//g, ' / ')
}
</script>

<template>
  <div class="rich-text-block">
    <div class="block-toolbar">
      <span class="badge badge-blue">富文本</span>
      <button v-if="!isEditing" class="btn btn-sm btn-outline" @click="startEdit">编辑</button>
      <button v-else class="btn btn-sm btn-primary" @click="finishEdit">保存</button>
      <button v-if="block.content.variables.length && !isEditing" class="btn btn-sm btn-outline refresh-all-btn" @click="$emit('refresh-all-variables')">刷新全部数据</button>
    </div>

    <div v-if="block.content.variables.length" class="var-section">
      <div class="var-section-label">动态数据（按接口分组，点击刷新同一接口的所有变量）</div>
      <div v-for="group in apiGroups" :key="group.api" class="var-api-group" :class="{ refreshing: refreshingApi === group.api }">
        <div class="var-api-header">
          <span class="var-api-name" :title="group.api">{{ shortApi(group.api) }}</span>
          <span class="var-api-count">{{ group.variables.length }} 个变量</span>
          <button class="var-api-refresh-btn" :title="`刷新接口: ${group.api}`" @click="onRefreshByApi(group)">
            <span class="var-refresh-icon" :class="{ spinning: refreshingApi === group.api }">↻</span>
            刷新
          </button>
        </div>
        <div class="var-tags">
          <span
            v-for="v in group.variables"
            :key="v.key"
            class="var-tag"
            :title="`占位符: ${v.key}\n字段: ${v.responseField || v.key}\n获取时间: ${formatTime(v.fetchedAt)}`"
          >
            <span class="var-label">{{ v.label }}</span>
            <span class="var-value">{{ v.value }}</span>
          </span>
        </div>
      </div>
    </div>

    <div v-if="isEditing" class="editor-wrap">
      <RichTextToolbar :editor-el="editorRef" @import-html="onImportHtml" />
      <div ref="editorRef" class="rich-text-editor" contenteditable="true" @keydown="onKeydown" />
    </div>

    <div v-else class="rich-text-preview" v-html="renderedHtml" />
  </div>
</template>

<style scoped>
.rich-text-block { padding: 16px; }
.block-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.refresh-all-btn { margin-left: auto; }
.var-section { margin-bottom: 12px; padding: 10px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius); display: flex; flex-direction: column; gap: 8px; }
.var-section-label { font-size: 11px; color: #92400e; font-weight: 500; }
.var-api-group { padding: 8px 10px; background: white; border: 1px solid #fde68a; border-radius: 6px; transition: all 0.2s; }
.var-api-group.refreshing { border-color: #6ee7b7; background: #f0fdf4; }
.var-api-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.var-api-name { font-size: 11px; font-weight: 600; color: #0369a1; background: #e0f2fe; padding: 1px 6px; border-radius: 3px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.var-api-count { font-size: 11px; color: var(--c-text-secondary); flex: 1; }
.var-api-refresh-btn { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border: 1px solid #fde68a; border-radius: 4px; background: #fef3c7; color: #92400e; font-size: 11px; font-family: inherit; cursor: pointer; transition: all 0.15s; }
.var-api-refresh-btn:hover { background: #fde68a; border-color: #f59e0b; }
.var-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.var-tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; background: #fefce8; color: #92400e; border: 1px solid #fef08a; border-radius: 4px; font-size: 12px; cursor: default; }
.var-label { font-weight: 500; }
.var-value { font-weight: 700; font-size: 13px; }
.var-refresh-icon { font-size: 13px; transition: transform 0.15s; }
.var-refresh-icon.spinning { animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.editor-wrap { border-radius: var(--radius); overflow: hidden; }
.rich-text-editor { border: 1px solid var(--c-border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); padding: 16px; min-height: 120px; outline: none; line-height: 1.8; font-size: 15px; }
.rich-text-editor:focus { box-shadow: inset 0 0 0 1px var(--c-primary); }
.rich-text-preview { line-height: 1.8; }
</style>
