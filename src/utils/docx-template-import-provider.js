export async function parseDocxToTemplateDraftPreferPython(file, options = {}) {
  const {
    parseWithPython,
    parseInBrowser,
    onFallback,
  } = options

  if (typeof parseWithPython === 'function') {
    try {
      return await parseWithPython(file)
    } catch (error) {
      if (typeof onFallback === 'function') {
        onFallback(error)
      }
    }
  }

  if (typeof parseInBrowser !== 'function') {
    throw new Error('缺少浏览器端 DOCX 解析器')
  }
  return parseInBrowser(file)
}
