import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const COMMON_STUBS = {
  QDialog: { template: '<div><slot/></div>', props: ['modelValue'] },
  QCard: { template: '<div><slot/></div>' },
  QCardSection: { template: '<div><slot/></div>' },
  QForm: {
    template: '<form @submit.prevent="$emit(\'submit\', $event)"><slot/></form>',
    emits: ['submit'],
  },
  QInput: {
    template: '<input :data-field="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"/>',
    props: ['modelValue', 'label', 'type'],
    emits: ['update:modelValue'],
  },
  QSelect: {
    template: '<select :data-field="label" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.value || o" :value="o.value || o">{{ o.label || o }}</option></select>',
    props: ['modelValue', 'label', 'options'],
    emits: ['update:modelValue'],
  },
  QBtn: { template: '<button :type="type" @click="$emit(\'click\')"><slot/></button>', props: ['type'], emits: ['click'] },
}

describe('AiSettingsDialog', () => {
  beforeEach(() => {
    // jsdom localStorage incompleto: stub global con el patrón del proyecto
    const data = {}
    vi.stubGlobal('localStorage', {
      getItem: (k) => data[k] ?? null,
      setItem: (k, v) => { data[k] = String(v) },
      removeItem: (k) => { delete data[k] },
      clear: () => { for (const k of Object.keys(data)) delete data[k] },
    })
    setActivePinia(createPinia())
  })

  it('Guardar persiste provider, model y API keys al store', async () => {
    const AiSettingsDialog = (await import('../src/components/AiSettingsDialog.vue')).default
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')

    const wrapper = mount(AiSettingsDialog, {
      props: { modelValue: true },
      global: { stubs: COMMON_STUBS },
    })

    await wrapper.find('select[data-field="Provider"]').setValue('openai')
    await wrapper.find('input[data-field="OpenAI API key"]').setValue('sk-openai-test')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const store = useAiSettingsStore()
    expect(store.provider).toBe('openai')
    expect(store.apiKeys.openai).toBe('sk-openai-test')
  })

  it('emite update:modelValue=false al guardar', async () => {
    const AiSettingsDialog = (await import('../src/components/AiSettingsDialog.vue')).default
    const wrapper = mount(AiSettingsDialog, {
      props: { modelValue: true },
      global: { stubs: COMMON_STUBS },
    })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const closeEmits = (wrapper.emitted('update:modelValue') || []).filter(a => a[0] === false)
    expect(closeEmits.length).toBeGreaterThan(0)
  })

  it('cuando provider=opencode muestra inputs URL y password', async () => {
    const AiSettingsDialog = (await import('../src/components/AiSettingsDialog.vue')).default

    const wrapper = mount(AiSettingsDialog, {
      props: { modelValue: true },
      global: { stubs: COMMON_STUBS },
    })

    await wrapper.find('select[data-field="Provider"]').setValue('opencode')
    await flushPromises()

    expect(wrapper.find('input[data-field="URL del servidor OpenCode"]').exists()).toBe(true)
    expect(wrapper.find('input[data-field="Password OpenCode (opcional)"]').exists()).toBe(true)
  })

  it('Guardar con provider=opencode persiste opencodeUrl y password al store', async () => {
    const AiSettingsDialog = (await import('../src/components/AiSettingsDialog.vue')).default
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')

    const wrapper = mount(AiSettingsDialog, {
      props: { modelValue: true },
      global: { stubs: COMMON_STUBS },
    })

    await wrapper.find('select[data-field="Provider"]').setValue('opencode')
    await flushPromises()
    await wrapper.find('input[data-field="URL del servidor OpenCode"]').setValue('http://opencode.lan:5000')
    await wrapper.find('input[data-field="Password OpenCode (opcional)"]').setValue('pw123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const store = useAiSettingsStore()
    expect(store.provider).toBe('opencode')
    expect(store.opencodeUrl).toBe('http://opencode.lan:5000')
    expect(store.apiKeys.opencode).toBe('pw123')
  })
})
