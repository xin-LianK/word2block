import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow as DocxTableRow,
  TableCell,
  WidthType,
  TableLayoutType,
  AlignmentType,
  BorderStyle,
} from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { replaceVariables } from './document-helpers'

const PT = 2
const TITLE_SIZE = 22 * PT
const H1_SIZE = 15 * PT
const H2_SIZE = 14 * PT
const H3_SIZE = 12 * PT
const BODY_SIZE = 12 * PT
const SMALL_SIZE = 10.5 * PT
const PAGE_WIDTH_TWIP = 11906
const PAGE_HEIGHT_TWIP = 16838
const PAGE_MARGIN = { top: 1573, right: 1134, bottom: 1134, left: 1134, header: 779, footer: 715, gutter: 0 }
const BODY_LINE = 360
const TITLE_LINE = 560
const FIRST_LINE_INDENT = 480
const TABLE_CELL_MARGIN_H = 108
const TABLE_CELL_MARGIN_V = 0

const FONT_EAST_ASIA = '宋体'
const FONT_ASCII = 'Times New Roman'
const COLOR_TITLE = '000000'
const COLOR_H1 = '000000'
const COLOR_H2 = '000000'
const COLOR_H3 = '000000'
const COLOR_BODY = '000000'
const COLOR_MUTED = '666666'

function makeRunOpts(text, style = {}) {
  return {
    text: toWordWrapText(text),
    bold: style.bold || undefined,
    italics: style.italic || undefined,
    underline: style.underline ? {} : undefined,
    strike: style.strike || undefined,
    color: style.color ? style.color.replace('#', '') : undefined,
    size: style.fontSize || undefined,
    font: { eastAsia: FONT_EAST_ASIA, ascii: FONT_ASCII, hAnsi: FONT_ASCII, cs: FONT_ASCII },
  }
}

function makeTemplateRun(text, options = {}) {
  return new TextRun(makeRunOpts(text, { fontSize: BODY_SIZE, color: COLOR_BODY, ...options }))
}

function makeTemplateParagraph(children, options = {}) {
  return new Paragraph({
    children,
    alignment: options.alignment,
    spacing: options.spacing || { line: BODY_LINE, lineRule: 'auto', before: 0, after: 0 },
    indent: options.indent === false ? undefined : (options.indent || { firstLine: FIRST_LINE_INDENT }),
    border: options.border,
  })
}

function makeParagraph(children, options = {}) {
  return makeTemplateParagraph(children, options)
}

function makeTextRun(text, options = {}) {
  return makeTemplateRun(text, options)
}

function collectInlineRuns(node, style, runs) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent || ''
      if (t) runs.push(new TextRun(makeRunOpts(t, style)))
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child
      const tag = el.tagName.toLowerCase()
      const s = { ...style }

      if (tag === 'b' || tag === 'strong') s.bold = true
      if (tag === 'i' || tag === 'em') s.italic = true
      if (tag === 'u') s.underline = true
      if (tag === 's' || tag === 'del' || tag === 'strike') s.strike = true

      const resolvedColor = resolveElementColor(el, s.color)
      if (resolvedColor) s.color = resolvedColor

      if (tag === 'br') {
        runs.push(new TextRun({ text: '', break: 1 }))
      } else {
        collectInlineRuns(el, s, runs)
      }
    }
  }
}

function rgbToHex(color) {
  if (!color) return COLOR_BODY
  if (color.startsWith('#')) return color.replace('#', '')
  const m = color.match(/\d+/g)
  if (!m || m.length < 3) return COLOR_BODY
  return m.slice(0, 3).map((n) => parseInt(n, 10).toString(16).padStart(2, '0')).join('')
}

function resolveElementColor(el, fallbackColor) {
  const colorAttr = el.getAttribute?.('color')
  const inlineColor = el.style?.color
  const computedColor = typeof window !== 'undefined' ? window.getComputedStyle(el).color : ''
  const rawColor = inlineColor || colorAttr || computedColor || fallbackColor || ''

  if (!rawColor || rawColor === 'inherit' || rawColor === 'initial' || rawColor === 'transparent') {
    return fallbackColor || undefined
  }

  return rgbToHex(rawColor)
}

function htmlToDocxParagraphs(html, baseSize = BODY_SIZE) {
  const div = document.createElement('div')
  div.innerHTML = html
  const paragraphs = []

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').trim()
      if (t) paragraphs.push(makeParagraph([makeTextRun(t, { fontSize: baseSize })]))
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      processElement(node)
    }
  }

  function processElement(el) {
    const tag = el.tagName.toLowerCase()

    if (['div', 'section', 'article', 'main'].includes(tag)) {
      Array.from(el.childNodes).forEach(processNode)
    } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const sz = tag === 'h1' ? H1_SIZE : tag === 'h2' ? H2_SIZE : H3_SIZE
      const clr = tag === 'h1' ? COLOR_H1 : tag === 'h2' ? COLOR_H2 : COLOR_H3
      const headingColor = resolveElementColor(el, clr)
      const runs = []
      collectInlineRuns(el, { bold: true, fontSize: sz, color: headingColor }, runs)
      if (!runs.length) runs.push(makeTextRun(el.textContent || '', { bold: true, fontSize: sz, color: headingColor }))
      paragraphs.push(makeParagraph(runs, {
        indent: tag === 'h1' ? false : { firstLine: 0 },
        spacing: { before: tag === 'h1' ? 240 : 100, after: 0, line: BODY_LINE, lineRule: 'auto' },
        alignment: tag === 'h1' ? AlignmentType.CENTER : undefined,
      }))
    } else if (tag === 'table') {
      paragraphs.push(htmlTableToDocx(el))
    } else if (tag === 'ul' || tag === 'ol') {
      el.querySelectorAll(':scope > li').forEach((li, idx) => {
        const prefix = tag === 'ol' ? `${idx + 1}. ` : '• '
        const runs = [makeTemplateRun(prefix)]
        collectInlineRuns(li, { fontSize: baseSize, color: COLOR_BODY }, runs)
        paragraphs.push(makeParagraph(runs, {
          indent: { left: 480, firstLine: 0 },
          spacing: { line: BODY_LINE, lineRule: 'auto', before: 0, after: 0 },
        }))
      })
    } else if (tag === 'blockquote') {
      const runs = []
      collectInlineRuns(el, { fontSize: baseSize, italic: true, color: COLOR_BODY }, runs)
      paragraphs.push(makeParagraph(runs, {
        indent: { left: 480, firstLine: 0 },
        border: { left: { style: BorderStyle.SINGLE, size: 4, color: '000000' } },
        spacing: { line: BODY_LINE, lineRule: 'auto', before: 100, after: 0 },
      }))
    } else if (tag === 'hr') {
      paragraphs.push(makeParagraph([makeTextRun('')], {
        indent: false,
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' } },
        spacing: { before: 100, after: 100 },
      }))
    } else {
      const runs = []
      collectInlineRuns(el, { fontSize: baseSize, color: resolveElementColor(el, COLOR_BODY) }, runs)
      if (runs.length) {
        paragraphs.push(makeParagraph(runs))
      }
    }
  }

  Array.from(div.childNodes).forEach(processNode)
  return paragraphs
}

function richTextToDocx(block) {
  const html = replaceVariables(block.content.html, block.content.variables)
  return htmlToDocxParagraphs(html)
}

function aiContentToDocx(block) {
  const html = replaceVariables(block.content.html, block.content.variables)
  return htmlToDocxParagraphs(html)
}

function tableCellBorders(color = '000000', size = 4) {
  const c = color.replace('#', '')
  const border = { style: BorderStyle.SINGLE, size, color: c }
  return { top: border, bottom: border, left: border, right: border }
}

function toAlignment(align) {
  if (align === 'center') return AlignmentType.CENTER
  if (align === 'right') return AlignmentType.RIGHT
  return AlignmentType.LEFT
}

function resolveTableColumnWidths(columns, tableWidthTwip) {
  const validWidths = columns.map((col) => {
    const width = Number(col?.width)
    return Number.isFinite(width) && width > 0 ? width : null
  })

  const fixedTotal = validWidths.reduce((sum, w) => sum + (w || 0), 0)
  const autoCount = validWidths.filter((w) => w == null).length
  const fallback = autoCount > 0 ? (fixedTotal > 0 ? fixedTotal / columns.length : 1) : 0

  const normalized = validWidths.map((w) => (w == null ? fallback : w))
  const normalizedTotal = normalized.reduce((sum, w) => sum + w, 0) || columns.length
  const widths = normalized.map((w) => Math.max(240, Math.floor((w / normalizedTotal) * tableWidthTwip)))

  const consumed = widths.reduce((sum, w) => sum + w, 0)
  const delta = tableWidthTwip - consumed
  if (delta !== 0 && widths.length > 0) widths[widths.length - 1] += delta

  return widths
}

function softWrapLongToken(token, chunkSize = 12) {
  if (!token || token.length <= chunkSize * 2) return token
  let out = ''
  for (let i = 0; i < token.length; i += chunkSize) {
    out += token.slice(i, i + chunkSize)
    if (i + chunkSize < token.length) out += '\u200b'
  }
  return out
}

function toWordWrapText(value) {
  const text = String(value || '')
  return text.replace(/\S{24,}/g, (m) => softWrapLongToken(m, 12))
}

function tableCellMargins() {
  return { top: TABLE_CELL_MARGIN_V, bottom: TABLE_CELL_MARGIN_V, left: TABLE_CELL_MARGIN_H, right: TABLE_CELL_MARGIN_H }
}

function htmlTableCellParagraphs(cell, isHeader, alignment) {
  if (!cell) {
    return [makeTemplateParagraph([makeTemplateRun('')], {
      indent: false,
      alignment,
      spacing: { before: 0, after: 0, line: BODY_LINE, lineRule: 'auto' },
    })]
  }

  const blockChildren = Array.from(cell.childNodes).filter((node) => node.nodeType === Node.ELEMENT_NODE && ['p', 'div'].includes(node.tagName.toLowerCase()))
  if (!blockChildren.length) {
    return [makeTemplateParagraph([makeTemplateRun((cell.textContent || '').trim(), { bold: isHeader })], {
      indent: false,
      alignment,
      spacing: { before: 0, after: 0, line: BODY_LINE, lineRule: 'auto' },
    })]
  }

  return blockChildren.map((child) => {
    const runs = []
    collectInlineRuns(child, { fontSize: BODY_SIZE, color: COLOR_BODY, bold: isHeader }, runs)
    return makeTemplateParagraph(runs.length ? runs : [makeTemplateRun((child.textContent || '').trim(), { bold: isHeader })], {
      indent: false,
      alignment,
      spacing: { before: 0, after: 0, line: BODY_LINE, lineRule: 'auto' },
    })
  })
}

function htmlTableToDocx(tableEl) {
  const rows = Array.from(tableEl.querySelectorAll('tr')).map((tr) => Array.from(tr.children))
  if (!rows.length) return makeParagraph([])
  const columnCount = Math.max(...rows.map((row) => row.length), 1)
  const tableWidthTwip = PAGE_WIDTH_TWIP - PAGE_MARGIN.left - PAGE_MARGIN.right
  const colWidths = Array.from({ length: columnCount }, () => Math.floor(tableWidthTwip / columnCount))
  return new Table({
    rows: rows.map((row, rowIndex) => new DocxTableRow({
      children: Array.from({ length: columnCount }).map((_, index) => {
        const cell = row[index]
        const isHeader = rowIndex === 0 || cell?.tagName?.toLowerCase() === 'th'
        return new TableCell({
          children: htmlTableCellParagraphs(cell, isHeader, AlignmentType.CENTER),
          width: { size: colWidths[index], type: WidthType.DXA },
          margins: tableCellMargins(),
          borders: tableCellBorders(),
        })
      }),
    })),
    width: { size: tableWidthTwip, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    columnWidths: colWidths,
  })
}

function tableToDocx(block) {
  const { columns, rows, style } = block.content
  const safeColumns = columns.length ? columns : [{ id: 'col_1', title: '', align: 'left' }]
  const tableWidthTwip = PAGE_WIDTH_TWIP - PAGE_MARGIN.left - PAGE_MARGIN.right
  const colWidths = resolveTableColumnWidths(safeColumns, tableWidthTwip)

  const headerCells = safeColumns.map((col, idx) => new TableCell({
    children: [makeTemplateParagraph([makeTextRun(toWordWrapText(col.title), {
      bold: true,
      color: COLOR_BODY,
      fontSize: BODY_SIZE,
    })], {
      indent: false,
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0, line: BODY_LINE, lineRule: 'auto' },
    })],
    width: { size: colWidths[idx], type: WidthType.DXA },
    margins: tableCellMargins(),
    borders: tableCellBorders(),
  }))

  const dataRows = rows.map((row, ri) => {
    const cells = safeColumns.map((col, idx) => {
      const cell = row.cells.find((c) => c.columnId === col.id)
      return new TableCell({
        children: [makeTemplateParagraph([makeTextRun(toWordWrapText(cell?.value || ''))], {
          indent: false,
          alignment: toAlignment(col.align),
          spacing: { before: 0, after: 0, line: BODY_LINE, lineRule: 'auto' },
        })],
        width: { size: colWidths[idx], type: WidthType.DXA },
        margins: tableCellMargins(),
        borders: tableCellBorders(),
      })
    })
    return new DocxTableRow({ children: cells })
  })

  const table = new Table({
    rows: [new DocxTableRow({ children: headerCells }), ...dataRows],
    width: { size: tableWidthTwip, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    columnWidths: colWidths,
  })
  return [table, makeParagraph([], { indent: false, spacing: { after: 100 } })]
}

function imageToDocx(block) {
  return [makeParagraph([
    makeTextRun(`[图片: ${block.content.alt || block.content.url}]`, { italics: true, color: COLOR_MUTED }),
  ], {
    alignment: toAlignment(block.content.alignment),
    indent: false,
  })]
}

function blockToDocx(block) {
  switch (block.type) {
    case 'rich_text': return richTextToDocx(block)
    case 'ai_content': return aiContentToDocx(block)
    case 'table': return tableToDocx(block)
    case 'image': return imageToDocx(block)
    default: return []
  }
}

const TEMPLATE_STYLES_URL = '/report-template/styles.xml'
let templateStylesPromise = null

async function loadTemplateStylesXml() {
  if (typeof fetch !== 'function') return null
  if (!templateStylesPromise) {
    templateStylesPromise = fetch(TEMPLATE_STYLES_URL)
      .then((response) => (response.ok ? response.text() : null))
      .catch(() => null)
  }
  return templateStylesPromise
}

function buildTemplateDocumentStyles() {
  const run = {
    font: { eastAsia: FONT_EAST_ASIA, ascii: FONT_ASCII, hAnsi: FONT_ASCII, cs: FONT_ASCII },
    size: BODY_SIZE,
    color: COLOR_BODY,
  }
  return {
    default: {
      document: {
        run,
        paragraph: {
          spacing: { line: BODY_LINE, lineRule: 'auto', before: 0, after: 0 },
        },
      },
    },
    paragraphStyles: [
      {
        id: 'ReportBody',
        name: 'Report Body',
        run,
        paragraph: {
          spacing: { line: BODY_LINE, lineRule: 'auto', before: 0, after: 0 },
          indent: { firstLine: FIRST_LINE_INDENT },
        },
      },
    ],
  }
}

export async function exportToWord(doc) {
  const sorted = [...doc.blocks].sort((a, b) => a.sortOrder - b.sortOrder)
  const children = [
    makeParagraph([makeTextRun(doc.title, { bold: true, fontSize: TITLE_SIZE, color: COLOR_TITLE })], {
      alignment: AlignmentType.CENTER,
      indent: false,
      spacing: { before: 240, after: 120, line: TITLE_LINE, lineRule: 'exact' },
    }),
  ]

  for (const block of sorted) {
    children.push(...blockToDocx(block))
  }

  const templateStylesXml = await loadTemplateStylesXml()
  const docxOptions = {
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH_TWIP, height: PAGE_HEIGHT_TWIP },
          margin: PAGE_MARGIN,
        },
      },
      children,
    }],
  }
  if (templateStylesXml) {
    docxOptions.externalStyles = templateStylesXml
  } else {
    docxOptions.styles = buildTemplateDocumentStyles()
  }

  const docx = new DocxDocument(docxOptions)
  const blob = await Packer.toBlob(docx)
  saveAs(blob, `${doc.title}.docx`)
}

function makePreviewShell(html) {
  return `<div style="font-family:'Times New Roman','宋体',SimSun,serif;color:#000;font-size:16px;line-height:1.5">${html}</div>`
}

function blockToHtml(block) {
  switch (block.type) {
    case 'rich_text': {
      const html = replaceVariables(block.content.html, block.content.variables)
      return `<div class="export-rich-text" style="margin-bottom:12px">${html}</div>`
    }
    case 'ai_content': {
      const html = replaceVariables(block.content.html, block.content.variables)
      return `<div class="export-rich-text" style="margin-bottom:12px">${html}</div>`
    }
    case 'table': {
      const { columns, rows, style } = block.content
      const bw = 1
      const bc = '#000000'
      let t = ''
      if (block.content.title) {
        t += `<h3 style="font-size:18px;font-weight:700;color:#000;margin:12px 0 6px 0;line-height:1.5">${block.content.title}</h3>`
      }
      t += '<table style="width:100%;border-collapse:collapse;margin:8px 0 12px;table-layout:fixed;font-family:\'Times New Roman\',\'宋体\',SimSun,serif;color:#000;line-height:1.5">'
      t += '<thead><tr>'
      for (const col of columns) {
        t += `<th style="background:#fff;color:#000;padding:5px 7px;border:${bw}px solid ${bc};text-align:center;font-size:16px;font-weight:bold;word-wrap:break-word;line-height:1.5">${col.title}</th>`
      }
      t += '</tr></thead><tbody>'
      rows.forEach((row, ri) => {
        t += '<tr>'
        for (const col of columns) {
          const cell = row.cells.find((c) => c.columnId === col.id)
          t += `<td style="padding:5px 7px;border:${bw}px solid ${bc};text-align:${col.align};font-size:16px;word-wrap:break-word;color:#000;line-height:1.5">${cell?.value || ''}</td>`
        }
        t += '</tr>'
      })
      t += '</tbody></table>'
      return t
    }
    case 'image':
      return `<div style="text-align:${block.content.alignment};margin:8px 0"><img src="${block.content.url}" alt="${block.content.alt}" style="max-width:100%;height:auto" /></div>`
    default:
      return ''
  }
}

export function buildExportPreviewHtml(doc) {
  const sorted = [...(doc?.blocks || [])].sort((a, b) => a.sortOrder - b.sortOrder)
  let html = ''
  html += `<style>.export-rich-text h1{font-size:21.33px;text-align:center;margin:16px 0 0;line-height:1.5;color:#000}.export-rich-text h2{font-size:20px;margin:7px 0 0;line-height:1.5;color:#000}.export-rich-text h3{font-size:18.67px;margin:7px 0 0;line-height:1.5;color:#000}.export-rich-text p{margin:0;text-indent:2em;line-height:1.5;color:#000}.export-rich-text table{width:100%;border-collapse:collapse;margin:8px 0 12px;table-layout:fixed;font-family:'Times New Roman','宋体',SimSun,serif;color:#000}.export-rich-text th,.export-rich-text td{border:1px solid #000;padding:5px 7px;font-size:16px;line-height:1.5;color:#000}.export-rich-text th{font-weight:700;text-align:center;background:#fff}.export-rich-text ul,.export-rich-text ol{margin:0 0 0 2em;padding:0;line-height:1.5}.export-rich-text li{margin:0;line-height:1.5}.export-rich-text blockquote{margin:6px 0;padding-left:12px;border-left:2px solid #000;color:#000}.export-rich-text hr{border:none;border-top:1px solid #000;margin:8px 0}</style>`
  html += `<h1 style="font-size:29.33px;font-weight:700;text-align:center;color:#000;margin:16px 0 8px;line-height:1.5">${doc?.title || ''}</h1>`
  for (const block of sorted) html += blockToHtml(block)
  return makePreviewShell(html)
}

export async function exportToPdf(doc) {
  const A4_W = 210
  const A4_H = 297
  const MARGIN = 0
  const cw = A4_W - MARGIN * 2
  const pageContentH = A4_H - MARGIN * 2

  const container = document.createElement('div')
  container.style.cssText = [
    'position:fixed', 'left:0', 'top:0',
    'width:794px', 'height:auto',
    'opacity:0', 'pointer-events:none',
    'z-index:-1',
  ].join(';')

  document.body.appendChild(container)

  try {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    let hasPage = false

    const renderHtmlToPdf = async (html) => {
      container.innerHTML = `<div style="width:794px;padding:74px 76px 54px;background:white;font-family:'Times New Roman','宋体',SimSun,serif;color:#000;line-height:1.5;font-size:16px;box-sizing:border-box">${html}</div>`
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      const pageEl = container.firstElementChild
      if (!pageEl || pageEl.scrollWidth === 0 || pageEl.scrollHeight === 0) return

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: Math.max(pageEl.scrollHeight, 1123),
      })

      if (!canvas.width || !canvas.height) return

      const scaledH = (canvas.height * cw) / canvas.width
      const totalPages = Math.ceil(scaledH / pageContentH)

      for (let page = 0; page < totalPages; page += 1) {
        if (hasPage) pdf.addPage()
        hasPage = true

        const srcY = (page * pageContentH / scaledH) * canvas.height
        const srcH = Math.min((pageContentH / scaledH) * canvas.height, canvas.height - srcY)

        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = Math.ceil(srcH)
        const ctx = sliceCanvas.getContext('2d')
        if (!ctx) continue
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

        const sliceData = sliceCanvas.toDataURL('image/png')
        const sliceDisplayH = (srcH * cw) / canvas.width
        pdf.addImage(sliceData, 'PNG', MARGIN, MARGIN, cw, sliceDisplayH)
      }
    }

    const makeDocHeader = () => {
      let html = ''
      html += `<style>.export-rich-text h1{font-size:21.33px;text-align:center;margin:16px 0 0;line-height:1.5;color:#000}.export-rich-text h2{font-size:20px;margin:7px 0 0;line-height:1.5;color:#000}.export-rich-text h3{font-size:18.67px;margin:7px 0 0;line-height:1.5;color:#000}.export-rich-text p{margin:0;text-indent:2em;line-height:1.5;color:#000}.export-rich-text table{width:100%;border-collapse:collapse;margin:8px 0 12px;table-layout:fixed;font-family:'Times New Roman','宋体',SimSun,serif;color:#000}.export-rich-text th,.export-rich-text td{border:1px solid #000;padding:5px 7px;font-size:16px;line-height:1.5;color:#000}.export-rich-text th{font-weight:700;text-align:center;background:#fff}.export-rich-text ul,.export-rich-text ol{margin:0 0 0 2em;padding:0;line-height:1.5}.export-rich-text li{margin:0;line-height:1.5}</style>`
      html += `<h1 style="font-size:29.33px;font-weight:700;text-align:center;color:#000;margin:16px 0 8px;line-height:1.5">${doc?.title || ''}</h1>`
      return makePreviewShell(html)
    }

    const tableRowsPerChunk = (columns = []) => {
      if (columns.length >= 12) return 12
      if (columns.length >= 8) return 18
      if (columns.length >= 6) return 28
      return 36
    }

    const sorted = [...(doc?.blocks || [])].sort((a, b) => a.sortOrder - b.sortOrder)
    let firstHtml = makeDocHeader()

    for (const block of sorted) {
      if (block.type === 'table') {
        if (firstHtml.trim()) {
          await renderHtmlToPdf(firstHtml)
          firstHtml = ''
        }

        const rows = block.content?.rows || []
        const columns = block.content?.columns || []
        const chunkSize = tableRowsPerChunk(columns)

        if (!rows.length) {
          await renderHtmlToPdf(blockToHtml(block))
          continue
        }

        for (let start = 0; start < rows.length; start += chunkSize) {
          const chunkRows = rows.slice(start, start + chunkSize)
          const chunkIndex = Math.floor(start / chunkSize) + 1
          const chunkCount = Math.ceil(rows.length / chunkSize)
          const chunkBlock = {
            ...block,
            content: {
              ...block.content,
              title: chunkCount > 1 ? `${block.content.title}（${chunkIndex}/${chunkCount}）` : block.content.title,
              rows: chunkRows,
            },
          }
          await renderHtmlToPdf(blockToHtml(chunkBlock))
        }
        continue
      }

      firstHtml += blockToHtml(block)
    }

    if (firstHtml.trim()) await renderHtmlToPdf(firstHtml)

    if (!hasPage) {
      await renderHtmlToPdf('<p>暂无可导出的内容</p>')
    }

    pdf.save(`${doc.title}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}
