<script setup>
import { ref } from 'vue'
import RichTextToolbar from './RichTextToolbar.vue'

const props = defineProps({ block: { type: Object, required: true } })
const emit = defineEmits(['update', 'regenerate'])

const isEditing = ref(false)
const editorRef = ref()

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
</script>

<template>
  <div class="ai-block">
    <div class="block-toolbar">
      <span class="badge badge-orange">AI 生成</span>
      <span class="ai-meta">模型: {{ block.content.model }}</span>
      <button v-if="!isEditing" class="btn btn-sm btn-outline" @click="startEdit">编辑</button>
      <button v-else class="btn btn-sm btn-primary" @click="finishEdit">保存</button>
      <button class="btn btn-sm btn-outline" @click="$emit('regenerate')">重新生成</button>
    </div>

    <div v-if="block.content.prompt" class="prompt-info"><strong>Prompt:</strong> {{ block.content.prompt }}</div>

    <div v-if="isEditing" class="editor-wrap">
      <RichTextToolbar :editor-el="editorRef" @import-html="onImportHtml" />
      <div ref="editorRef" class="ai-editor" contenteditable="true" @keydown="onKeydown" />
    </div>

    <div v-else class="ai-preview" v-html="block.content.html" />
  </div>
</template>

<style scoped>
.ai-block { padding: 16px; }
.block-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.ai-meta { font-size: 12px; color: var(--c-text-secondary); flex: 1; }
.prompt-info { padding: 8px 12px; background: #fef3c7; border-radius: var(--radius); font-size: 13px; color: #92400e; margin-bottom: 12px; }
.editor-wrap { border-radius: var(--radius); overflow: hidden; }
.ai-editor { border: 1px solid var(--c-border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); padding: 16px; min-height: 120px; outline: none; line-height: 1.8; font-size: 15px; }
.ai-editor:focus { box-shadow: inset 0 0 0 1px var(--c-primary); }
.ai-preview { line-height: 1.8; }
</style>
