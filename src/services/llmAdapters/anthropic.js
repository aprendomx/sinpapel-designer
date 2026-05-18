// Sub-proyecto D — Anthropic Messages API adapter.
// Browser-direct con anthropic-dangerous-direct-browser-access.

import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../llmService.js'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MAX_TOKENS = 4096

export async function call({ apiKey, model, system, userMessage, signal }) {
  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
  } catch (e) {
    throw new ApiNetworkError(e.message || 'Network failure')
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
  const text = data?.content?.[0]?.text ?? ''
  return { text }
}
