import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

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

describe('llmService.generate', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    setActivePinia(createPinia())
    vi.resetModules()
  })

  it('lanza MissingApiKeyError si no hay key para el provider activo', async () => {
    const { generate, MissingApiKeyError } = await import('../src/services/llmService.js')
    await expect(generate('hola')).rejects.toBeInstanceOf(MissingApiKeyError)
  })

  it('despacha al adapter Anthropic cuando provider=anthropic', async () => {
    const anthropicMock = vi.fn().mockResolvedValue({ text: 'respuesta' })
    vi.doMock('../src/services/llmAdapters/anthropic.js', () => ({ call: anthropicMock }))
    vi.doMock('../src/services/llmAdapters/openai.js', () => ({ call: vi.fn() }))
    const { generate } = await import('../src/services/llmService.js')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    const store = useAiSettingsStore()
    store.setApiKey('anthropic', 'sk-ant')

    const result = await generate('descripcion del flujo')
    expect(result).toBe('respuesta')
    expect(anthropicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-ant',
        model: 'claude-sonnet-4-6',
        system: expect.stringContaining('schema_version'),
        userMessage: expect.stringContaining('descripcion del flujo'),
      }),
    )
  })

  it('despacha al adapter OpenAI cuando provider=openai', async () => {
    const openaiMock = vi.fn().mockResolvedValue({ text: 'r2' })
    vi.doMock('../src/services/llmAdapters/anthropic.js', () => ({ call: vi.fn() }))
    vi.doMock('../src/services/llmAdapters/openai.js', () => ({ call: openaiMock }))
    const { generate } = await import('../src/services/llmService.js')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    const store = useAiSettingsStore()
    store.setProvider('openai')
    store.setApiKey('openai', 'sk-oai')

    const result = await generate('x')
    expect(result).toBe('r2')
    expect(openaiMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-oai', model: 'gpt-5' }),
    )
  })

  it('propaga errores tipados del adapter', async () => {
    const failMock = vi.fn().mockRejectedValue(new Error('boom'))
    vi.doMock('../src/services/llmAdapters/anthropic.js', () => ({ call: failMock }))
    vi.doMock('../src/services/llmAdapters/openai.js', () => ({ call: vi.fn() }))
    const { generate } = await import('../src/services/llmService.js')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    useAiSettingsStore().setApiKey('anthropic', 'sk-ant')
    await expect(generate('x')).rejects.toThrow('boom')
  })

  it('despacha al adapter OpenCode cuando provider=opencode y pasa opencodeUrl', async () => {
    const opencodeMock = vi.fn().mockResolvedValue({ text: 'r3' })
    vi.doMock('../src/services/llmAdapters/anthropic.js', () => ({ call: vi.fn() }))
    vi.doMock('../src/services/llmAdapters/openai.js', () => ({ call: vi.fn() }))
    vi.doMock('../src/services/llmAdapters/opencode.js', () => ({ call: opencodeMock }))
    const { generate } = await import('../src/services/llmService.js')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    const store = useAiSettingsStore()
    store.setProvider('opencode')
    store.setOpencodeUrl('http://localhost:9999')

    const result = await generate('descripcion')
    expect(result).toBe('r3')
    expect(opencodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: '',
        model: 'anthropic/claude-sonnet-4-6',
        opencodeUrl: 'http://localhost:9999',
      }),
    )
  })
})
