function extractAiContent(payload) {
  if (typeof payload === 'string') return payload.trim()
  const candidates = [
    payload?.choices?.[0]?.message?.content,
    payload?.choices?.[0]?.delta?.content,
    payload?.choices?.[0]?.text,
    payload?.content,
    payload?.message,
    payload?.answer,
    payload?.result,
    payload?.data?.content,
    payload?.data?.message,
    payload?.data?.answer,
    payload?.error?.message,
  ]
  const content = candidates.find((item) => typeof item === 'string' && item.trim())
  return content ? content.trim() : ''
}

async function readResponsePayload(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function chatWithAI(messages, onChunk, signal) {
  const apiUrl = import.meta.env.VITE_AI_API_URL
  const apiKey = import.meta.env.VITE_AI_API_KEY
  const model = import.meta.env.VITE_AI_MODEL
  if (!apiUrl || !model) {
    throw new Error('未配置 VITE_AI_API_URL 或 VITE_AI_MODEL')
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.25,
      max_tokens: 900,
    }),
  })

  const payload = await readResponsePayload(response)
  if (!response.ok) {
    throw new Error(extractAiContent(payload) || response.statusText || `AI 接口请求失败：${response.status}`)
  }

  const content = extractAiContent(payload)
  if (content) onChunk?.(content, content)
  return content
}
