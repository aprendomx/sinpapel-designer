// Sub-proyecto D — LLM Service entry point + error classes + dispatcher.

import { useAiSettingsStore } from '../stores/aiSettings.js'
import { call as anthropicCall } from './llmAdapters/anthropic.js'
import { call as openaiCall } from './llmAdapters/openai.js'
import { call as opencodeCall } from './llmAdapters/opencode.js'
import { buildPrompt } from './llmPrompts/workflowGenerator.js'

export class MissingApiKeyError extends Error {
  constructor(provider) {
    super(`API key no configurada para provider '${provider}'`)
    this.name = 'MissingApiKeyError'
    this.provider = provider
  }
}

export class ApiAuthError extends Error {
  constructor(message = 'API key inválida o sin permisos') {
    super(message)
    this.name = 'ApiAuthError'
  }
}

export class ApiRateLimitError extends Error {
  constructor(message = 'Demasiadas requests, espera unos segundos') {
    super(message)
    this.name = 'ApiRateLimitError'
  }
}

export class ApiNetworkError extends Error {
  constructor(message = 'Sin conexión al provider') {
    super(message)
    this.name = 'ApiNetworkError'
  }
}

export class ApiResponseError extends Error {
  constructor(message = 'Error en la respuesta del provider', status) {
    super(message)
    this.name = 'ApiResponseError'
    this.status = status
  }
}

const ADAPTERS = {
  anthropic: anthropicCall,
  openai: openaiCall,
  opencode: opencodeCall,
}

export async function generate(userDescription, opts = {}) {
  const store = useAiSettingsStore()
  if (!store.hasApiKey()) {
    throw new MissingApiKeyError(store.provider)
  }
  const adapter = ADAPTERS[store.provider]
  if (!adapter) {
    throw new ApiResponseError(`Provider desconocido: ${store.provider}`)
  }
  const { system, userMessage } = buildPrompt(userDescription)
  const result = await adapter({
    apiKey: store.currentApiKey(),
    model: store.model,
    system,
    userMessage,
    signal: opts.signal,
    opencodeUrl: store.opencodeUrl,
  })
  return result.text
}
