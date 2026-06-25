import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import {
  createDocumentFromTemplate,
  toOutline,
  paginateBlocks,
  createVersionRecord,
  buildChangeDetail,
  replaceVariables,
  insertBlock,
  removeBlock,
  moveBlock,
  normalizeDataSourceConfig,
} from '@/utils/document-helpers'
import {
  resourcePoolTemplate,
  resourcePoolDoc,
  documentVersions,
} from '@/mock/document-shanxi-cloud'
import {
  provincialReportTemplateFromMd,
  provincialReportDocFromMd,
} from '@/mock/provincial-report-md'

const PAGE_SIZE = 20

const allVersions = documentVersions

function generateId(prefix = 'tpl') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function validateFileBatch(blockDef, headers, records) {
  const errors = []
  const warnings = []

  if (!headers.length) {
    errors.push({ rowNo: 0, colName: '文件', message: '文件缺少表头' })
    return { errors, warnings }
  }

  if (!records.length) {
    warnings.push({ rowNo: 0, colName: '文件', message: '文件中没有数据行' })
  }

  if (blockDef.type === 'table') {
    const columns = blockDef.defaultContent?.columns ?? []
    columns.forEach((column) => {
      const title = normalizeText(column.title)
      if (!title) return
      if (!headers.includes(title)) {
        errors.push({ rowNo: 0, colName: title, message: `缺少必需列「${title}」` })
      }
    })
  }

  if (blockDef.type === 'rich_text' || blockDef.type === 'ai_content') {
    const variables = blockDef.defaultContent?.variables ?? []
    const firstRow = records[0] || {}
    variables.forEach((variable) => {
      const token = normalizeText(variable.key).replace(/^{{\s*/, '').replace(/\s*}}$/, '')
      const responseField = normalizeText(variable.responseField)
      const label = normalizeText(variable.label)
      const fields = [responseField, token, label].filter(Boolean)
      const matched = fields.some((field) => Object.prototype.hasOwnProperty.call(firstRow, field))
      if (!matched) {
        warnings.push({ rowNo: 1, colName: fields[0] || variable.key, message: `变量「${variable.label || variable.key}」未找到匹配列，将保留原值` })
      }
    })
  }

  return { errors, warnings }
}

function ensureTemplateDataSource(definition) {
  const normalized = normalizeDataSourceConfig(definition.dataSourceConfig)
  if (normalized) return normalized
  return {
    mode: 'api',
    apiEndpoint: '',
    sql: '',
    paramMapping: {},
    fileConfig: { publishedBatchId: '', batches: [] },
  }
}

function mergeTemplateDataSources(blockDefinitions = []) {
  return blockDefinitions.map((definition) => ({
    ...definition,
    dataSourceConfig: ensureTemplateDataSource(definition),
  }))
}

function simulateDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function simulateApiFetch(apiEndpoint, params = {}) {
  await simulateDelay(300)
  const now = new Date()
  const mockData = {}

  if (apiEndpoint.includes('stats/monthly') || apiEndpoint.includes('work-summary')) {
    mockData['totalTasks'] = Math.floor(Math.random() * 50) + 20
    mockData['completedTasks'] = Math.floor(Math.random() * 40) + 10
    mockData['month'] = `${now.getFullYear()}年${now.getMonth() + 1}月`
  }
  if (apiEndpoint.includes('service-unit') || apiEndpoint.includes('cloud')) {
    mockData['serviceUnits'] = Math.floor(Math.random() * 100) + 200
    mockData['systems'] = Math.floor(Math.random() * 500) + 800
    mockData['cpuUsage'] = (Math.random() * 30 + 40).toFixed(1) + '%'
    mockData['memoryUsage'] = (Math.random() * 20 + 50).toFixed(1) + '%'
    mockData['storageUsage'] = (Math.random() * 15 + 60).toFixed(1) + '%'
  }
  if (apiEndpoint.includes('security') || apiEndpoint.includes('attack')) {
    mockData['attacks'] = Math.floor(Math.random() * 10000) + 50000
    mockData['blocked'] = Math.floor(Math.random() * 8000) + 45000
    mockData['incidents'] = Math.floor(Math.random() * 10) + 1
  }
  if (apiEndpoint.includes('weekly/summary')) {
    const m = now.getMonth() + 1
    const d = now.getDate()
    mockData['weekRange'] = `${m}月${d - 4}日 - ${m}月${d}日`
    mockData['doneCount'] = Math.floor(Math.random() * 8) + 5
    mockData['doingCount'] = Math.floor(Math.random() * 5) + 1
    mockData['bugCount'] = Math.floor(Math.random() * 5)
  }
  if (apiEndpoint.includes('weekly/devstats')) {
    mockData['commitCount'] = Math.floor(Math.random() * 30) + 10
    mockData['actualHours'] = +(Math.random() * 10 + 32).toFixed(1)
    mockData['planHours'] = 40
    mockData['hourRate'] = ((mockData['actualHours']) / 40 * 100).toFixed(1) + '%'
  }
  if (apiEndpoint.includes('weekly/next-plan')) {
    const focuses = ['支付模块上线验收', '用户权限系统重构', '数据看板 v2 开发', '性能优化专项', 'API 网关升级']
    mockData['taskCount'] = Math.floor(Math.random() * 5) + 4
    mockData['focusItem'] = focuses[Math.floor(Math.random() * focuses.length)]
    mockData['planHours'] = 40
  }

  mockData['_fetchedAt'] = now.toISOString()
  return mockData
}

export const useDocumentStore = defineStore('document', () => {
  // ---------- 原始数据（模拟后端数据库） ----------
  const _allDocs = ref([resourcePoolDoc, provincialReportDocFromMd])
  const templates = ref(
    [resourcePoolTemplate, provincialReportTemplateFromMd].map((template) => ({
      ...template,
      blockDefinitions: mergeTemplateDataSources(template.blockDefinitions || []),
    })),
  )

  // ---------- 前端状态 ----------
  const currentDocId = ref(null)
  const currentOutline = ref(null)

  // 已加载的块缓存：blockId -> block
  const loadedBlocks = shallowRef(new Map())

  // 当前已加载到第几页
  const loadedPage = ref(0)
  const totalPages = ref(0)
  const isLoadingPage = ref(false)

  // 版本缓存：blockId -> versions[]
  const versionCache = ref(new Map())
  const loadingVersions = ref(new Set())
  const templateVersionCache = ref(new Map())

  // ---------- 计算属性 ----------

  const documentList = computed(() =>
    _allDocs.value.map((d) => ({
      id: d.id,
      title: d.title,
      templateId: d.templateId,
      blockCount: d.blocks.length,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      createdBy: d.createdBy,
      metadata: d.metadata,
    })),
  )

  const visibleBlocks = computed(() => {
    if (!currentOutline.value) return []
    const map = loadedBlocks.value
    return currentOutline.value.blockRefs
      .filter((ref) => map.has(ref.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((ref) => map.get(ref.id))
  })

  const hasMore = computed(() => loadedPage.value < totalPages.value)

  // ---------- 文档级操作 ----------

  function _findDoc(id) {
    return _allDocs.value.find((d) => d.id === id)
  }

  function getFullDocument(docId) {
    const id = docId ?? currentDocId.value
    if (!id) return null
    return _findDoc(id) ?? null
  }

  async function openDocument(docId) {
    const doc = _findDoc(docId)
    if (!doc) return

    currentDocId.value = docId
    loadedBlocks.value = new Map()
    versionCache.value = new Map()
    loadedPage.value = 0
    totalPages.value = 0

    currentOutline.value = toOutline(doc)
    totalPages.value = Math.ceil(doc.blocks.length / PAGE_SIZE)

    await loadNextPage()
  }

  function closeDocument() {
    currentDocId.value = null
    currentOutline.value = null
    loadedBlocks.value = new Map()
    versionCache.value = new Map()
    loadedPage.value = 0
    totalPages.value = 0
  }

  async function loadNextPage() {
    if (!currentDocId.value || isLoadingPage.value || !hasMore.value) return
    isLoadingPage.value = true

    const doc = _findDoc(currentDocId.value)
    if (!doc) {
      isLoadingPage.value = false
      return
    }

    await simulateDelay(80)
    const nextPage = loadedPage.value + 1
    const paged = paginateBlocks(doc, nextPage, PAGE_SIZE)

    const newMap = new Map(loadedBlocks.value)
    for (const block of paged.blocks) {
      newMap.set(block.id, block)
    }
    loadedBlocks.value = newMap
    loadedPage.value = nextPage
    totalPages.value = paged.totalPages
    isLoadingPage.value = false
  }

  // ---------- 版本历史（懒加载） ----------

  async function loadVersions(blockId) {
    if (versionCache.value.has(blockId)) {
      return versionCache.value.get(blockId)
    }
    if (loadingVersions.value.has(blockId)) return []

    loadingVersions.value.add(blockId)
    await simulateDelay(100)

    const versions = allVersions.get(blockId)
      ? JSON.parse(JSON.stringify(allVersions.get(blockId)))
      : []
    versionCache.value.set(blockId, versions)
    loadingVersions.value.delete(blockId)
    return versions
  }

  function getVersions(blockId) {
    return versionCache.value.get(blockId) ?? []
  }

  function isVersionsLoading(blockId) {
    return loadingVersions.value.has(blockId)
  }

  function getTemplateVersions(templateId) {
    return templateVersionCache.value.get(templateId) ?? []
  }

  function getLatestTemplateVersion(templateId) {
    const versions = templateVersionCache.value.get(templateId) ?? []
    return versions.length ? versions[versions.length - 1] : null
  }

  function summarizeTemplateBlockDiff(beforeTemplate, afterTemplate) {
    const beforeBlocks = beforeTemplate?.blockDefinitions ?? []
    const afterBlocks = afterTemplate?.blockDefinitions ?? []
    const beforeByKey = new Map(beforeBlocks.map((block, index) => [`${block.type}:${block.label}`, { block, index }]))
    const afterByKey = new Map(afterBlocks.map((block, index) => [`${block.type}:${block.label}`, { block, index }]))

    const added = []
    const removed = []

    afterBlocks.forEach((block, index) => {
      const key = `${block.type}:${block.label}`
      if (!beforeByKey.has(key)) {
        added.push({ index: index + 1, label: block.label, type: block.type })
      }
    })

    beforeBlocks.forEach((block, index) => {
      const key = `${block.type}:${block.label}`
      if (!afterByKey.has(key)) {
        removed.push({ index: index + 1, label: block.label, type: block.type })
      }
    })

    const relabeled = []
    const typeChanged = []
    const pairCount = Math.min(beforeBlocks.length, afterBlocks.length)
    for (let i = 0; i < pairCount; i += 1) {
      const before = beforeBlocks[i]
      const after = afterBlocks[i]
      if (before.label !== after.label) {
        relabeled.push({ index: i + 1, before: before.label, after: after.label })
      }
      if (before.type !== after.type) {
        typeChanged.push({ index: i + 1, before: before.type, after: after.type })
      }
    }

    return { added, removed, relabeled, typeChanged }
  }

  function recordTemplateVersion(templateId, beforeTemplate, afterTemplate, editedBy = 'system', changeType = 'docx_import', extraChanges = []) {
    const existing = templateVersionCache.value.get(templateId) ?? []
    const changes = [
      buildChangeDetail('name', beforeTemplate?.name ?? '', afterTemplate?.name ?? ''),
      buildChangeDetail('description', beforeTemplate?.description ?? '', afterTemplate?.description ?? ''),
      buildChangeDetail('blockDefinitions', beforeTemplate?.blockDefinitions ?? [], afterTemplate?.blockDefinitions ?? []),
      ...extraChanges,
    ]

    const version = createVersionRecord(
      templateId,
      afterTemplate,
      editedBy,
      changeType,
      changes,
      existing.length,
    )

    version.blockSummary = summarizeTemplateBlockDiff(beforeTemplate, afterTemplate)

    templateVersionCache.value.set(templateId, [...existing, version])
    return version
  }

  // ---------- 块编辑操作 ----------

  function updateLoadedBlock(blockId, updater) {
    const block = loadedBlocks.value.get(blockId)
    if (!block) return

    const updated = updater(block)
    const newMap = new Map(loadedBlocks.value)
    newMap.set(blockId, updated)
    loadedBlocks.value = newMap

    if (currentDocId.value) {
      const doc = _findDoc(currentDocId.value)
      if (doc) {
        const idx = doc.blocks.findIndex((b) => b.id === blockId)
        if (idx !== -1) doc.blocks[idx] = updated
      }
    }
  }

  function recordBlockEdit(blockId, field, oldValue, newValue, editedBy, changeType = 'manual_edit') {
    const block = loadedBlocks.value.get(blockId)
    if (!block) return

    const ver = createVersionRecord(
      blockId,
      block.content,
      editedBy,
      changeType,
      [buildChangeDetail(field, oldValue, newValue)],
      block.versionCount,
    )

    const existing = versionCache.value.get(blockId) ?? []
    versionCache.value.set(blockId, [...existing, ver])

    updateLoadedBlock(blockId, (b) => ({
      ...b,
      versionCount: b.versionCount + 1,
      updatedAt: new Date().toISOString(),
    }))
  }

  // ---------- 变量刷新 ----------

  async function refreshVariable(blockId, variableKey) {
    const block = loadedBlocks.value.get(blockId)
    if (!block) return
    if (block.type !== 'rich_text' && block.type !== 'ai_content') return

    const variable = block.content.variables.find(v => v.key === variableKey)
    if (!variable) return

    const apiData = await simulateApiFetch(variable.sourceApi)
    const fetchedAt = apiData['_fetchedAt']

    const sameApiVars = block.content.variables.filter(v => v.sourceApi === variable.sourceApi)
    const oldSnapshot = sameApiVars.map(v => ({ key: v.key, value: v.value }))

    updateLoadedBlock(blockId, (b) => {
      const updatedVars = b.content.variables.map(v => {
        if (v.sourceApi !== variable.sourceApi) return v
        const field = v.responseField || v.key
        const newVal = apiData[field] ?? v.value
        return { ...v, value: newVal, fetchedAt }
      })
      return { ...b, content: { ...b.content, variables: updatedVars }, updatedAt: new Date().toISOString() }
    })

    const updatedBlock = loadedBlocks.value.get(blockId)
    if (updatedBlock) {
      const newSnapshot = sameApiVars.map(v => {
        const updated = updatedBlock.content.variables.find(uv => uv.key === v.key)
        return { key: v.key, value: updated?.value ?? v.value }
      })
      const hasChange = oldSnapshot.some((o, i) => String(o.value) !== String(newSnapshot[i]?.value))
      if (hasChange) {
        recordBlockEdit(blockId, `variables[${variable.sourceApi}]`, oldSnapshot, newSnapshot, 'system', 'data_refresh')
      }
    }
  }

  async function refreshAllVariables(blockId) {
    const block = loadedBlocks.value.get(blockId)
    if (!block || (block.type !== 'rich_text' && block.type !== 'ai_content')) return
    if (!block.content.variables.length) return

    const apiGroups = new Map()
    for (const v of block.content.variables) {
      const list = apiGroups.get(v.sourceApi) ?? []
      list.push(v)
      apiGroups.set(v.sourceApi, list)
    }

    const allResults = new Map()
    for (const [api] of apiGroups) {
      const data = await simulateApiFetch(api)
      allResults.set(api, data)
    }

    const oldVars = block.content.variables.map(v => ({ key: v.key, value: v.value }))

    updateLoadedBlock(blockId, (b) => {
      const updatedVars = b.content.variables.map(v => {
        const apiData = allResults.get(v.sourceApi)
        if (!apiData) return v
        const field = v.responseField || v.key
        const newVal = apiData[field] ?? v.value
        return { ...v, value: newVal, fetchedAt: apiData['_fetchedAt'] }
      })
      return {
        ...b,
        content: { ...b.content, variables: updatedVars },
        updatedAt: new Date().toISOString(),
      }
    })

    const updatedBlock = loadedBlocks.value.get(blockId)
    if (updatedBlock) {
      const newVars = updatedBlock.content.variables.map(v => ({ key: v.key, value: v.value }))
      const hasChange = oldVars.some((o, i) => String(o.value) !== String(newVars[i]?.value))
      if (hasChange) {
        recordBlockEdit(blockId, 'variables', oldVars, newVars, 'system', 'data_refresh')
      }
    }
  }

  async function refreshBlockDataSource(blockId) {
    const block = loadedBlocks.value.get(blockId)
    if (!block || block.dataSource.mode === 'file' || !block.dataSource.apiEndpoint) return

    const apiData = await simulateApiFetch(block.dataSource.apiEndpoint, block.dataSource.params)
    const now = apiData['_fetchedAt']

    updateLoadedBlock(blockId, (b) => ({
      ...b,
      dataSource: { ...b.dataSource, fetchedAt: now },
      updatedAt: now,
    }))

    if (block.type === 'rich_text' || block.type === 'ai_content') {
      await refreshAllVariables(blockId)
    }
  }

  // ---------- 文档 CRUD ----------

  function createFromTemplate(templateId, title, createdBy, reportPeriod = null) {
    const tpl = templates.value.find((t) => t.id === templateId)
    if (!tpl) return null
    const doc = createDocumentFromTemplate(tpl, createdBy, { reportPeriod })
    doc.title = title
    _allDocs.value.push(doc)
    return doc
  }

  function deleteDocument(docId) {
    _allDocs.value = _allDocs.value.filter((d) => d.id !== docId)
    if (currentDocId.value === docId) closeDocument()
  }

  function updateDocumentTitle(docId, title) {
    const doc = _findDoc(docId)
    const nextTitle = normalizeText(title)
    if (!doc || !nextTitle) return null
    doc.title = nextTitle
    doc.updatedAt = new Date().toISOString()
    if (currentDocId.value === docId) currentOutline.value = toOutline(doc)
    return doc
  }

  function addBlock(blockId, block, atIndex) {
    const doc = currentDocId.value ? _findDoc(currentDocId.value) : null
    if (!doc) return
    doc.blocks = insertBlock(doc.blocks, block, atIndex)
    currentOutline.value = toOutline(doc)
    const newMap = new Map(loadedBlocks.value)
    newMap.set(block.id, block)
    loadedBlocks.value = newMap
  }

  function deleteBlock(blockId) {
    const doc = currentDocId.value ? _findDoc(currentDocId.value) : null
    if (!doc) return
    doc.blocks = removeBlock(doc.blocks, blockId)
    currentOutline.value = toOutline(doc)
    const newMap = new Map(loadedBlocks.value)
    newMap.delete(blockId)
    loadedBlocks.value = newMap
  }

  function reorderBlock(blockId, newIndex) {
    const doc = currentDocId.value ? _findDoc(currentDocId.value) : null
    if (!doc) return
    doc.blocks = moveBlock(doc.blocks, blockId, newIndex)
    currentOutline.value = toOutline(doc)
  }

  // ---------- 模板管理 ----------

  function getTemplate(tplId) {
    return templates.value.find(t => t.id === tplId)
  }

  function createTemplate(name, description) {
    const tpl = {
      id: generateId('tpl'),
      name,
      description,
      blockDefinitions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    templates.value.push(tpl)
    return tpl
  }

  function updateTemplate(tplId, patch) {
    const tpl = templates.value.find(t => t.id === tplId)
    if (!tpl) return null
    if (patch.name !== undefined) tpl.name = patch.name
    if (patch.description !== undefined) tpl.description = patch.description
    if (patch.blockDefinitions !== undefined) {
      tpl.blockDefinitions = mergeTemplateDataSources(patch.blockDefinitions)
    }
    tpl.updatedAt = new Date().toISOString()
    return tpl
  }

  function upsertTemplateBlockDataSource(templateId, blockId, nextDataSourceConfig) {
    const tpl = templates.value.find((item) => item.id === templateId)
    if (!tpl) return null
    const block = tpl.blockDefinitions.find((item) => item.id === blockId)
    if (!block) return null
    block.dataSourceConfig = normalizeDataSourceConfig(nextDataSourceConfig)
    tpl.updatedAt = new Date().toISOString()
    return block
  }

  function importTemplateDataSourceFile(templateId, blockId, fileName, parsedData) {
    const tpl = templates.value.find((item) => item.id === templateId)
    if (!tpl) {
      return { ok: false, reason: '模板不存在', batch: null }
    }
    const block = tpl.blockDefinitions.find((item) => item.id === blockId)
    if (!block) {
      return { ok: false, reason: '块定义不存在', batch: null }
    }

    const dataSourceConfig = ensureTemplateDataSource(block)
    const headers = Array.isArray(parsedData?.headers) ? parsedData.headers.map((item) => normalizeText(item)) : []
    const records = Array.isArray(parsedData?.records) ? parsedData.records.map((row) => {
      const nextRow = {}
      Object.keys(row || {}).forEach((key) => {
        nextRow[normalizeText(key)] = normalizeText(row[key])
      })
      return nextRow
    }) : []
    const { errors, warnings } = validateFileBatch(block, headers, records)

    const batch = {
      id: generateId('batch'),
      fileName: normalizeText(fileName) || 'unnamed.csv',
      uploadedAt: new Date().toISOString(),
      totalCount: records.length,
      successCount: Math.max(records.length - errors.length, 0),
      failCount: errors.length,
      headers,
      rows: records,
      status: errors.length ? 'failed' : 'validated',
      errors,
      warnings,
      publishedAt: '',
    }

    dataSourceConfig.mode = 'file'
    dataSourceConfig.fileConfig.batches = [batch, ...(dataSourceConfig.fileConfig.batches || [])].slice(0, 20)
    block.dataSourceConfig = dataSourceConfig
    tpl.updatedAt = new Date().toISOString()

    return {
      ok: true,
      reason: '',
      batch,
    }
  }

  function publishTemplateDataSourceBatch(templateId, blockId, batchId) {
    const tpl = templates.value.find((item) => item.id === templateId)
    if (!tpl) return { ok: false, reason: '模板不存在' }
    const block = tpl.blockDefinitions.find((item) => item.id === blockId)
    if (!block) return { ok: false, reason: '块定义不存在' }

    const dataSourceConfig = ensureTemplateDataSource(block)
    const batch = dataSourceConfig.fileConfig.batches.find((item) => item.id === batchId)
    if (!batch) return { ok: false, reason: '批次不存在' }
    if (batch.errors?.length) return { ok: false, reason: '当前批次校验未通过，无法发布' }

    const publishedAt = new Date().toISOString()
    batch.status = 'published'
    batch.publishedAt = publishedAt
    dataSourceConfig.mode = 'file'
    dataSourceConfig.fileConfig.publishedBatchId = batchId
    block.dataSourceConfig = dataSourceConfig
    tpl.updatedAt = publishedAt

    return { ok: true, reason: '', batch }
  }

  function deleteTemplate(tplId) {
    const hasDoc = _allDocs.value.some(d => d.templateId === tplId)
    if (hasDoc) return { ok: false, reason: '该模板下有关联文档，无法删除' }
    templates.value = templates.value.filter(t => t.id !== tplId)
    return { ok: true, reason: '' }
  }

  function duplicateTemplate(tplId) {
    const src = templates.value.find(t => t.id === tplId)
    if (!src) return null
    const copy = {
      ...JSON.parse(JSON.stringify(src)),
      id: generateId('tpl'),
      name: `${src.name} (副本)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    copy.blockDefinitions = copy.blockDefinitions.map(bd => ({
      ...bd,
      id: generateId('def'),
    }))
    templates.value.push(copy)
    return copy
  }

  function importTemplate(data) {
    const tpl = {
      ...data,
      id: generateId('tpl'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    tpl.blockDefinitions = mergeTemplateDataSources((tpl.blockDefinitions || []).map((bd) => ({
      ...bd,
      id: generateId('def'),
    })))
    templates.value.push(tpl)
    return tpl
  }

  function replaceTemplateDraft(tplId, draft) {
    const tpl = templates.value.find((item) => item.id === tplId)
    if (!tpl) return null

    const beforeTemplate = JSON.parse(JSON.stringify(tpl))

    tpl.name = draft.name ?? tpl.name
    tpl.description = draft.description ?? tpl.description
    tpl.blockDefinitions = mergeTemplateDataSources((draft.blockDefinitions || []).map((bd, index) => ({
      ...bd,
      id: generateId('def'),
      sortOrder: index + 1,
    })))
    tpl.updatedAt = new Date().toISOString()
    recordTemplateVersion(tplId, beforeTemplate, tpl, 'docx-importer', 'docx_import')
    return tpl
  }

  function exportTemplateData(tplId) {
    const tpl = templates.value.find(t => t.id === tplId)
    if (!tpl) return null
    return JSON.parse(JSON.stringify(tpl))
  }

  function getTemplateDataSourceStats(tplId) {
    const tpl = templates.value.find((item) => item.id === tplId)
    if (!tpl) {
      return {
        totalBlocks: 0,
        enabledSourceBlocks: 0,
        fileSourceBlocks: 0,
        publishedFileBlocks: 0,
      }
    }

    const totalBlocks = tpl.blockDefinitions.length
    let enabledSourceBlocks = 0
    let fileSourceBlocks = 0
    let publishedFileBlocks = 0

    tpl.blockDefinitions.forEach((block) => {
      const ds = block.dataSourceConfig
      if (!ds) return
      enabledSourceBlocks += 1
      if (ds.mode === 'file') {
        fileSourceBlocks += 1
        if (ds.fileConfig?.publishedBatchId) {
          publishedFileBlocks += 1
        }
      }
    })

    return {
      totalBlocks,
      enabledSourceBlocks,
      fileSourceBlocks,
      publishedFileBlocks,
    }
  }

  return {
    templates,
    currentDocId,
    currentOutline,
    documentList,
    visibleBlocks,
    hasMore,
    isLoadingPage,
    loadedPage,
    totalPages,

    getFullDocument,
    openDocument,
    closeDocument,
    loadNextPage,

    loadVersions,
    getVersions,
    isVersionsLoading,
    getTemplateVersions,
    getLatestTemplateVersion,
    recordTemplateVersion,

    updateLoadedBlock,
    recordBlockEdit,

    refreshVariable,
    refreshAllVariables,
    refreshBlockDataSource,

    createFromTemplate,
    updateDocumentTitle,
    deleteDocument,
    addBlock,
    deleteBlock,
    reorderBlock,

    getTemplate,
    createTemplate,
    updateTemplate,
    upsertTemplateBlockDataSource,
    importTemplateDataSourceFile,
    publishTemplateDataSourceBatch,
    deleteTemplate,
    duplicateTemplate,
    importTemplate,
    replaceTemplateDraft,
    exportTemplateData,
    getTemplateDataSourceStats,
  }
})
