<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoute } from 'vue-router'
import { useDocumentStore } from '@/stores/document'
import { useToast } from '@/composables/useToast'
import ToastContainer from '@/views/document/components/ToastContainer.vue'
import { parseDocxToTemplateDraft } from '@/utils/docx-template-import'
import { parseDocxToTemplateDraftPreferPython } from '@/utils/docx-template-import-provider'
import { parseDocxTemplateDraft } from '@/api/report/docxImport'
import DocxImportPreviewDialog from '@/views/document/components/DocxImportPreviewDialog.vue'

const store = useDocumentStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const DOCX_IMPORT_OPTIONS_KEY = 'docx-import-candidate-options'
const DOCX_IMPORT_LABEL_PREFS_KEY = 'docx-import-label-preferences'
const DOCX_IMPORT_STRUCTURE_PREFS_KEY = 'docx-import-structure-preferences'
const DOCX_IMPORT_REGRESSION_HISTORY_KEY = 'docx-import-regression-history'
const defaultCandidateOptions = { cover: true, toc: true, footer: true, 'header-footer': true, 'short-noise': true }

const showCreate = ref(false)
const newName = ref('')
const newDesc = ref('')
const importFileRef = ref()
const importDocxRef = ref()
const docxDraft = ref(null)
const docxOpsLog = ref([])
const candidateOptions = ref({ ...defaultCandidateOptions })
const onlyFileSource = ref(false)
const onlyUnpublished = ref(false)
const onlyRecentlyImported = ref(false)

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
  if (!docxDraft.value) return
  const draft = docxDraft.value
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'create',
    sourceFileName: draft.meta?.sourceFileName || '',
    templateName: draft.name,
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
  a.download = `docx-import-report-${(draft.meta?.sourceFileName || draft.name || 'template').replace(/\.[^.]+$/, '')}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('模板生成报告已导出')
}

function parseQueryFlag(value) {
  return value === '1' || value === 'true'
}

function syncFiltersFromRoute() {
  onlyFileSource.value = parseQueryFlag(route.query.fileSource)
  onlyUnpublished.value = parseQueryFlag(route.query.unpublished)
}

function syncRouteFromFilters() {
  const nextQuery = { ...route.query }
  if (onlyFileSource.value) nextQuery.fileSource = '1'
  else delete nextQuery.fileSource

  if (onlyUnpublished.value) nextQuery.unpublished = '1'
  else delete nextQuery.unpublished

  router.replace({ query: nextQuery })
}

function openCreate() {
  newName.value = ''
  newDesc.value = ''
  showCreate.value = true
}

function create() {
  if (!newName.value.trim()) return
  const tpl = store.createTemplate(newName.value.trim(), newDesc.value.trim())
  showCreate.value = false
  router.push({ name: 'TemplateEdit', params: { id: tpl.id } })
}

function editTpl(id) {
  router.push({ name: 'TemplateEdit', params: { id } })
}

function duplicateTpl(id) {
  const copy = store.duplicateTemplate(id)
  if (copy) toast.success(`已复制为「${copy.name}」`)
}

function deleteTpl(id) {
  if (!confirm('确定删除该模板吗？')) return
  const result = store.deleteTemplate(id)
  if (!result.ok) toast.error(result.reason)
  else toast.success('模板已删除')
}

function exportTpl(id) {
  const data = store.exportTemplateData(id)
  if (!data) return
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `template-${data.name || data.id}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`模板「${data.name}」已导出`)
}

function onImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const text = reader.result
      const data = JSON.parse(text)
      if (!data.name || !data.blockDefinitions) {
        toast.error('文件格式不正确，缺少必要字段')
        return
      }
      const tpl = store.importTemplate(data)
      toast.success(`模板「${tpl.name}」导入成功`)
    } catch {
      toast.error('JSON 解析失败，请检查文件格式')
    }
  }
  reader.readAsText(file)
  if (importFileRef.value) importFileRef.value.value = ''
}

async function onImportDocxFile(e) {
  const file = e.target.files?.[0]
  if (!file) return

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

function confirmCreateFromDocx() {
  if (!docxDraft.value) return
  const draft = docxDraft.value
  saveLabelPreferences(draft)
  saveStructurePreferences(draft)
  appendRegressionHistory(draft)
  const tpl = store.importTemplate({
    name: draft.name,
    description: draft.description,
    blockDefinitions: draft.blockDefinitions,
  })
  docxDraft.value = null
  toast.success(`DOCX 已生成模板「${tpl.name}」，共 ${draft.meta.blockCount} 个块`)
  router.push({ name: 'TemplateEdit', params: { id: tpl.id } })
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

function formatTime(iso) {
  return new Date(iso).toLocaleString('zh-CN')
}

function docCount(tplId) {
  return store.documentList.filter(d => d.templateId === tplId).length
}

function dsStats(tplId) {
  return store.getTemplateDataSourceStats(tplId)
}

function latestImportSummary(tplId) {
  return store.getLatestTemplateVersion(tplId)
}

const filteredTemplates = computed(() => {
  return store.templates
    .filter((tpl) => {
      const stats = dsStats(tpl.id)
      const latest = latestImportSummary(tpl.id)
      if (onlyFileSource.value && stats.fileSourceBlocks <= 0) {
        return false
      }
      if (onlyUnpublished.value && stats.fileSourceBlocks > 0 && stats.publishedFileBlocks >= stats.fileSourceBlocks) {
        return false
      }
      if (onlyRecentlyImported.value && !latest) {
        return false
      }
      return true
    })
    .slice()
    .sort((a, b) => {
      const latestA = latestImportSummary(a.id)?.timestamp || ''
      const latestB = latestImportSummary(b.id)?.timestamp || ''
      if (latestA && latestB) return latestB.localeCompare(latestA)
      if (latestA) return -1
      if (latestB) return 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
})

onMounted(syncFiltersFromRoute)
onMounted(loadCandidateOptions)

watch(
  () => route.query,
  () => {
    syncFiltersFromRoute()
  },
)

watch([onlyFileSource, onlyUnpublished], () => {
  syncRouteFromFilters()
})

watch(candidateOptions, (value) => {
  localStorage.setItem(DOCX_IMPORT_OPTIONS_KEY, JSON.stringify(value))
}, { deep: true })
</script>

<template>
  <div class="tpl-list-page">
    <div class="page-header">
      <h2>模板管理</h2>
      <div class="page-header-actions">
        <button class="btn btn-outline" @click="importFileRef?.click()">导入模板</button>
        <button class="btn btn-outline" @click="importDocxRef?.click()">导入 DOCX</button>
        <button class="btn btn-primary" @click="openCreate">+ 新建模板</button>
      </div>
    </div>

    <div class="page-filters card">
      <label class="filter-item"><input v-model="onlyFileSource" type="checkbox" />仅看含文件源模板</label>
      <label class="filter-item"><input v-model="onlyUnpublished" type="checkbox" />仅看未发布完成模板</label>
      <label class="filter-item"><input v-model="onlyRecentlyImported" type="checkbox" />仅看最近有导入变化</label>
      <span class="filter-summary">当前显示 {{ filteredTemplates.length }} / {{ store.templates.length }}</span>
    </div>

    <div v-if="!filteredTemplates.length" class="empty-state">
      <p>暂无模板，点击"新建模板"开始创建</p>
    </div>

    <div v-else class="tpl-grid">
      <div v-for="tpl in filteredTemplates" :key="tpl.id" class="tpl-card card">
        <div class="tpl-card-body" @click="editTpl(tpl.id)">
          <h3>{{ tpl.name }}</h3>
          <p class="tpl-desc">{{ tpl.description || '无描述' }}</p>
          <div class="tpl-card-meta">
            <span class="badge badge-blue">{{ tpl.blockDefinitions.length }} 个内容块</span>
            <span class="tpl-doc-count">{{ docCount(tpl.id) }} 篇文档使用</span>
            <span v-if="dsStats(tpl.id).fileSourceBlocks" class="badge badge-purple">
              文件源 {{ dsStats(tpl.id).fileSourceBlocks }} 块
            </span>
            <span v-if="dsStats(tpl.id).publishedFileBlocks" class="badge badge-green">
              已发布 {{ dsStats(tpl.id).publishedFileBlocks }} 块
            </span>
            <span v-if="latestImportSummary(tpl.id)" class="badge badge-orange">
              最近导入变化
            </span>
          </div>
          <div v-if="latestImportSummary(tpl.id)" class="tpl-import-summary">
            <span>导入时间：{{ formatTime(latestImportSummary(tpl.id).timestamp) }}</span>
            <span>新增 {{ latestImportSummary(tpl.id).blockSummary?.added?.length || 0 }}</span>
            <span>删除 {{ latestImportSummary(tpl.id).blockSummary?.removed?.length || 0 }}</span>
            <span>标题变更 {{ latestImportSummary(tpl.id).blockSummary?.relabeled?.length || 0 }}</span>
          </div>
        </div>
        <div class="tpl-card-footer">
          <span>更新: {{ formatTime(tpl.updatedAt) }}</span>
          <div class="tpl-card-actions">
            <button class="btn btn-sm btn-outline" @click="editTpl(tpl.id)">编辑</button>
            <button class="btn btn-sm btn-outline" @click="exportTpl(tpl.id)">导出</button>
            <button class="btn btn-sm btn-outline" @click="duplicateTpl(tpl.id)">复制</button>
            <button class="btn btn-sm btn-danger" @click.stop="deleteTpl(tpl.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <input ref="importFileRef" type="file" accept=".json" style="display:none" @change="onImportFile" />
    <input ref="importDocxRef" type="file" accept=".docx" style="display:none" @change="onImportDocxFile" />

    <Teleport to="body">
      <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
        <div class="modal card">
          <h3>新建模板</h3>
          <div class="form-group">
            <label>模板名称</label>
            <input v-model="newName" type="text" placeholder="如：月度运行报告" @keydown.enter="create" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <input v-model="newDesc" type="text" placeholder="模板用途说明" />
          </div>
          <div class="modal-actions">
            <button class="btn btn-outline" @click="showCreate = false">取消</button>
            <button class="btn btn-primary" @click="create">创建并编辑</button>
          </div>
        </div>
      </div>
    </Teleport>
    <DocxImportPreviewDialog
      :visible="!!docxDraft"
      :draft="docxDraft"
      :report-context="{ mode: 'create' }"
      :regression-history="getRegressionHistory(docxDraft?.meta?.sourceFileName)"
      :candidate-options="candidateOptions"
      mode="create"
      @close="docxDraft = null"
      @confirm="confirmCreateFromDocx"
      @export-report="exportDocxReport"
      @update:candidate-options="(v) => (candidateOptions = v)"
      @update:block-label="updateDraftBlockLabel"
      @move-block="moveDraftBlock"
      @remove-block="removeDraftBlock"
      @merge-block="mergeDraftBlock"
      @cleanup-blocks="cleanupDraftBlocks"
      @remove-candidates="removeCandidateBlocks"
    />
    <ToastContainer />
  </div>
</template>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
.tpl-list-page { padding: 20px 24px 24px; }
.page-header h2 { font-size:22px; }
.page-header-actions { display:flex; gap:8px; }
.page-filters { display:flex; align-items:center; gap:16px; padding:10px 14px; margin-bottom:14px; font-size:13px; }
.filter-item { display:inline-flex; align-items:center; gap:6px; cursor:pointer; user-select:none; }
.filter-summary { margin-left:auto; color:var(--c-text-secondary); }
.empty-state { text-align:center; padding:80px 0; color:var(--c-text-secondary); }
.tpl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(450px,1fr)); gap:16px; }
.tpl-card { transition:box-shadow .15s, transform .15s; }
.tpl-card:hover { box-shadow:var(--shadow-md); transform:translateY(-2px); }
.tpl-card-body { padding:20px; cursor:pointer; }
.tpl-card-body h3 { font-size:18px; margin-bottom:6px; }
.tpl-desc { font-size:15px; color:var(--c-text-secondary); margin-bottom:10px; line-height:1.4; min-height:42px; }
.tpl-card-meta { display:flex; align-items:center; gap:10px; font-size:12px; color:var(--c-text-secondary); }
.tpl-import-summary { display:flex; flex-wrap:wrap; gap:12px; margin-top:10px; font-size:12px; color:#92400e; }
.tpl-doc-count { font-size:15px; }
.badge-orange { background:#fff7ed; color:#c2410c; }
.badge-purple { background:#ede9fe; color:#6d28d9; }
.tpl-card-footer { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; border-top:1px solid var(--c-border); font-size:14px; color:var(--c-text-secondary); }
.tpl-card-actions { display:flex; gap:4px; }
</style>
