// Sub-proyecto D — OpenAI Chat Completions adapter.

import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../llmService.js'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const MAX_TOKENS = 4096

export async function call({ apiKey, model, system, userMessage, signal }) {
  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMessage },
        ],
      }),
    })
  } catch (e) {
    // Cancel del caller debe propagar tal cual para que la UI lo
    // distinga de un error real de red.
    if (e?.name === 'AbortError') throw e
    throw new ApiNetworkError(e.message || 'Falla de red')
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = body?.error?.message || ''
    } catch {
      // ignore
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiAuthError(detail || 'API key inválida o sin permisos')
    }
    if (response.status === 429) {
      throw new ApiRateLimitError(detail || 'Rate limit excedido')
    }
    throw new ApiResponseError(detail || `Error HTTP ${response.status}`, response.status)
  }

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content ?? ''
  return { text }
}
