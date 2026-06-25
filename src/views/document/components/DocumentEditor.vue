<script setup>
import { ref, watch, nextTick, onUnmounted, computed } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { isRichTextBlock, isTableBlock, isAIContentBlock } from '@/utils/document-helpers'
import { exportToWord, exportToPdf, buildExportPreviewHtml } from '@/utils/export-document'
import BlockWrapper from './BlockWrapper.vue'
import RichTextBlockEditor from './RichTextBlockEditor.vue'
import TableBlockEditor from './TableBlockEditor.vue'
import AIContentBlockEditor from './AIContentBlockEditor.vue'
import TocPanel from './TocPanel.vue'

const store = useDocumentStore()
const exporting = ref(null)
const showExportPreview = ref(false)
const previewDoc = ref(null)
const sentinelRef = ref()
const activeTocId = ref('')
const tocKeyword = ref('')
let observer = null
let tocObserver = null

const fullDocument = computed(() => store.getFullDocument())

function anchorId(blockId) {
  return `block-anchor-${blockId}`
}

function stripHtmlTags(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractHeadingFromHtml(html = '') {
  const headingMatch = String(html).match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)
  if (headingMatch?.[1]) {
    return stripHtmlTags(headingMatch[1])
  }
  return ''
}

function buildBlockTitle(block, idx) {
  if (block.type === 'rich_text') {
    const heading = extractHeadingFromHtml(block.content?.html)
    if (heading) return `${idx + 1}. ${heading}`
    const raw = stripHtmlTags(block.content?.rawText || block.content?.html)
    if (raw) return `${idx + 1}. ${raw.slice(0, 24)}`
  }

  if (block.type === 'table') {
    if (block.content?.title) return `${idx + 1}. ${block.content.title}`
    const firstCol = block.content?.columns?.[0]?.title
    if (firstCol) return `${idx + 1}. ${firstCol}（表格）`
    return `${idx + 1}. 表格块`
  }

  if (block.type === 'ai_content') {
    const heading = extractHeadingFromHtml(block.content?.html)
    if (heading) return `${idx + 1}. ${heading}`
    const raw = stripHtmlTags(block.content?.rawText || block.content?.prompt)
    if (raw) return `${idx + 1}. ${raw.slice(0, 24)}`
    return `${idx + 1}. AI 内容块`
  }

  return `${idx + 1}. 内容块`
}

const loadedBlockIds = computed(() => new Set(store.visibleBlocks.map((block) => block.id)))

const tocItems = computed(() => {
  const blocks = fullDocument.value?.blocks || []
  return blocks.map((block, idx) => ({
    id: block.id,
    label: buildBlockTitle(block, idx),
    badge: loadedBlockIds.value.has(block.id) ? '已加载' : '',
  }))
})

const filteredTocItems = computed(() => {
  const keyword = tocKeyword.value.trim().toLowerCase()
  if (!keyword) return tocItems.value
  return tocItems.value.filter((item) => item.label.toLowerCase().includes(keyword))
})

async function jumpToBlock(blockId) {
  activeTocId.value = blockId

  let target = document.getElementById(anchorId(blockId))
  let safeguard = 0
  while (!target && store.hasMore && safeguard < 500) {
    await store.loadNextPage()
    await nextTick()
    target = document.getElementById(anchorId(blockId))
    safeguard += 1
  }

  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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

      const blockId = visibleEntries[0].target.getAttribute('data-block-id')
      if (blockId) activeTocId.value = blockId
    },
    {
      root: null,
      rootMargin: '-130px 0px -60% 0px',
      threshold: [0.2, 0.5, 0.8],
    },
  )

  document.querySelectorAll('.block-anchor-target').forEach((element) => {
    tocObserver?.observe(element)
  })
}

async function onExportWord() {
  const doc = previewDoc.value || store.getFullDocument()
  if (!doc) return
  exporting.value = 'word'
  try {
    await exportToWord(doc)
  } catch (e) {
    console.error('[Export Word]', e)
    alert('导出 Word 失败，请查看控制台')
  } finally {
    exporting.value = null
  }
}

async function onExportPdf() {
  const doc = previewDoc.value || store.getFullDocument()
  if (!doc) return
  exporting.value = 'pdf'
  try {
    await exportToPdf(doc)
  } catch (e) {
    console.error('[Export PDF]', e)
    alert('导出 PDF 失败，请查看控制台')
  } finally {
    exporting.value = null
  }
}

function openExportPreview() {
  const doc = store.getFullDocument()
  if (!doc) return
  previewDoc.value = doc
  showExportPreview.value = true
}

function closeExportPreview() {
  showExportPreview.value = false
}

const exportPreviewHtml = computed(() => {
  if (!previewDoc.value) return ''
  return buildExportPreviewHtml(previewDoc.value)
})

function setupObserver() {
  observer?.disconnect()
  if (!sentinelRef.value) return

  observer = new IntersectionObserver(
    async (entries) => {
      if (entries[0]?.isIntersecting && store.hasMore && !store.isLoadingPage) {
        await store.loadNextPage()
        await nextTick()
        if (sentinelRef.value && store.hasMore) {
          const rect = sentinelRef.value.getBoundingClientRect()
          if (rect.top < window.innerHeight + 400) {
            store.loadNextPage()
          }
        }
      }
    },
    { rootMargin: '400px' },
  )
  observer.observe(sentinelRef.value)
}

watch(() => store.currentOutline, async () => {
  await nextTick()
  setupObserver()
  setupTocObserver()

  if (!activeTocId.value && tocItems.value.length) {
    activeTocId.value = tocItems.value[0].id
  }
})

watch(
  () => store.visibleBlocks.length,
  async () => {
    await nextTick()
    setupTocObserver()
  },
)

onUnmounted(() => {
  observer?.disconnect()
  tocObserver?.disconnect()
})

function onRichTextUpdate(block, html, rawText) {
  const oldHtml = block.content.html
  if (oldHtml === html) return

  store.updateLoadedBlock(block.id, (b) => ({ ...b, content: { ...b.content, html, rawText }, updatedAt: new Date().toISOString() }))
  store.recordBlockEdit(block.id, 'content.html', oldHtml, html, store.currentOutline?.createdBy ?? 'user')
}

function onAIUpdate(block, html, rawText) {
  const oldHtml = block.content.html
  if (oldHtml === html) return

  store.updateLoadedBlock(block.id, (b) => ({ ...b, content: { ...b.content, html, rawText }, updatedAt: new Date().toISOString() }))
  store.recordBlockEdit(block.id, 'content.html', oldHtml, html, store.currentOutline?.createdBy ?? 'user')
}

function onTableSave(block, content) {
  const oldContent = block.content
  store.updateLoadedBlock(block.id, (b) => ({ ...b, content: { ...content }, updatedAt: new Date().toISOString() }))
  store.recordBlockEdit(block.id, 'content', oldContent, content, store.currentOutline?.createdBy ?? 'user')
}

async function onRefreshVariable(block, variable) {
  await store.refreshVariable(block.id, variable.key)
}

async function onRefreshAllVariables(block) {
  await store.refreshAllVariables(block.id)
}

async function onRefreshBlockData(block) {
  await store.refreshBlockDataSource(block.id)
}

function onMoveUp(block, idx) { if (idx > 0) store.reorderBlock(block.id, idx - 1) }
function onMoveDown(block, idx) { if (idx < store.visibleBlocks.length - 1) store.reorderBlock(block.id, idx + 1) }
function onDelete(block) { if (confirm('确定要删除这个内容块吗？')) store.deleteBlock(block.id) }
</script>

<template>
  <div v-if="store.currentOutline" class="document-editor">
    <div class="doc-layout">
      <TocPanel
        title="内容目录"
        aria-label="文档内容目录"
        :items="tocItems"
        :keyword="tocKeyword"
        :active-id="activeTocId"
        search-placeholder="搜索标题..."
        empty-text="未找到匹配标题"
        @update:keyword="(v) => (tocKeyword = v)"
        @jump="jumpToBlock"
      />

      <main class="doc-main">
        <div class="doc-header">
          <div class="doc-header-top">
            <h2>{{ store.currentOutline.title }}</h2>
            <div class="doc-export-actions">
              <button class="btn btn-sm btn-outline export-btn" :disabled="!!exporting" @click="openExportPreview">
                <span class="export-icon">预</span>
                导出预览
              </button>
            </div>
          </div>
          <div class="doc-meta">
            <span>创建者: {{ store.currentOutline.createdBy }}</span>
            <span>总块数: {{ store.currentOutline.totalBlocks }}</span>
            <span>已加载: {{ store.visibleBlocks.length }}</span>
            <span v-if="store.totalPages > 1">页: {{ store.loadedPage }} / {{ store.totalPages }}</span>
          </div>
        </div>

        <div class="blocks-list">
          <div
            v-for="(block, idx) in store.visibleBlocks"
            :id="anchorId(block.id)"
            :key="block.id"
            :data-block-id="block.id"
            class="block-anchor-target"
          >
            <BlockWrapper
              :block="block"
              :index="idx"
              :total="store.visibleBlocks.length"
              @move-up="onMoveUp(block, idx)"
              @move-down="onMoveDown(block, idx)"
              @delete="onDelete(block)"
              @refresh-data="onRefreshBlockData(block)"
            >
              <RichTextBlockEditor
                v-if="isRichTextBlock(block)"
                :block="block"
                @update="(html, raw) => onRichTextUpdate(block, html, raw)"
                @refresh-variable="(v) => onRefreshVariable(block, v)"
                @refresh-all-variables="onRefreshAllVariables(block)"
              />
              <TableBlockEditor v-else-if="isTableBlock(block)" :block="block" @save="(content) => onTableSave(block, content)" />
              <AIContentBlockEditor v-else-if="isAIContentBlock(block)" :block="block" @update="(html, raw) => onAIUpdate(block, html, raw)" @regenerate="() => {}" />
            </BlockWrapper>
          </div>
        </div>

        <div ref="sentinelRef" class="load-sentinel">
          <div v-if="store.isLoadingPage" class="loading-indicator"><span class="spinner" />加载中...</div>
          <div v-else-if="!store.hasMore" class="load-end">全部内容已加载完成</div>
        </div>
      </main>
    </div>

    <Teleport to="body">
      <div v-if="showExportPreview" class="modal-overlay" @click.self="closeExportPreview">
        <div class="export-preview-modal card">
          <div class="export-preview-head">
            <h3>导出预览（Word 样式模拟）</h3>
            <div class="doc-export-actions">
              <button class="btn btn-sm btn-outline export-btn" :disabled="!!exporting" @click="onExportWord">
                <span v-if="exporting === 'word'" class="export-spin">↻</span>
                <span v-else class="export-icon">W</span>
                导出 Word
              </button>
              <button class="btn btn-sm btn-outline export-btn" :disabled="!!exporting" @click="onExportPdf">
                <span v-if="exporting === 'pdf'" class="export-spin">↻</span>
                <span v-else class="export-icon export-icon-pdf">P</span>
                导出 PDF
              </button>
              <button class="btn btn-sm btn-outline" @click="closeExportPreview">关闭</button>
            </div>
          </div>
          <div class="export-preview-body" v-html="exportPreviewHtml" />
        </div>
      </div>
    </Teleport>
  </div>
  <div v-else class="empty-state"><p>请从列表中选择一个文档进行编辑</p></div>
</template>

<style scoped>
.document-editor { animation: fadeIn .2s ease; }
@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
.doc-layout { position:relative; }
.doc-main { min-width:0; margin-right: 296px; }
.doc-header { margin-bottom:24px; }
.doc-header-top { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:8px; }
.doc-header-top h2 { font-size:24px; margin:0; }
.doc-export-actions { display:flex; gap:8px; flex-shrink:0; }
.export-btn { display:inline-flex; align-items:center; gap:5px; font-weight:500; }
.export-btn:disabled { opacity:.6; cursor:wait; }
.export-icon { display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:3px; font-size:12px; font-weight:800; background:#2563eb; color:white; line-height:1; }
.export-icon-pdf { background:#dc2626; }
.export-spin { display:inline-block; font-size:16px; animation:spin .6s linear infinite; }
.doc-meta { display:flex; gap:16px; font-size:13px; color:var(--c-text-secondary); }
.blocks-list { display:flex; flex-direction:column; }
.block-anchor-target { scroll-margin-top: 90px; }
.empty-state { text-align:center; padding:80px 0; color:var(--c-text-secondary); }
.load-sentinel { padding:24px; text-align:center; }
.loading-indicator { display:inline-flex; align-items:center; gap:8px; color:var(--c-text-secondary); font-size:14px; }
.spinner { display:inline-block; width:18px; height:18px; border:2px solid var(--c-border); border-top-color:var(--c-primary); border-radius:50%; animation:spin .6s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.load-end { color:#94a3b8; font-size:13px; }
.export-preview-modal { width:min(1100px, 92vw); max-height:90vh; display:flex; flex-direction:column; }
.export-preview-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-bottom:1px solid var(--c-border); }
.export-preview-head h3 { margin:0; font-size:16px; }
.export-preview-body { overflow:auto; padding:24px 28px; background:#fff; line-height:1.7; color:#1e293b; }
.export-preview-body :deep(h1) { font-size:22px; margin:0 0 6px; }
.export-preview-body :deep(h2) { font-size:20px; margin:14px 0 8px; }
.export-preview-body :deep(h3) { font-size:17px; margin:12px 0 6px; }
.export-preview-body :deep(p) { margin:0 0 8px; }
.export-preview-body :deep(table) { width:100%; border-collapse:collapse; table-layout:fixed; margin:8px 0; }
.export-preview-body :deep(th), .export-preview-body :deep(td) { word-break:break-word; }

@media (max-width: 960px) {
  .doc-main { margin-right:0; }
}
</style>
