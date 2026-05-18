// Sub-proyecto D — Pinia store para settings del generador IA.
// Persiste a localStorage. API keys son del usuario (browser-direct).

import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'sinpapel-designer/ai-settings'

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5',
}

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
  const apiKeys = ref(stored?.apiKeys || { anthropic: '', openai: '' })

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          provider: provider.value,
          model: model.value,
          apiKeys: apiKeys.value,
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

  function hasApiKey() {
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
    provider, model, apiKeys,
    setProvider, setModel, setApiKey,
    hasApiKey, currentApiKey,
  }
})
