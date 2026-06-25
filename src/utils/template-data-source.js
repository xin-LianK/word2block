import * as XLSX from 'xlsx'

function normalizeText(value) {
  return String(value ?? '').trim()
}

function escapeCsvCell(value) {
  const raw = String(value ?? '')
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

function parseCsv(content) {
  const text = String(content ?? '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        value += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && ch === ',') {
      row.push(value)
      value = ''
      continue
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i += 1
      row.push(value)
      rows.push(row)
      row = []
      value = ''
      continue
    }

    value += ch
  }

  if (value.length || row.length) {
    row.push(value)
    rows.push(row)
  }

  return rows.map((cols) => cols.map((col) => normalizeText(col)))
}

function rowsToObjects(rows = []) {
  const validRows = rows.filter((row) => row.some((cell) => normalizeText(cell)))
  if (!validRows.length) return { headers: [], records: [] }
  const headers = validRows[0].map((h, idx) => normalizeText(h) || `列${idx + 1}`)
  const records = validRows.slice(1).map((row) => {
    const obj = {}
    headers.forEach((header, idx) => {
      obj[header] = normalizeText(row[idx] ?? '')
    })
    return obj
  })
  return { headers, records }
}

function extensionOf(name = '') {
  const lower = String(name).toLowerCase()
  if (lower.endsWith('.xlsx')) return 'xlsx'
  if (lower.endsWith('.xls')) return 'xls'
  if (lower.endsWith('.csv')) return 'csv'
  return ''
}

export async function parseTemplateDataSourceFile(file) {
  const ext = extensionOf(file?.name || '')
  if (!ext) {
    throw new Error('仅支持 .csv / .xlsx / .xls 文件')
  }

  if (ext === 'csv') {
    const text = await file.text()
    return rowsToObjects(parseCsv(text))
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return { headers: [], records: [] }
  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
  return rowsToObjects(rows)
}

export function downloadTemplateCsv(blockDef) {
  const columns = []
  if (blockDef.type === 'table') {
    ;(blockDef.defaultContent?.columns || []).forEach((column) => {
      const title = normalizeText(column.title)
      if (title) columns.push(title)
    })
  } else if (blockDef.type === 'rich_text' || blockDef.type === 'ai_content') {
    ;(blockDef.defaultContent?.variables || []).forEach((variable) => {
      const responseField = normalizeText(variable.responseField)
      const label = normalizeText(variable.label)
      const token = normalizeText(variable.key).replace(/^{{\s*/, '').replace(/\s*}}$/, '')
      const field = responseField || token || label
      if (field && !columns.includes(field)) columns.push(field)
    })
  }

  const finalColumns = columns.length ? columns : ['字段1', '字段2']
  const rows = [finalColumns, finalColumns.map((name) => `${name}示例值`)]
  const csv = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n')

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${normalizeText(blockDef.label || 'datasource-template')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadBatchErrorsCsv(batch, blockLabel = 'block') {
  const errors = batch?.errors || []
  const warnings = batch?.warnings || []
  const headers = ['级别', '行号', '列名', '问题']
  const rows = [headers]

  errors.forEach((item) => {
    rows.push(['错误', item.rowNo ?? '', item.colName ?? '', item.message ?? ''])
  })
  warnings.forEach((item) => {
    rows.push(['警告', item.rowNo ?? '', item.colName ?? '', item.message ?? ''])
  })

  const csv = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${normalizeText(blockLabel)}-${normalizeText(batch?.id || 'batch')}-校验报告.csv`
  a.click()
  URL.revokeObjectURL(url)
}
