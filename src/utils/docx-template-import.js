import mammoth from 'mammoth'
import { htmlToMarkdown, markdownToHtml } from '@/utils/document-helpers'

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function stripHtml(html = '') {
  return normalizeText(String(html).replace(/<[^>]+>/g, ' '))
}

function sanitizeFileName(fileName = '') {
  return String(fileName).replace(/\.[^.]+$/, '').trim()
}

function inferTemplateName(fileName, titleFromDoc) {
  return normalizeText(titleFromDoc || sanitizeFileName(fileName) || 'DOCX导入模板')
}

function extractVariables(text = '') {
  const matches = String(text).match(/{{\s*[^{}]+\s*}}/g) || []
  const unique = [...new Set(matches.map((item) => item.trim()))]
  return unique.map((token) => {
    const label = token.replace(/^{{\s*/, '').replace(/\s*}}$/, '').trim()
    return {
      key: token,
      label,
      value: '',
      sourceApi: '',
      responseField: label,
      fetchedAt: '',
    }
  })
}

function getHeadingTextFromHtml(html = '') {
  const match = String(html).match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)
  return match ? stripHtml(match[1]) : ''
}

function getHeadingLevelFromHtml(html = '') {
  const match = String(html).match(/<h([1-6])[^>]*>/i)
  return match ? Number(match[1]) : null
}

function inferRichTextLabel(html, index) {
  const heading = getHeadingTextFromHtml(html)
  if (heading) return `${index + 1}. ${heading}`
  const text = stripHtml(html)
  return `${index + 1}. ${text.slice(0, 24) || '正文内容'}`
}

function inferImageAlt(src = '', index = 0) {
  const lastSegment = String(src).split('/').pop() || ''
  return normalizeText(lastSegment) || `导入图片 ${index + 1}`
}

function inferTableHeaders(rows = []) {
  const firstRow = rows[0] || []
  return firstRow.map((cell, idx) => normalizeText(cell) || `列${idx + 1}`)
}

function normalizeHeaderTitles(headers = []) {
  const used = new Map()
  return headers.map((header, idx) => {
    const base = normalizeText(header) || `列${idx + 1}`
    const count = (used.get(base) || 0) + 1
    used.set(base, count)
    return count === 1 ? base : `${base}_${count}`
  })
}

function buildTableColumns(headers = []) {
  return headers.map((title, idx) => ({
    id: `col_${idx + 1}`,
    title,
    width: 'auto',
    align: 'left',
    headerStyle: {
      bgColor: '#1E40AF',
      textColor: '#FFFFFF',
      fontWeight: 'bold',
    },
  }))
}

function buildTableRows(bodyRows = [], columns = []) {
  return bodyRows.map((row, rowIndex) => ({
    id: `row_${rowIndex + 1}`,
    cells: columns.map((column, colIndex) => ({
      columnId: column.id,
      value: normalizeText(row[colIndex] ?? ''),
    })),
  }))
}

function tableNodeToMatrix(tableNode) {
  const rowNodes = [...tableNode.querySelectorAll('tr')]
  return rowNodes.map((row) => [...row.children].map((cell) => normalizeText(cell.textContent)))
}

function isMeaningfulNode(node) {
  if (!node) return false
  if (node.nodeType === Node.TEXT_NODE) return normalizeText(node.textContent).length > 0
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  const tag = node.tagName.toLowerCase()
  if (tag === 'table' || tag === 'img') return true
  return normalizeText(node.textContent).length > 0
}

function isHeadingNode(node) {
  return node?.nodeType === Node.ELEMENT_NODE && /^h[1-4]$/i.test(node.tagName)
}

function inferCandidateReasons({ html, rawText, index }) {
  const reasons = []
  const text = String(rawText || '').trim()
  const lowerText = text.toLowerCase()
  const heading = getHeadingTextFromHtml(html)

  const isVeryShort = text.length > 0 && text.length <= 6
  const hasDotLeaders = /[.．·•]{4,}/.test(text)
  const hasSectionPagePattern = /(\d+(\.\d+)+.*\d+$)|(第[一二三四五六七八九十0-9]+章.*\d+$)/.test(text)
  const hasFooterPattern = /第\s*\d+\s*页|page\s*\d+|共\s*\d+\s*页/i.test(text)
  const hasConfidentialPattern = /版权所有|保密|内部资料|未经许可|copyright|all rights reserved/i.test(lowerText)

  if (index === 0 && heading && text.length <= 40) {
    reasons.push('cover')
  }
  if (/目录|contents/i.test(text) || hasDotLeaders || hasSectionPagePattern) {
    reasons.push('toc')
  }
  if (hasFooterPattern) {
    reasons.push('footer')
  }
  if (hasConfidentialPattern) {
    reasons.push('header-footer')
  }
  if (isVeryShort && !heading) {
    reasons.push('short-noise')
  }

  return [...new Set(reasons)]
}

function splitTopLevelSegments(body) {
  const segments = []
  let currentRichNodes = []

  const flushRichNodes = () => {
    if (!currentRichNodes.length) return
    segments.push({ type: 'rich_text', nodes: currentRichNodes })
    currentRichNodes = []
  }

  ;[...body.childNodes].forEach((node) => {
    if (!isMeaningfulNode(node)) return

    if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'table') {
      flushRichNodes()
      segments.push({ type: 'table', node })
      return
    }

    if (isHeadingNode(node)) {
      flushRichNodes()
      currentRichNodes.push(node)
      return
    }

    if (currentRichNodes.length && currentRichNodes.some(isHeadingNode) && isHeadingNode(currentRichNodes[0]) && node.nodeType === Node.ELEMENT_NODE && /^img$/i.test(node.tagName)) {
      flushRichNodes()
    }

    currentRichNodes.push(node)
  })

  flushRichNodes()
  return segments
}

function buildRichTextBlock(html, index) {
  const normalizedHtml = String(html || '').trim() || '<p>请输入内容</p>'
  const markdown = htmlToMarkdown(normalizedHtml)
  const rawText = stripHtml(normalizedHtml)
  const candidateReasons = inferCandidateReasons({ html: normalizedHtml, rawText, index })
  const headingLevel = getHeadingLevelFromHtml(normalizedHtml)

  return {
    id: generateId('def'),
    type: 'rich_text',
    sortOrder: index + 1,
    label: inferRichTextLabel(normalizedHtml, index),
    required: false,
    importHints: { removableCandidate: candidateReasons.length > 0, candidateReasons, headingLevel },
    defaultContent: {
      markdown: markdown || htmlToMarkdown(markdownToHtml('请输入内容')),
      html: normalizedHtml,
      rawText,
      variables: extractVariables(normalizedHtml),
    },
    dataSourceConfig: null,
  }
}

function buildImageBlock(imageNode, index) {
  return {
    id: generateId('def'),
    type: 'image',
    sortOrder: index + 1,
    label: `${index + 1}. ${inferImageAlt(imageNode.getAttribute('alt') || imageNode.getAttribute('src'), index)}`,
    required: false,
    importHints: { removableCandidate: false, candidateReasons: [] },
    defaultContent: {
      url: imageNode.getAttribute('src') || '',
      alt: imageNode.getAttribute('alt') || inferImageAlt(imageNode.getAttribute('src'), index),
      width: 'auto',
      height: 'auto',
      alignment: 'center',
    },
    dataSourceConfig: null,
  }
}

function buildTableBlock(tableNode, index, sectionTitle = '') {
  const matrix = tableNodeToMatrix(tableNode)
  const normalizedHeaders = normalizeHeaderTitles(inferTableHeaders(matrix))
  const columns = buildTableColumns(normalizedHeaders)
  const rows = buildTableRows(matrix.slice(1), columns)
  const tableLabelBase = normalizeText(sectionTitle) || normalizedHeaders[0] || '表格块'

  return {
    id: generateId('def'),
    type: 'table',
    sortOrder: index + 1,
    label: `${index + 1}. ${tableLabelBase}${sectionTitle ? '（表格）' : ''}`,
    required: false,
    importHints: { removableCandidate: false, candidateReasons: [] },
    defaultContent: {
      columns,
      rows,
      style: {
        borderColor: '#E5E7EB',
        borderWidth: 1,
        headerBgColor: '#1E40AF',
        headerTextColor: '#FFFFFF',
        stripedRows: true,
        fontSize: 14,
      },
    },
    dataSourceConfig: null,
  }
}

function segmentToBlock(segment, index, context = {}) {
  if (segment.type === 'table') {
    return buildTableBlock(segment.node, index, context.lastSectionTitle)
  }

  const meaningfulElements = segment.nodes.filter((node) => node.nodeType === Node.ELEMENT_NODE)
  if (meaningfulElements.length === 1 && meaningfulElements[0].tagName.toLowerCase() === 'img') {
    return buildImageBlock(meaningfulElements[0], index)
  }

  const html = segment.nodes.map((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return `<p>${node.textContent}</p>`
    }
    return node.outerHTML
  }).join('')

  return buildRichTextBlock(html, index)
}

function mergeFragmentedSubheadingBlocks(blocks = []) {
  const result = []
  let i = 0

  while (i < blocks.length) {
    const current = blocks[i]
    const next = blocks[i + 1]

    const isMergeable =
      current?.type === 'rich_text' &&
      next?.type === 'rich_text' &&
      [2, 3, 4].includes(current.importHints?.headingLevel) &&
      String(current.defaultContent?.rawText || '').length <= 28

    if (isMergeable) {
      const merged = {
        ...current,
        defaultContent: {
          ...current.defaultContent,
          html: `${current.defaultContent?.html || ''}${next.defaultContent?.html || ''}`,
          markdown: `${current.defaultContent?.markdown || ''}\n\n${next.defaultContent?.markdown || ''}`.trim(),
          rawText: `${current.defaultContent?.rawText || ''} ${next.defaultContent?.rawText || ''}`.trim(),
          variables: [...(current.defaultContent?.variables || []), ...(next.defaultContent?.variables || [])],
        },
      }
      result.push(merged)
      i += 2
      continue
    }

    result.push(current)
    i += 1
  }

  return result.map((block, index) => ({ ...block, sortOrder: index + 1 }))
}

function buildFallbackBlock(index = 0) {
  return {
    id: generateId('def'),
    type: 'rich_text',
    sortOrder: index + 1,
    label: `${index + 1}. 正文内容`,
    required: false,
    importHints: { removableCandidate: true, candidateReasons: ['empty'] },
    defaultContent: {
      markdown: '请输入内容',
      html: '<p>请输入内容</p>',
      rawText: '请输入内容',
      variables: [],
    },
    dataSourceConfig: null,
  }
}

export async function parseDocxToTemplateDraft(file) {
  if (!file) throw new Error('未选择文件')
  if (!/\.docx$/i.test(file.name || '')) throw new Error('当前仅支持 .docx 文件')

  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Title'] => h1.doc-title:fresh",
      ],
      convertImage: mammoth.images.imgElement((image) => image.read('base64').then((base64) => ({
        src: `data:${image.contentType};base64,${base64}`,
      }))),
    },
  )

  const html = String(result.value || '').trim()
  const parser = new DOMParser()
  const doc = parser.parseFromString(html || '<p></p>', 'text/html')
  const body = doc.body
  const segments = splitTopLevelSegments(body)
  let lastSectionTitle = ''
  const mappedBlocks = (segments.length ? segments : [{ type: 'rich_text', nodes: [] }]).map((segment, index) => {
    if (segment.nodes?.length === 0) return buildFallbackBlock(index)
    const block = segmentToBlock(segment, index, { lastSectionTitle })
    if (block.type === 'rich_text') {
      const headingText = getHeadingTextFromHtml(block.defaultContent?.html)
      if (headingText) {
        lastSectionTitle = headingText
      }
    }
    return block
  })

  const rawBlockCount = mappedBlocks.length
  const blockDefinitions = mergeFragmentedSubheadingBlocks(mappedBlocks)

  const docTitle = body.querySelector('h1')?.textContent || ''
  const warnings = (result.messages || []).map((message) => message.message || String(message))

  return {
    name: inferTemplateName(file.name, docTitle),
    description: '由 DOCX 自动生成的模板草稿',
    blockDefinitions: blockDefinitions.length ? blockDefinitions : [buildFallbackBlock(0)],
    meta: {
      blockCount: blockDefinitions.length || 1,
      tableCount: blockDefinitions.filter((item) => item.type === 'table').length,
      imageCount: blockDefinitions.filter((item) => item.type === 'image').length,
      warningCount: warnings.length,
      rawBlockCount,
      reducedBlockCount: Math.max(rawBlockCount - blockDefinitions.length, 0),
      warnings,
      sourceFileName: file.name,
    },
  }
}
