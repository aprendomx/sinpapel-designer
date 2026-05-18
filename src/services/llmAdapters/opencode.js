// Sub-proyecto D — OpenCode HTTP server adapter (opencode serve).
// Browser-direct: requiere `opencode serve --cors` para CORS.
// Auth opcional via HTTP basic (username fijo 'opencode' + password = apiKey).
// Flujo de 2 round-trips: POST /session (crea sesión efímera) + POST /session/:id/prompt.

import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../llmService.js'

function buildHeaders(apiKey) {
  const headers = { 'content-type': 'application/json' }
  if (apiKey) {
    headers.Authorization = 'Basic ' + btoa('opencode:' + apiKey)
  }
  return headers
}

async function postJson(url, body, apiKey, signal) {
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      signal,
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
    })
  } catch (e) {
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
      throw new ApiAuthError(detail || 'Password OpenCode inválido')
    }
    if (response.status === 429) {
      throw new ApiRateLimitError(detail || 'Rate limit excedido')
    }
    throw new ApiResponseError(detail || `Error HTTP ${response.status}`, response.status)
  }

  return response.json()
}

function splitModel(model) {
  const sepIdx = (model || '').indexOf('/')
  if (sepIdx === -1) return { providerID: model || '', modelID: '' }
  return {
    providerID: model.slice(0, sepIdx),
    modelID: model.slice(sepIdx + 1),
  }
}

function extractText(parts) {
  if (!Array.isArray(parts)) return ''
  return parts.filter((p) => p?.type === 'text').map((p) => p.text || '').join('')
}

export async function call({ apiKey, model, system, userMessage, opencodeUrl, signal }) {
  const baseUrl = opencodeUrl || 'http://localhost:4096'

  // 1. Crear sesión efímera
  const session = await postJson(
    `${baseUrl}/session`,
    { title: 'sinpapel-designer' },
    apiKey,
    signal,
  )
  const sessionId = session?.id
  if (!sessionId) {
    throw new ApiResponseError('OpenCode session sin id en la respuesta')
  }

  // 2. Enviar prompt
  const { providerID, modelID } = splitModel(model)
  const data = await postJson(
    `${baseUrl}/session/${sessionId}/prompt`,
    {
      model: { providerID, modelID },
      parts: [{ type: 'text', text: userMessage }],
      system,
      tools: [],
    },
    apiKey,
    signal,
  )

  return { text: extractText(data?.parts) }
}
