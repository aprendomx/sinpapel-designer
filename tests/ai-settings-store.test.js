import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAiSettingsStore } from '../src/stores/aiSettings.js'

// Explicit localStorage mock — jsdom localStorage incomplete en algunos
// entornos Node; mock garantiza determinismo cross-environment.
function createStorageMock() {
  let store = {}
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value) },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i) => Object.keys(store)[i] || null,
  }
}

describe('aiSettings store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    setActivePinia(createPinia())
  })

  it('default provider es anthropic con modelo claude-sonnet-4-6', () => {
    const store = useAiSettingsStore()
    expect(store.provider).toBe('anthropic')
    expect(store.model).toBe('claude-sonnet-4-6')
    expect(store.apiKeys).toEqual({ anthropic: '', openai: '' })
  })

  it('setApiKey actualiza por provider y persiste a localStorage', () => {
    const store = useAiSettingsStore()
    store.setApiKey('anthropic', 'sk-ant-XXX')
    expect(store.apiKeys.anthropic).toBe('sk-ant-XXX')
    const raw = localStorage.getItem('sinpapel-designer/ai-settings')
    expect(JSON.parse(raw).apiKeys.anthropic).toBe('sk-ant-XXX')
  })

  it('setProvider cambia y resetea model al default del provider', () => {
    const store = useAiSettingsStore()
    store.setProvider('openai')
    expect(store.provider).toBe('openai')
    expect(store.model).toBe('gpt-5')
    store.setProvider('anthropic')
    expect(store.model).toBe('claude-sonnet-4-6')
  })

  it('hasApiKey y currentApiKey reflejan el provider activo', () => {
    const store = useAiSettingsStore()
    expect(store.hasApiKey()).toBe(false)
    store.setApiKey('anthropic', 'sk-ant')
    expect(store.hasApiKey()).toBe(true)
    expect(store.currentApiKey()).toBe('sk-ant')
    store.setProvider('openai')
    expect(store.hasApiKey()).toBe(false)
    store.setApiKey('openai', 'sk-openai')
    expect(store.currentApiKey()).toBe('sk-openai')
  })

  it('rehidrata desde localStorage al instanciar', () => {
    localStorage.setItem('sinpapel-designer/ai-settings', JSON.stringify({
      provider: 'openai',
      model: 'gpt-4-turbo',
      apiKeys: { anthropic: 'anth-x', openai: 'oai-y' },
    }))
    const store = useAiSettingsStore()
    expect(store.provider).toBe('openai')
    expect(store.model).toBe('gpt-4-turbo')
    expect(store.apiKeys.openai).toBe('oai-y')
  })
})
