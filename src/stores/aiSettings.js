// Sub-proyecto D — Pinia store para settings del generador IA.
// Persiste a localStorage. API keys son del usuario (browser-direct).

import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'sinpapel-designer/ai-settings'

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5',
  opencode: 'anthropic/claude-sonnet-4-6',
}

const DEFAULT_OPENCODE_URL = 'http://localhost:4096'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const useAiSettingsStore = defineStore('aiSettings', () => {
  const stored = loadFromStorage()

  const provider = ref(stored?.provider || 'anthropic')
  const model = ref(stored?.model || DEFAULT_MODELS[provider.value])
  const apiKeys = ref({
    anthropic: stored?.apiKeys?.anthropic || '',
    openai: stored?.apiKeys?.openai || '',
    opencode: stored?.apiKeys?.opencode || '',
  })
  const opencodeUrl = ref(stored?.opencodeUrl || DEFAULT_OPENCODE_URL)

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          provider: provider.value,
          model: model.value,
          apiKeys: apiKeys.value,
          opencodeUrl: opencodeUrl.value,
        }),
      )
    } catch {
      // localStorage lleno o bloqueado: ignorar en silencio (no es crítico)
    }
  }

  function setProvider(p) {
    provider.value = p
    model.value = DEFAULT_MODELS[p] || ''
    persist()
  }

  function setModel(m) {
    model.value = m
    persist()
  }

  function setApiKey(p, key) {
    apiKeys.value = { ...apiKeys.value, [p]: key }
    persist()
  }

  function setOpencodeUrl(url) {
    opencodeUrl.value = url
    persist()
  }

  function hasApiKey() {
    // Para opencode, la "key" (password) es opcional — el provider funciona sin auth.
    // Tener el provider seleccionado es suficiente; el hasApiKey() de los demás sigue
    // requiriendo string no vacío.
    if (provider.value === 'opencode') return true
    return Boolean(apiKeys.value[provider.value])
  }

  function currentApiKey() {
    return apiKeys.value[provider.value] || ''
  }

  // persist() debe llamarse desde cada acción que muta state.
  // No usamos watch para evitar persistencia silenciosa cuando
  // consumidores bypassan las actions (e.g. store.provider = 'x'
  // no resetea model al default del nuevo provider).

  return {
    provider, model, apiKeys, opencodeUrl,
    setProvider, setModel, setApiKey, setOpencodeUrl,
    hasApiKey, currentApiKey,
  }
})
