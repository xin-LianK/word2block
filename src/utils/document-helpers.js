// ============================================================
// 文档辅助函数
// ============================================================

let counter = 0

function generateId(prefix) {
  counter += 1
  return `${prefix}_${Date.now()}_${counter}`
}

// ============================================================
// 从模板创建文档实例
// ============================================================

const DEFAULT_TABLE_STYLE = {
  borderColor: '#E5E7EB',
  borderWidth: 1,
  headerBgColor: '#1E40AF',
  headerTextColor: '#FFFFFF',
  stripedRows: true,
  fontSize: 14,
}

const EMPTY_DATA_SOURCE = {
  mode: 'api',
  apiEndpoint: '',
  sql: '',
  params: {},
  fetchedAt: new Date().toISOString(),
  fileBatchId: '',
  fileName: '',
}

function normalizeString(value) {
  return String(value ?? '').trim()
}

function stripVariableToken(key) {
  return normalizeString(key).replace(/^{{\s*/, '').replace(/\s*}}$/, '').trim()
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeMonthValue(value) {
  const text = normalizeString(value)
  if (/^\d{4}-\d{2}$/.test(text)) return text
  if (/^\d{6}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(0, 7)
  return ''
}

function normalizeDateValue(value) {
  const text = normalizeString(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`
  return ''
}

function monthParts(month) {
  const normalized = normalizeMonthValue(month)
  if (!normalized) return null
  const [year, monthNum] = normalized.split('-').map(Number)
  return { year, monthNum }
}

function dateParts(date) {
  const normalized = normalizeDateValue(date)
  if (!normalized) return null
  const [year, monthNum, day] = normalized.split('-').map(Number)
  return { year, monthNum, day }
}

function formatChineseMonth(month) {
  const parts = monthParts(month)
  if (!parts) return ''
  return `${parts.year}年${parts.monthNum}月`
}

function formatChineseDate(date) {
  const parts = dateParts(date)
  if (!parts) return ''
  return `${parts.year}年${parts.monthNum}月${parts.day}日`
}

function getLastDayOfMonth(month) {
  const parts = monthParts(month)
  if (!parts) return 1
  return new Date(parts.year, parts.monthNum, 0).getDate()
}

function buildReportPeriodContext(reportPeriod) {
  const startMonthInput = normalizeMonthValue(reportPeriod?.startMonth ?? reportPeriod?.month)
  const endMonthInput = normalizeMonthValue(reportPeriod?.endMonth ?? startMonthInput)
  let startDate = normalizeDateValue(reportPeriod?.startDate) || (startMonthInput ? `${startMonthInput}-01` : '')
  let endDate = normalizeDateValue(reportPeriod?.endDate) || (endMonthInput ? `${endMonthInput}-${String(getLastDayOfMonth(endMonthInput)).padStart(2, '0')}` : '')
  if (!startDate || !endDate) return null
  if (startDate > endDate) {
    const nextStartDate = endDate
    endDate = startDate
    startDate = nextStartDate
  }

  const startMonth = normalizeMonthValue(startDate)
  const endMonth = normalizeMonthValue(endDate)
  const endParts = monthParts(endMonth)
  const periodStart = formatChineseDate(startDate)
  const periodEnd = formatChineseDate(endDate)
  const periodLabel = startDate === endDate
    ? formatChineseDate(startDate)
    : `${formatChineseDate(startDate)}至${formatChineseDate(endDate)}`

  return {
    startDate,
    endDate,
    startMonth,
    endMonth,
    currentMonth: endMonth,
    month: endMonth,
    startMonthCompact: startMonth.replace('-', ''),
    endMonthCompact: endMonth.replace('-', ''),
    currentMonthCompact: endMonth.replace('-', ''),
    year: String(endParts.year),
    monthNum: String(endParts.monthNum),
    periodStart,
    periodEnd,
    periodLabel,
    quickLabel: normalizeString(reportPeriod?.quickLabel),
  }
}

function resolvePeriodValue(key, periodContext) {
  if (!periodContext) return undefined
  const normalizedKey = stripVariableToken(key)
  const values = {
    startMonth: periodContext.startMonth,
    endMonth: periodContext.endMonth,
    currentMonth: periodContext.currentMonth,
    month: periodContext.month,
    startMonthCompact: periodContext.startMonthCompact,
    endMonthCompact: periodContext.endMonthCompact,
    currentMonthCompact: periodContext.currentMonthCompact,
    year: periodContext.year,
    monthNum: periodContext.monthNum,
    periodStart: periodContext.periodStart,
    periodEnd: periodContext.periodEnd,
    periodLabel: periodContext.periodLabel,
    startDate: periodContext.startDate,
    endDate: periodContext.endDate,
    beginDate: periodContext.startDate,
    report_start_date: periodContext.startDate,
    report_end_date: periodContext.endDate,
    report_year: periodContext.year,
    report_month: periodContext.monthNum,
    report_period_start: periodContext.periodStart,
    report_period_end: periodContext.periodEnd,
  }
  return values[normalizedKey]
}

function buildDataSourceParams(dataSourceConfig, periodContext) {
  if (!periodContext) return {}
  const mapping = dataSourceConfig?.paramMapping || {}
  const params = {}

  Object.entries(mapping).forEach(([paramName, contextKey]) => {
    const value = resolvePeriodValue(contextKey, periodContext)
    if (value !== undefined) params[paramName] = value
  })

  if (!Object.keys(params).length) {
    params.month = periodContext.currentMonth
    params.startMonth = periodContext.startMonth
    params.endMonth = periodContext.endMonth
    params.startDate = periodContext.startDate
    params.endDate = periodContext.endDate
  }

  return params
}

function applyReportPeriodToVariables(content, periodContext) {
  const variables = Array.isArray(content?.variables) ? content.variables : []
  if (!periodContext || !variables.length) return content

  return {
    ...content,
    variables: variables.map((variable) => {
      const byResponseField = resolvePeriodValue(variable.responseField, periodContext)
      const byToken = resolvePeriodValue(variable.key, periodContext)
      const label = normalizeString(variable.label)
      let value = byResponseField ?? byToken

      if (value === undefined && label.includes('年份')) value = periodContext.year
      if (value === undefined && label.includes('月份')) value = periodContext.monthNum
      if (value === undefined && label.includes('起始日期')) value = periodContext.periodStart
      if (value === undefined && label.includes('结束日期')) value = periodContext.periodEnd

      return value === undefined
        ? variable
        : { ...variable, value, fetchedAt: new Date().toISOString() }
    }),
  }
}

export function normalizeDataSourceConfig(config) {
  if (!config) return null

  const mode = config.mode === 'file' ? 'file' : 'api'
  const fileConfig = config.fileConfig
    ? {
        publishedBatchId: normalizeString(config.fileConfig.publishedBatchId),
        batches: Array.isArray(config.fileConfig.batches)
          ? config.fileConfig.batches.map((batch) => ({ ...batch }))
          : [],
      }
    : { publishedBatchId: '', batches: [] }

  return {
    mode,
    apiEndpoint: normalizeString(config.apiEndpoint),
    sql: normalizeString(config.sql),
    paramMapping: config.paramMapping && typeof config.paramMapping === 'object'
      ? { ...config.paramMapping }
      : {},
    fileConfig,
  }
}

export function getPublishedFileBatch(dataSourceConfig) {
  const ds = normalizeDataSourceConfig(dataSourceConfig)
  if (!ds || ds.mode !== 'file') return null
  const publishedId = ds.fileConfig.publishedBatchId
  if (!publishedId) return null
  return ds.fileConfig.batches.find((batch) => batch.id === publishedId) ?? null
}

export function applyFileRowsToDefaultContent(definition, sourceRows = []) {
  const rows = Array.isArray(sourceRows) ? sourceRows : []
  const nextContent = cloneDeep(definition.defaultContent || {})
  if (!rows.length) return nextContent

  if (definition.type === 'table') {
    const columns = Array.isArray(nextContent.columns) ? nextContent.columns : []
    nextContent.rows = rows.map((row, rowIndex) => ({
      id: `row_${Date.now()}_${rowIndex + 1}`,
      cells: columns.map((column) => ({
        columnId: column.id,
        value: String(row[normalizeString(column.title)] ?? ''),
      })),
    }))
    return nextContent
  }

  if (definition.type === 'rich_text' || definition.type === 'ai_content') {
    const firstRow = rows[0] || {}
    const variables = Array.isArray(nextContent.variables) ? nextContent.variables : []
    nextContent.variables = variables.map((variable) => {
      const responseField = normalizeString(variable.responseField)
      const tokenField = stripVariableToken(variable.key)
      const labelField = normalizeString(variable.label)
      const fieldCandidates = [responseField, tokenField, labelField].filter(Boolean)

      let nextValue = variable.value
      for (const field of fieldCandidates) {
        if (Object.prototype.hasOwnProperty.call(firstRow, field)) {
          nextValue = firstRow[field]
          break
        }
      }
      return { ...variable, value: nextValue, fetchedAt: new Date().toISOString() }
    })
    return nextContent
  }

  return nextContent
}

export function markdownToHtml(markdown = '') {
  const text = String(markdown).replace(/\r\n/g, '\n')
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const lines = escaped.split('\n')
  const htmlLines = lines.map((line) => {
    if (!line.trim()) return ''
    if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
    if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`
    if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`
    return `<p>${line}</p>`
  })

  return htmlLines
    .join('\n')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

export function htmlToMarkdown(html = '') {
  const text = String(html)
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function buildBlockFromDefinition(def, periodContext) {
  const normalizedDataSource = normalizeDataSourceConfig(def.dataSourceConfig)
  const publishedBatch = getPublishedFileBatch(normalizedDataSource)
  const publishedRows = Array.isArray(publishedBatch?.rows) ? publishedBatch.rows : []
  const now = new Date().toISOString()

  const base = {
    id: generateId('blk'),
    definitionId: def.id,
    sortOrder: def.sortOrder,
    dataSource: normalizedDataSource
      ? {
          mode: normalizedDataSource.mode,
          apiEndpoint: normalizedDataSource.apiEndpoint,
          sql: normalizedDataSource.sql,
          params: buildDataSourceParams(normalizedDataSource, periodContext),
          fetchedAt: publishedBatch?.publishedAt || publishedBatch?.uploadedAt || now,
          fileBatchId: publishedBatch?.id || '',
          fileName: publishedBatch?.fileName || '',
        }
      : { ...EMPTY_DATA_SOURCE },
    versionCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  switch (def.type) {
    case 'rich_text':
      {
        let richDefault = applyFileRowsToDefaultContent(def, publishedRows)
        if (richDefault.markdown && !richDefault.html) {
          richDefault.html = markdownToHtml(richDefault.markdown)
        }
        richDefault = applyReportPeriodToVariables(richDefault, periodContext)
        return {
          ...base,
          type: 'rich_text',
          content: {
            html: '',
            rawText: '',
            variables: [],
            ...richDefault,
          },
        }
      }

    case 'table':
      return {
        ...base,
        type: 'table',
        content: {
          columns: [],
          rows: [],
          style: { ...DEFAULT_TABLE_STYLE },
          ...applyFileRowsToDefaultContent(def, publishedRows),
        },
      }

    case 'ai_content':
      {
        const aiDefault = applyReportPeriodToVariables(applyFileRowsToDefaultContent(def, publishedRows), periodContext)
        return {
          ...base,
          type: 'ai_content',
          content: {
            html: '',
            rawText: '',
            prompt: '',
            model: '',
            variables: [],
            ...aiDefault,
          },
        }
      }

    case 'image':
      return {
        ...base,
        type: 'image',
        content: {
          url: '',
          alt: '',
          width: 'auto',
          height: 'auto',
          alignment: 'center',
          ...(def.defaultContent || {}),
        },
      }

    default:
      return {
        ...base,
        type: def.type,
        content: def.defaultContent || {},
      }
  }
}

export function createDocumentFromTemplate(template, createdBy, options = {}) {
  const now = new Date().toISOString()
  const periodContext = buildReportPeriodContext(options.reportPeriod)
  const blocks = template.blockDefinitions
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((definition) => buildBlockFromDefinition(definition, periodContext))

  return {
    id: generateId('doc'),
    title: '',
    templateId: template.id,
    blocks,
    createdAt: now,
    updatedAt: now,
    createdBy,
    metadata: periodContext ? { reportPeriod: periodContext } : {},
  }
}

// ============================================================
// 文档 <-> 骨架 转换
// ============================================================

export function toBlockRef(block) {
  return {
    id: block.id,
    type: block.type,
    sortOrder: block.sortOrder,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    versionCount: block.versionCount,
  }
}

export function toOutline(doc) {
  return {
    id: doc.id,
    title: doc.title,
    templateId: doc.templateId,
    blockRefs: doc.blocks.map(toBlockRef),
    totalBlocks: doc.blocks.length,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy,
    metadata: doc.metadata,
  }
}

// ============================================================
// 分页
// ============================================================

export function paginateBlocks(doc, page, pageSize) {
  const total = doc.blocks.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const blocks = doc.blocks.slice(start, start + pageSize)
  return { docId: doc.id, page, pageSize, total, totalPages, blocks }
}

// ============================================================
// 版本记录
// ============================================================

export function createVersionRecord(blockId, content, editedBy, changeType, changes, currentVersionCount) {
  return {
    id: generateId('ver'),
    blockId,
    version: currentVersionCount + 1,
    timestamp: new Date().toISOString(),
    editedBy,
    changeType,
    changes,
    snapshot: JSON.stringify(content),
  }
}

export function buildChangeDetail(field, oldValue, newValue) {
  return { field, oldValue, newValue }
}

// ============================================================
// 变量替换
// ============================================================

export function replaceVariables(html, variables) {
  let result = html
  for (const v of variables) {
    result = result.split(v.key).join(String(v.value))
  }
  return result
}

export function mergeVariables(existing, updates) {
  const updateMap = new Map(updates.map((u) => [u.key, u]))
  return existing.map((v) => {
    const patch = updateMap.get(v.key)
    return patch ? { ...v, value: patch.value, fetchedAt: patch.fetchedAt } : v
  })
}

// ============================================================
// 内容块操作（纯函数）
// ============================================================

export function insertBlock(blocks, block, atIndex) {
  const result = [...blocks]
  const idx = atIndex ?? result.length
  result.splice(idx, 0, block)
  return result.map((b, i) => ({ ...b, sortOrder: i + 1 }))
}

export function removeBlock(blocks, blockId) {
  return blocks
    .filter((b) => b.id !== blockId)
    .map((b, i) => ({ ...b, sortOrder: i + 1 }))
}

export function moveBlock(blocks, blockId, newIndex) {
  const idx = blocks.findIndex((b) => b.id === blockId)
  if (idx === -1) return blocks
  const result = [...blocks]
  const [moved] = result.splice(idx, 1)
  result.splice(newIndex, 0, moved)
  return result.map((b, i) => ({ ...b, sortOrder: i + 1 }))
}

// ============================================================
// 类型守卫（用 type 字段判断）
// ============================================================

export function isRichTextBlock(block) {
  return block.type === 'rich_text'
}

export function isTableBlock(block) {
  return block.type === 'table'
}

export function isAIContentBlock(block) {
  return block.type === 'ai_content'
}

export function isImageBlock(block) {
  return block.type === 'image'
}
