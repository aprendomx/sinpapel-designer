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
    expect(store.apiKeys).toEqual({ anthropic: '', openai: '', opencode: '' })
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

  it('setProvider opencode usa default anthropic/claude-sonnet-4-6', () => {
    const store = useAiSettingsStore()
    store.setProvider('opencode')
    expect(store.provider).toBe('opencode')
    expect(store.model).toBe('anthropic/claude-sonnet-4-6')
  })

  it('apiKeys.opencode existe por default vacío', () => {
    const store = useAiSettingsStore()
    expect(store.apiKeys.opencode).toBe('')
    store.setApiKey('opencode', 'mypassword')
    expect(store.apiKeys.opencode).toBe('mypassword')
  })

  it('opencodeUrl default es http://localhost:4096 y setOpencodeUrl persiste', () => {
    const store = useAiSettingsStore()
    expect(store.opencodeUrl).toBe('http://localhost:4096')
    store.setOpencodeUrl('http://opencode.lan:9000')
    expect(store.opencodeUrl).toBe('http://opencode.lan:9000')
    const raw = localStorage.getItem('sinpapel-designer/ai-settings')
    expect(JSON.parse(raw).opencodeUrl).toBe('http://opencode.lan:9000')
  })

  it('rehidrata opencodeUrl y apiKeys.opencode desde localStorage', () => {
    localStorage.setItem('sinpapel-designer/ai-settings', JSON.stringify({
      provider: 'opencode',
      model: 'anthropic/claude-opus-4-7',
      apiKeys: { anthropic: '', openai: '', opencode: 'pw' },
      opencodeUrl: 'http://other:5000',
    }))
    const store = useAiSettingsStore()
    expect(store.provider).toBe('opencode')
    expect(store.opencodeUrl).toBe('http://other:5000')
    expect(store.apiKeys.opencode).toBe('pw')
    expect(store.currentApiKey()).toBe('pw')
  })
})
