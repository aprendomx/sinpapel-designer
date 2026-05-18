import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const STUBS = {
  QPage: { template: '<div data-testid="ai-page"><slot/></div>' },
  QBtn: { template: '<button :aria-label="$attrs[`aria-label`]" @click="$emit(\'click\')"><slot/></button>', inheritAttrs: false, emits: ['click'] },
  QInput: {
    template: '<textarea :data-field="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>',
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
  QIcon: true,
  QSpinnerDots: true,
  AiSettingsDialog: {
    template: '<div data-testid="settings-dialog" v-if="modelValue"/>',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },
  AiGeneratorPreview: {
    template: '<div data-testid="preview"><slot name="actions"/></div>',
    props: ['result', 'validationWarnings'],
  },
}

function createStorageMock() {
  const data = {}
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = String(v) },
    removeItem: (k) => { delete data[k] },
    clear: () => { for (const k of Object.keys(data)) delete data[k] },
  }
}

describe('AiGeneratorPage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    setActivePinia(createPinia())
    vi.resetModules()
  })

  it('clic Generar sin API key abre el Settings dialog', async () => {
    vi.doMock('src/services/llmService.js', () => ({
      generate: vi.fn(),
      MissingApiKeyError: class extends Error { constructor() { super('no key') ; this.name = 'MissingApiKeyError' } },
      ApiAuthError: class extends Error {},
      ApiRateLimitError: class extends Error {},
      ApiNetworkError: class extends Error {},
      ApiResponseError: class extends Error {},
    }))
    vi.doMock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

    const { default: AiGeneratorPage } = await import('../src/pages/AiGeneratorPage.vue')
    const wrapper = mount(AiGeneratorPage, {
      global: { stubs: STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('textarea[data-field="Describe el flujo a generar"]').setValue('Trámite IMSS')
    await wrapper.find('button[aria-label="Generar"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="settings-dialog"]').exists()).toBe(true)
  })

  it('generar exitoso muestra Preview con el parsed result', async () => {
    const validJson = JSON.stringify({
      schema_version: '0.2',
      exported_at: '2026-05-17T00:00:00Z',
      catalogos: {
        estados: [{ nombre: 'A', color: '#fff', icono: 'circle', descripcion: '', orden: 0, activo: true }],
        etapas: [], grupos: [], tipos_documento: [],
      },
      flujo: { nombre: 'Test', descripcion: '', activo: false, metadatos: null, transiciones: [], requisitos: [] },
    })
    const generateMock = vi.fn().mockResolvedValue(validJson)
    vi.doMock('src/services/llmService.js', () => ({
      generate: generateMock,
      MissingApiKeyError: class extends Error {},
      ApiAuthError: class extends Error {},
      ApiRateLimitError: class extends Error {},
      ApiNetworkError: class extends Error {},
      ApiResponseError: class extends Error {},
    }))
    vi.doMock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
    const { default: AiGeneratorPage } = await import('../src/pages/AiGeneratorPage.vue')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    useAiSettingsStore().setApiKey('anthropic', 'sk-ant')

    const wrapper = mount(AiGeneratorPage, {
      global: { stubs: STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('textarea[data-field="Describe el flujo a generar"]').setValue('x')
    await wrapper.find('button[aria-label="Generar"]').trigger('click')
    await flushPromises()
    expect(generateMock).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="preview"]').exists()).toBe(true)
  })

  it('Aplicar llama store.loadFromFile y redirige al canvas', async () => {
    const validJson = JSON.stringify({
      schema_version: '0.2',
      exported_at: '2026-05-17T00:00:00Z',
      catalogos: {
        estados: [{ nombre: 'A', color: '#fff', icono: 'circle', descripcion: '', orden: 0, activo: true }],
        etapas: [], grupos: [], tipos_documento: [],
      },
      flujo: { nombre: 'Test', descripcion: '', activo: false, metadatos: null, transiciones: [], requisitos: [] },
    })
    const generateMock = vi.fn().mockResolvedValue(validJson)
    const pushMock = vi.fn()
    const loadFromFileMock = vi.fn().mockResolvedValue({ flujo: { id: 'new-id' } })
    vi.doMock('src/services/llmService.js', () => ({
      generate: generateMock,
      MissingApiKeyError: class extends Error {},
      ApiAuthError: class extends Error {},
      ApiRateLimitError: class extends Error {},
      ApiNetworkError: class extends Error {},
      ApiResponseError: class extends Error {},
    }))
    vi.doMock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ loadFromFile: loadFromFileMock }),
    }))
    const { default: AiGeneratorPage } = await import('../src/pages/AiGeneratorPage.vue')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    useAiSettingsStore().setApiKey('anthropic', 'sk-ant')

    const wrapper = mount(AiGeneratorPage, {
      global: { stubs: STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('textarea[data-field="Describe el flujo a generar"]').setValue('x')
    await wrapper.find('button[aria-label="Generar"]').trigger('click')
    await flushPromises()
    await wrapper.find('button[aria-label="Aplicar"]').trigger('click')
    await flushPromises()

    expect(loadFromFileMock).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'workflow-canvas', params: { id: 'new-id' } }),
    )
  })
})
