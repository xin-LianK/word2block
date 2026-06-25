<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDocumentStore } from '@/stores/document'
import { useToast } from '@/composables/useToast'
import { markdownToHtml } from '@/utils/document-helpers'
import { parseDocxToTemplateDraft } from '@/utils/docx-template-import'
import { parseDocxToTemplateDraftPreferPython } from '@/utils/docx-template-import-provider'
import { parseDocxTemplateDraft } from '@/api/report/docxImport'
import BlockDefEditor from '@/views/document/components/BlockDefEditor.vue'
import ToastContainer from '@/views/document/components/ToastContainer.vue'
import TocPanel from '@/views/document/components/TocPanel.vue'
import DocxImportPreviewDialog from '@/views/document/components/DocxImportPreviewDialog.vue'
import TemplateVersionHistory from '@/views/document/components/TemplateVersionHistory.vue'

const route = useRoute()
const router = useRouter()
const store = useDocumentStore()
const toast = useToast()
const DOCX_IMPORT_OPTIONS_KEY = 'docx-import-candidate-options'
const DOCX_IMPORT_LABEL_PREFS_KEY = 'docx-import-label-preferences'
const DOCX_IMPORT_STRUCTURE_PREFS_KEY = 'docx-import-structure-preferences'
const DOCX_IMPORT_REGRESSION_HISTORY_KEY = 'docx-import-regression-history'
const defaultCandidateOptions = { cover: true, toc: true, footer: true, 'header-footer': true, 'short-noise': true }

const tpl = ref(null)
const editName = ref('')
const editDesc = ref('')
const isDirty = ref(false)
const showPreview = ref(false)
const tocKeyword = ref('')
const activeTocId = ref('')
const importDocxRef = ref()
const docxDraft = ref(null)
const docxOpsLog = ref([])
const candidateOptions = ref({ ...defaultCandidateOptions })
let tocObserver = null

function loadCandidateOptions() {
  try {
    const raw = localStorage.getItem(DOCX_IMPORT_OPTIONS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    candidateOptions.value = { ...defaultCandidateOptions, ...parsed }
  } catch {
    candidateOptions.value = { ...defaultCandidateOptions }
  }
}

function applyStoredLabelPreferences(draft) {
  const sourceKey = draft?.meta?.sourceFileName
  if (!sourceKey) return draft
  try {
    const raw = localStorage.getItem(DOCX_IMPORT_LABEL_PREFS_KEY)
    if (!raw) return draft
    const parsed = JSON.parse(raw)
    const labels = parsed[sourceKey]
    if (!labels) return draft
    draft.blockDefinitions.forEach((block, index) => {
      if (labels[index]) block.label = labels[index]
    })
  } catch {}
  return draft
}

function saveLabelPreferences(draft) {
  const sourceKey = draft?.meta?.sourceFileName
  if (!sourceKey) return
  try {
    const raw = localStorage.getItem(DOCX_IMPORT_LABEL_PREFS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[sourceKey] = draft.blockDefinitions.map((block) => block.label)
    localStorage.setItem(DOCX_IMPORT_LABEL_PREFS_KEY, JSON.stringify(parsed))
  } catch {}
}

function applyStoredStructurePreferences(draft) {
  const sourceKey = draft?.meta?.sourceFileName
  if (!sourceKey) return draft
  try {
    const raw = localStorage.getItem(DOCX_IMPORT_STRUCTURE_PREFS_KEY)
    if (!raw) return draft
    const parsed = JSON.parse(raw)
    const prefs = parsed[sourceKey]
    if (!prefs?.removeShortNoise) return draft
    draft.blockDefinitions = draft.blockDefinitions.filter((block) => {
      const reasons = block.importHints?.candidateReasons || []
      return !reasons.includes('short-noise')
    })
    draft.meta.blockCount = draft.blockDefinitions.length
    draft.meta.tableCount = draft.blockDefinitions.filter((item) => item.type === 'table').length
    draft.meta.imageCount = draft.blockDefinitions.filter((item) => item.type === 'image').length
  } catch {}
  return draft
}

function saveStructurePreferences(draft) {
  const sourceKey = draft?.meta?.sourceFileName
  if (!sourceKey) return
  try {
    const raw = localStorage.getItem(DOCX_IMPORT_STRUCTURE_PREFS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[sourceKey] = {
      removeShortNoise: !(draft.blockDefinitions || []).some((block) => (block.importHints?.candidateReasons || []).includes('short-noise')),
    }
    localStorage.setItem(DOCX_IMPORT_STRUCTURE_PREFS_KEY, JSON.stringify(parsed))
  } catch {}
}

function getRegressionHistory(sourceFileName) {
  if (!sourceFileName) return []
  try {
    const raw = localStorage.getItem(DOCX_IMPORT_REGRESSION_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return parsed[sourceFileName] || []
  } catch {
    return []
  }
}

function appendRegressionHistory(draft) {
  const sourceKey = draft?.meta?.sourceFileName
  if (!sourceKey) return
  try {
    const raw = localStorage.getItem(DOCX_IMPORT_REGRESSION_HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const current = parsed[sourceKey] || []
    current.push({
      at: new Date().toISOString(),
      blockCount: draft.meta?.blockCount || draft.blockDefinitions.length,
      rawBlockCount: draft.meta?.rawBlockCount || draft.blockDefinitions.length,
      reducedBlockCount: draft.meta?.reducedBlockCount || 0,
      warningCount: draft.meta?.warningCount || 0,
      tableCount: draft.meta?.tableCount || 0,
      imageCount: draft.meta?.imageCount || 0,
    })
    parsed[sourceKey] = current.slice(-20)
    localStorage.setItem(DOCX_IMPORT_REGRESSION_HISTORY_KEY, JSON.stringify(parsed))
  } catch {}
}

function exportDocxReport() {
  if (!docxDraft.value || !tpl.value) return
  const draft = docxDraft.value
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'replace',
    targetTemplateId: tpl.value.id,
    targetTemplateName: tpl.value.name,
    sourceFileName: draft.meta?.sourceFileName || '',
    draftTemplateName: draft.name,
    candidateOptions: candidateOptions.value,
    summary: {
      blockCount: draft.meta?.blockCount || draft.blockDefinitions.length,
      tableCount: draft.meta?.tableCount || 0,
      imageCount: draft.meta?.imageCount || 0,
      warningCount: draft.meta?.warningCount || 0,
    },
    operations: docxOpsLog.value,
    warnings: draft.meta?.warnings || [],
    blocks: draft.blockDefinitions.map((block, index) => ({
      index: index + 1,
      id: block.id,
      label: block.label,
      type: block.type,
      candidateReasons: block.importHints?.candidateReasons || [],
      removableCandidate: !!block.importHints?.removableCandidate,
      sortOrder: block.sortOrder,
    })),
  }

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `docx-import-report-${(draft.meta?.sourceFileName || tpl.value.name || 'template').replace(/\.[^.]+$/, '')}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('模板生成报告已导出')
}

function anchorId(defId) {
  return `tpl-def-anchor-${defId}`
}

function getTypeLabel(type) {
  if (type === 'rich_text') return '富文本'
  if (type === 'table') return '表格'
  if (type === 'ai_content') return 'AI'
  if (type === 'image') return '图片'
  return '块'
}

const tocItems = computed(() => {
  const defs = tpl.value?.blockDefinitions || []
  return defs.map((def, idx) => ({
    id: def.id,
    label: `${idx + 1}. ${def.label || '(未命名块)'}`,
    badge: getTypeLabel(def.type),
    badgeClass: 'info',
  }))
})

function setupTocObserver() {
  tocObserver?.disconnect()
  tocObserver = null
  if (typeof window === 'undefined' || !window.IntersectionObserver) return

  tocObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

      if (!visibleEntries.length) return
      const defId = visibleEntries[0].target.getAttribute('data-def-id')
      if (defId) activeTocId.value = defId
    },
    {
      root: null,
      rootMargin: '-120px 0px -60% 0px',
      threshold: [0.2, 0.5, 0.8],
    },
  )

  document.querySelectorAll('.tpl-def-anchor-target').forEach((element) => {
    tocObserver?.observe(element)
  })
}

function jumpToDef(defId) {
  activeTocId.value = defId
  const target = document.getElementById(anchorId(defId))
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function loadTemplate() {
  const id = route.params.id
  const found = store.getTemplate(id)
  if (!found) {
    router.replace({ name: 'TemplateList' })
    return
  }
  tpl.value = found
  editName.value = found.name
  editDesc.value = found.description
  isDirty.value = false
  await nextTick()
  setupTocObserver()
  if (tocItems.value.length) {
    activeTocId.value = tocItems.value[0].id
  }
}

onMounted(() => {
  loadCandidateOptions()
  loadTemplate()
})
watch(() => route.params.id, loadTemplate)

watch(
  () => tpl.value?.blockDefinitions?.map((def) => def.id).join('|'),
  async () => {
    await nextTick()
    setupTocObserver()
  },
)

onBeforeUnmount(() => {
  tocObserver?.disconnect()
})

watch(candidateOptions, (value) => {
  localStorage.setItem(DOCX_IMPORT_OPTIONS_KEY, JSON.stringify(value))
}, { deep: true })

function saveAll() {
  if (!tpl.value) return
  try {
    store.updateTemplate(tpl.value.id, {
      name: editName.value.trim(),
      description: editDesc.value.trim(),
      blockDefinitions: [...tpl.value.blockDefinitions],
    })
    isDirty.value = false
    toast.success(`模板「${editName.value.trim()}」保存成功`)
  } catch {
    toast.error('保存失败，请重试')
  }
}

function onUploadFileBatch(payload) {
  const result = store.importTemplateDataSourceFile(payload.templateId, payload.blockId, payload.fileName, {
    headers: payload.headers,
    records: payload.records,
  })
  if (!result.ok) {
    toast.error(result.reason || '导入失败')
    return
  }
  isDirty.value = true
  const batch = result.batch
  if (batch.errors?.length) {
    toast.error(`导入完成，但校验失败 ${batch.errors.length} 条，请修复后重新上传`)
  } else {
    toast.success(`数据源文件导入成功，共 ${batch.totalCount} 行`)
  }
}

function onPublishFileBatch(payload) {
  const result = store.publishTemplateDataSourceBatch(payload.templateId, payload.blockId, payload.batchId)
  if (!result.ok) {
    toast.error(result.reason || '发布失败')
    return
  }
  isDirty.value = true
  toast.success('数据源批次已发布')
}

function exportTemplate() {
  if (!tpl.value) return
  const data = JSON.parse(JSON.stringify(tpl.value))
  data.name = editName.value.trim()
  data.description = editDesc.value.trim()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `template-${data.name || data.id}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('模板已导出为 JSON 文件')
}

async function onImportDocxFile(e) {
  const file = e.target.files?.[0]
  if (!file || !tpl.value) return

  try {
    const draft = await parseDocxToTemplateDraftPreferPython(file, {
      parseWithPython: parseDocxTemplateDraft,
      parseInBrowser: parseDocxToTemplateDraft,
      onFallback: () => toast.warning('Python DOCX 服务不可用，已回退浏览器解析'),
    })
    docxDraft.value = applyStoredStructurePreferences(applyStoredLabelPreferences(draft))
    docxOpsLog.value = []
  } catch (error) {
    toast.error(error?.message || 'DOCX 导入失败')
  } finally {
    if (importDocxRef.value) importDocxRef.value.value = ''
  }
}

async function confirmReplaceWithDocx() {
  if (!tpl.value || !docxDraft.value) return
  saveLabelPreferences(docxDraft.value)
  saveStructurePreferences(docxDraft.value)
  appendRegressionHistory(docxDraft.value)
  const updated = store.replaceTemplateDraft(tpl.value.id, docxDraft.value)
  if (!updated) {
    toast.error('模板覆盖失败')
    return
  }
  tpl.value = updated
  editName.value = updated.name
  editDesc.value = updated.description
  isDirty.value = true
  docxDraft.value = null
  await nextTick()
  setupTocObserver()
  activeTocId.value = updated.blockDefinitions[0]?.id || ''
  toast.success(`DOCX 已导入当前模板草稿，共 ${updated.blockDefinitions.length} 个块`)
}

function updateDraftBlockLabel({ index, value }) {
  if (!docxDraft.value?.blockDefinitions?.[index]) return
  const before = docxDraft.value.blockDefinitions[index].label
  docxDraft.value.blockDefinitions[index].label = value
  docxOpsLog.value.push({ type: 'rename', index, before, after: value, at: new Date().toISOString() })
}

function moveDraftBlock({ index, direction }) {
  const blocks = docxDraft.value?.blockDefinitions
  if (!blocks) return
  const target = index + direction
  if (target < 0 || target >= blocks.length) return
  const current = blocks[index]
  blocks[index] = blocks[target]
  blocks[target] = current
  docxOpsLog.value.push({ type: 'move', from: index, to: target, at: new Date().toISOString() })
  blocks.forEach((block, idx) => {
    block.sortOrder = idx + 1
  })
}

function removeDraftBlock(index) {
  const blocks = docxDraft.value?.blockDefinitions
  if (!blocks) return
  const removed = blocks[index]
  blocks.splice(index, 1)
  docxOpsLog.value.push({ type: 'remove', index, label: removed?.label, at: new Date().toISOString() })
  syncDraftMeta()
}

function mergeDraftBlock(index) {
  const blocks = docxDraft.value?.blockDefinitions
  if (!blocks || index < 0 || index >= blocks.length - 1) return
  const current = blocks[index]
  const next = blocks[index + 1]
  if (current.type !== 'rich_text' || next.type !== 'rich_text') return

  current.defaultContent.html = `${current.defaultContent.html || ''}${next.defaultContent.html || ''}`
  current.defaultContent.markdown = `${current.defaultContent.markdown || ''}\n\n${next.defaultContent.markdown || ''}`.trim()
  current.defaultContent.rawText = `${current.defaultContent.rawText || ''} ${next.defaultContent.rawText || ''}`.trim()
  current.defaultContent.variables = [...(current.defaultContent.variables || []), ...(next.defaultContent.variables || [])]
  blocks.splice(index + 1, 1)
  docxOpsLog.value.push({ type: 'merge', index, mergedLabel: next.label, targetLabel: current.label, at: new Date().toISOString() })
  syncDraftMeta()
}

function cleanupDraftBlocks() {
  const blocks = docxDraft.value?.blockDefinitions
  if (!blocks) return
  const beforeCount = blocks.length
  docxDraft.value.blockDefinitions = blocks.filter((block) => {
    if (block.type === 'table') return true
    if (block.type === 'image') return !!block.defaultContent?.url
    const text = String(block.defaultContent?.rawText || block.label || '').trim()
    return text.length >= 4
  })
  docxOpsLog.value.push({ type: 'cleanup-short', removedCount: beforeCount - docxDraft.value.blockDefinitions.length, at: new Date().toISOString() })
  syncDraftMeta()
}

function removeCandidateBlocks() {
  const blocks = docxDraft.value?.blockDefinitions
  if (!blocks) return
  const beforeCount = blocks.length
  docxDraft.value.blockDefinitions = blocks.filter((block) => {
    const reasons = block.importHints?.candidateReasons || []
    const matched = reasons.some((reason) => candidateOptions.value[reason])
    return !matched
  })
  docxOpsLog.value.push({ type: 'cleanup-candidates', removedCount: beforeCount - docxDraft.value.blockDefinitions.length, rules: { ...candidateOptions.value }, at: new Date().toISOString() })
  syncDraftMeta()
}

function syncDraftMeta() {
  const blocks = docxDraft.value?.blockDefinitions
  if (!blocks) return
  blocks.forEach((block, idx) => {
    block.sortOrder = idx + 1
  })
  docxDraft.value.meta.blockCount = blocks.length
  docxDraft.value.meta.tableCount = blocks.filter((item) => item.type === 'table').length
  docxDraft.value.meta.imageCount = blocks.filter((item) => item.type === 'image').length
}

function addBlockDef(type = 'rich_text') {
  if (!tpl.value) return
  const defaults = {
    rich_text: { markdown: '请输入内容', html: markdownToHtml('请输入内容'), rawText: '请输入内容', variables: [] },
    table: {
      columns: [
        { id: 'c1', title: '列1', width: 'auto', align: 'left', headerStyle: {} },
        { id: 'c2', title: '列2', width: 'auto', align: 'left', headerStyle: {} },
      ],
      rows: [],
      style: { borderColor: '#e2e8f0', borderWidth: 1, headerBgColor: '#1e40af', headerTextColor: '#ffffff', stripedRows: true, fontSize: 14 },
    },
    ai_content: { html: '', rawText: '', prompt: '', model: 'gpt-4', variables: [] },
    image: { url: '', alt: '', width: 'auto', height: 'auto', alignment: 'center' },
  }
  tpl.value.blockDefinitions.push({
    id: `def_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    type,
    sortOrder: tpl.value.blockDefinitions.length + 1,
    label: `新${type === 'rich_text' ? '富文本' : type === 'table' ? '表格' : type === 'ai_content' ? 'AI内容' : '图片'}块`,
    required: false,
    defaultContent: defaults[type],
    dataSourceConfig: null,
  })
  isDirty.value = true
}

function updateBlockDef(idx, def) {
  if (!tpl.value) return
  tpl.value.blockDefinitions[idx] = def
  isDirty.value = true
}

function deleteBlockDef(idx) {
  if (!tpl.value) return
  if (!confirm('确定删除这个块定义吗？')) return
  tpl.value.blockDefinitions.splice(idx, 1)
  reindex()
  isDirty.value = true
}

function moveBlockDef(idx, dir) {
  if (!tpl.value) return
  const defs = tpl.value.blockDefinitions
  const target = idx + dir
  if (target < 0 || target >= defs.length) return
  const tmp = defs[idx]
  defs[idx] = defs[target]
  defs[target] = tmp
  reindex()
  isDirty.value = true
}

function reindex() {
  if (!tpl.value) return
  tpl.value.blockDefinitions.forEach((d, i) => { d.sortOrder = i + 1 })
}

function goBack() {
  if (isDirty.value && !confirm('有未保存的修改，确定离开吗？')) return
  router.push({ name: 'TemplateList' })
}

function createMockRowsByEndpoint(endpoint = '', columns = []) {
  const ep = String(endpoint || '').toLowerCase()
  const buildRow = (values) => ({
    cells: columns.map((c, i) => ({ columnId: c.id, value: values[i] ?? '-' })),
  })

  if (!columns.length) return []

  if (ep.includes('/api/projects/progress')) {
    return [
      buildRow(['政务云监控升级', '张三', '80%', '进行中']),
      buildRow(['数据库容灾演练', '李四', '100%', '已完成']),
      buildRow(['统一身份改造', '王五', '45%', '推进中']),
    ]
  }

  if (ep.includes('/api/tasks/weekly')) {
    return [
      buildRow(['接口联调与回归', '高', '已完成']),
      buildRow(['报表导出优化', '中', '进行中']),
      buildRow(['告警策略梳理', '中', '待开始']),
    ]
  }

  return [
    buildRow(columns.map((c) => `${c.title}示例A`)),
    buildRow(columns.map((c) => `${c.title}示例B`)),
    buildRow(columns.map((c) => `${c.title}示例C`)),
  ]
}

const previewBlocks = computed(() => {
  if (!tpl.value) return []
  return tpl.value.blockDefinitions.map(d => ({
    label: d.label,
    type: d.type,
    required: d.required,
    hasDs: !!d.dataSourceConfig,
    varCount: d.defaultContent?.variables?.length ?? 0,
    colCount: d.defaultContent?.columns?.length ?? 0,
    columns: d.defaultContent?.columns ?? [],
    rowCount: d.defaultContent?.rows?.length ?? 0,
    previewRows: d.type === 'table'
      ? ((d.defaultContent?.rows?.length ? d.defaultContent.rows : createMockRowsByEndpoint(d.dataSourceConfig?.apiEndpoint, d.defaultContent?.columns ?? [])).slice(0, 50))
      : [],
    endpoint: d.dataSourceConfig?.apiEndpoint || '',
  }))
})
</script>

<template>
  <div class="tpl-edit-page">
    <div class="tpl-edit-nav">
      <button class="btn btn-outline" @click="goBack">← 返回模板列表</button>
      <div class="tpl-edit-title-area"><h2 v-if="tpl">{{ tpl.name }}</h2></div>
      <div class="tpl-edit-actions">
        <button class="btn btn-sm btn-outline" @click="showPreview = !showPreview">{{ showPreview ? '关闭预览' : '预览结构' }}</button>
        <button class="btn btn-sm btn-outline" @click="importDocxRef?.click()">导入 DOCX</button>
        <button class="btn btn-sm btn-outline" @click="exportTemplate">导出模板</button>
        <button class="btn btn-sm btn-primary" :disabled="!isDirty" @click="saveAll">保存模板</button>
      </div>
    </div>

    <template v-if="tpl">
      <div class="tpl-basic card">
        <div class="tpl-basic-row">
          <div class="tpl-basic-field">
            <label>模板名称</label>
            <input v-model="editName" @input="isDirty = true" />
          </div>
          <div class="tpl-basic-field">
            <label>描述</label>
            <input v-model="editDesc" @input="isDirty = true" />
          </div>
          <div class="tpl-basic-field tpl-basic-info">
            <span>ID: {{ tpl.id }}</span>
            <span>块: {{ tpl.blockDefinitions.length }}</span>
          </div>
        </div>
      </div>

      <TemplateVersionHistory v-if="tpl" :template-id="tpl.id" />

      <TocPanel
        title="块目录"
        aria-label="模板块目录"
        :items="tocItems"
        :keyword="tocKeyword"
        :active-id="activeTocId"
        search-placeholder="搜索块标题..."
        empty-text="未找到匹配项"
        @update:keyword="(v) => (tocKeyword = v)"
        @jump="jumpToDef"
      />

      <div class="tpl-content-area" :class="{ 'with-preview': showPreview }">
        <div class="tpl-defs-panel">
          <div class="tpl-defs-header">
            <h3>内容块定义</h3>
            <div class="tpl-add-btns">
              <button class="btn btn-sm btn-outline" @click="addBlockDef('rich_text')">+ 富文本</button>
              <button class="btn btn-sm btn-outline" @click="addBlockDef('table')">+ 表格</button>
              <button class="btn btn-sm btn-outline" @click="addBlockDef('ai_content')">+ AI内容</button>
              <button class="btn btn-sm btn-outline" @click="addBlockDef('image')">+ 图片</button>
            </div>
          </div>

          <div v-if="!tpl.blockDefinitions.length" class="empty-defs"><p>暂无内容块定义，点击上方按钮添加</p></div>

          <div
            v-for="(def, idx) in tpl.blockDefinitions"
            :id="anchorId(def.id)"
            :key="def.id"
            :data-def-id="def.id"
            class="tpl-def-anchor-target"
          >
            <BlockDefEditor
              :template-id="tpl.id"
              :def="def"
              :index="idx"
              :total="tpl.blockDefinitions.length"
              @update="d => updateBlockDef(idx, d)"
              @delete="deleteBlockDef(idx)"
              @move-up="moveBlockDef(idx, -1)"
              @move-down="moveBlockDef(idx, 1)"
              @upload-file-batch="onUploadFileBatch"
              @publish-file-batch="onPublishFileBatch"
            />
          </div>
        </div>

        <div v-if="showPreview" class="tpl-preview-panel card">
          <h4>文档结构预览</h4>
          <div class="preview-doc">
            <div class="preview-title">{{ editName || '(未命名模板)' }}</div>
            <div v-for="(b, bi) in previewBlocks" :key="bi" class="preview-block" :class="`preview-${b.type}`">
              <div class="preview-block-head">
                <span class="preview-num">{{ bi + 1 }}</span>
                <span class="preview-label">{{ b.label }}</span>
                <span v-if="b.required" class="preview-req">*</span>
              </div>
              <div class="preview-block-body">
                <template v-if="b.type === 'rich_text'">
                  <div class="preview-placeholder">富文本内容区域</div>
                  <div v-if="b.varCount" class="preview-vars">{{ b.varCount }} 个动态变量</div>
                </template>
                <template v-else-if="b.type === 'table'">
                  <div class="preview-table-hint">
                    {{ b.colCount }} 列表格 · {{ b.rowCount || b.previewRows.length }} 行{{ b.rowCount ? '默认数据' : '虚拟数据' }}
                    <span v-if="b.rowCount > b.previewRows.length"> · 预览前 {{ b.previewRows.length }} 行</span>
                  </div>
                  <div v-if="b.endpoint" class="preview-table-api">数据源：{{ b.endpoint }}</div>
                  <div class="preview-table-wrap">
                    <table class="preview-table-grid">
                      <thead>
                        <tr>
                          <th v-for="col in b.columns" :key="col.id">{{ col.title }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(row, ri) in b.previewRows" :key="ri">
                          <td v-for="cell in row.cells" :key="cell.columnId">{{ cell.value }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
                <template v-else-if="b.type === 'ai_content'"><div class="preview-ai-hint">AI 自动生成内容</div></template>
                <template v-else><div class="preview-placeholder">图片区域</div></template>
              </div>
              <div v-if="b.hasDs" class="preview-ds">📡 数据源</div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <input ref="importDocxRef" type="file" accept=".docx" style="display:none" @change="onImportDocxFile" />
    <DocxImportPreviewDialog
      :visible="!!docxDraft"
      :draft="docxDraft"
      :report-context="{ mode: 'replace', templateId: tpl?.id }"
      :regression-history="getRegressionHistory(docxDraft?.meta?.sourceFileName)"
      :candidate-options="candidateOptions"
      mode="replace"
      @close="docxDraft = null"
      @confirm="confirmReplaceWithDocx"
      @export-report="exportDocxReport"
      @update:candidate-options="(v) => (candidateOptions = v)"
      @update:block-label="updateDraftBlockLabel"
      @move-block="moveDraftBlock"
      @remove-block="removeDraftBlock"
      @merge-block="mergeDraftBlock"
      @cleanup-blocks="cleanupDraftBlocks"
      @remove-candidates="removeCandidateBlocks"
    />
  </div>
  <ToastContainer />
</template>

<style scoped>
.tpl-edit-page { animation: fadeIn .2s ease; padding: 20px 24px 24px; position:relative; }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
.tpl-edit-nav { display:flex; align-items:center; gap:16px; margin-bottom:20px; margin-right:296px; }
.tpl-edit-title-area { flex:1; }
.tpl-edit-title-area h2 { font-size:20px; margin:0; }
.tpl-edit-actions { display:flex; gap:8px; }
.tpl-basic { padding:16px; margin-bottom:20px; margin-right:296px; }
.tpl-basic-row { display:flex; gap:12px; align-items:flex-end; }
.tpl-basic-field { flex:1; display:flex; flex-direction:column; gap:4px; }
.tpl-basic-field label { font-size:12px; font-weight:500; color:var(--c-text-secondary); }
.tpl-basic-field input { padding:6px 10px; border:1px solid var(--c-border); border-radius:4px; font-size:14px; font-family:inherit; outline:none; }
.tpl-basic-field input:focus { border-color:var(--c-primary); }
.tpl-basic-info { flex:0 0 auto; font-size:12px; color:var(--c-text-secondary); gap:6px; justify-content:flex-end; }
.tpl-content-area { display:flex; gap:20px; margin-right:296px; }
.tpl-content-area.with-preview .tpl-defs-panel { flex:1; min-width:0; }
.tpl-defs-panel { flex:1; }
.tpl-defs-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.tpl-defs-header h3 { font-size:16px; }
.tpl-add-btns { display:flex; gap:4px; }
.empty-defs { text-align:center; padding:40px; color:var(--c-text-secondary); border:2px dashed var(--c-border); border-radius:var(--radius); }
.tpl-preview-panel { flex:0 0 280px; padding:16px; position:sticky; top:72px; align-self:flex-start; max-height:calc(100vh - 100px); overflow-y:auto; }
.tpl-preview-panel h4 { font-size:14px; margin-bottom:12px; color:var(--c-text-secondary); }
.preview-doc { display:flex; flex-direction:column; gap:6px; }
.preview-title { font-size:15px; font-weight:700; padding:8px; background:#f8fafc; border-radius:4px; text-align:center; margin-bottom:4px; }
.preview-block { border:1px solid var(--c-border); border-radius:4px; overflow:hidden; font-size:12px; }
.preview-block-head { display:flex; align-items:center; gap:6px; padding:4px 8px; background:#f1f5f9; border-bottom:1px solid var(--c-border); }
.preview-num { color:var(--c-primary); font-weight:700; font-size:11px; }
.preview-label { flex:1; font-weight:500; }
.preview-req { color:#dc2626; font-weight:700; }
.preview-block-body { padding:8px; min-height:24px; }
.preview-placeholder { color:var(--c-text-secondary); font-style:italic; }
.preview-vars { margin-top:4px; color:#f59e0b; font-size:11px; }
.preview-table-hint { color:#22c55e; }
.preview-table-api { margin-top:4px; color:#0f766e; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.preview-table-wrap { margin-top:6px; overflow-x:auto; border:1px solid #d1fae5; border-radius:4px; background:white; }
.preview-table-grid { width:100%; border-collapse:collapse; font-size:11px; }
.preview-table-grid th,.preview-table-grid td { padding:4px 6px; border-bottom:1px solid #ecfdf5; border-right:1px solid #ecfdf5; white-space:nowrap; }
.preview-table-grid th:last-child,.preview-table-grid td:last-child { border-right:none; }
.preview-table-grid thead th { background:#ecfdf5; color:#065f46; font-weight:600; }
.preview-table-grid tbody tr:last-child td { border-bottom:none; }
.preview-ai-hint { color:#f97316; }
.preview-ds { padding:2px 8px; background:#f0f9ff; border-top:1px solid var(--c-border); font-size:11px; color:#0ea5e9; }
.preview-rich_text { border-left:3px solid #3b82f6; }
.preview-table { border-left:3px solid #22c55e; }
.preview-ai_content { border-left:3px solid #f97316; }
.preview-image { border-left:3px solid #8b5cf6; }
.tpl-def-anchor-target { scroll-margin-top: 90px; }

@media (max-width: 960px) {
  .tpl-edit-nav,
  .tpl-basic,
  .tpl-content-area { margin-right:0; }
}
</style>
