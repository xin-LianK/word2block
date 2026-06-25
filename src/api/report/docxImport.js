import { getToken } from '@/utils/auth'

function getBaseApi() {
  return String(import.meta.env.VITE_APP_BASE_API || '').replace(/\/$/, '')
}

function normalizeDraftResponse(payload) {
  const draft = payload?.data || payload?.draft || payload
  if (!draft?.name || !Array.isArray(draft.blockDefinitions)) {
    throw new Error('Python DOCX 服务返回格式不正确')
  }
  return draft
}

export async function parseDocxTemplateDraft(file) {
  if (!file) throw new Error('未选择文件')

  const formData = new FormData()
  formData.append('file', file)

  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${getBaseApi()}/report/template/import-docx/preview`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Python DOCX 服务请求失败：${response.status}`)
  }

  return normalizeDraftResponse(await response.json())
}
