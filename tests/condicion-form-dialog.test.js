import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CondicionFormDialog from '../src/components/CondicionFormDialog.vue'

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
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
  QSelect: {
    template: '<select :data-field="label" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
    props: ['modelValue', 'label', 'options'],
    emits: ['update:modelValue'],
  },
  QToggle: {
    template: '<input type="checkbox" :data-field="label" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)"/>',
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
  QBtn: {
    template: '<button :type="type" @click="$emit(\'click\')"><slot/></button>',
    props: ['type'],
    emits: ['click'],
  },
}

describe('CondicionFormDialog', () => {
  it('renderiza input "path" cuando tipo=python_path', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('python_path')
    await flushPromises()
    expect(wrapper.find('input[data-field="Python path"]').exists()).toBe(true)
  })

  it('renderiza textarea "rule_json" cuando tipo=json_logic', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('json_logic')
    await flushPromises()
    expect(wrapper.find('input[data-field="Regla JSON Logic"]').exists()).toBe(true)
  })

  it('renderiza pares key/value cuando tipo=django_orm', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('django_orm')
    await flushPromises()
    expect(wrapper.find('input[data-field="campo__lookup"]').exists()).toBe(true)
    expect(wrapper.find('input[data-field="valor"]').exists()).toBe(true)
  })

  it('emite "saved" con la condición construida para json_logic', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('json_logic')
    await flushPromises()
    await wrapper.find('input[data-field="Regla JSON Logic"]').setValue('{"==":[1,1]}')
    await wrapper.find('input[data-field="Mensaje de error"]').setValue('Falla')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const saved = wrapper.emitted('saved')
    expect(saved).toBeTruthy()
    expect(saved[0][0]).toMatchObject({
      tipo: 'json_logic',
      configuracion: { rule: { '==': [1, 1] } },
      mensaje_error: 'Falla',
      orden: 0,
      activo: true,
    })
  })

  it('muestra notify negativo y no emite "saved" si rule_json no parsea', async () => {
    const notify = vi.fn()
    vi.resetModules()
    vi.doMock('quasar', async () => {
      const actual = await vi.importActual('quasar')
      return { ...actual, useQuasar: () => ({ notify }) }
    })
    const mod = await import('../src/components/CondicionFormDialog.vue')

    const wrapper = mount(mod.default, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('json_logic')
    await flushPromises()
    await wrapper.find('input[data-field="Regla JSON Logic"]').setValue('{invalid')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'negative' }))
    expect(wrapper.emitted('saved')).toBeFalsy()
  })

  it('calcula orden = existing.length para registros nuevos', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: {
        modelValue: true,
        editing: null,
        existing: [
          { tipo: 'python_path', configuracion: { path: 'a' }, mensaje_error: '', orden: 0, activo: true },
          { tipo: 'python_path', configuracion: { path: 'b' }, mensaje_error: '', orden: 1, activo: true },
        ],
      },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('python_path')
    await flushPromises()
    await wrapper.find('input[data-field="Python path"]').setValue('c.mod')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('saved')[0][0].orden).toBe(2)
  })

  it('preserva configuracion original cuando el tipo es desconocido (forward-compat)', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: {
        modelValue: true,
        editing: {
          tipo: 'futuro_tipo',
          configuracion: { foo: 'bar', nested: { x: 1 } },
          mensaje_error: 'antes',
          orden: 0,
          activo: true,
        },
        existing: [],
      },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await flushPromises()
    await wrapper.find('input[data-field="Mensaje de error"]').setValue('después')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const saved = wrapper.emitted('saved')
    expect(saved).toBeTruthy()
    expect(saved[0][0]).toMatchObject({
      tipo: 'futuro_tipo',
      configuracion: { foo: 'bar', nested: { x: 1 } },
      mensaje_error: 'después',
    })
  })

  it('filtra pares django_orm con valor vacío al construir configuracion', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('django_orm')
    await flushPromises()
    const keyInputs = wrapper.findAll('input[data-field="campo__lookup"]')
    const valueInputs = wrapper.findAll('input[data-field="valor"]')
    await keyInputs[0].setValue('monto__gte')
    await valueInputs[0].setValue('100')
    // Para mantener este test simple: sólo verificamos que el primer par válido
    // produce el lookup esperado (pares con value='' son filtrados).
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const saved = wrapper.emitted('saved')
    expect(saved).toBeTruthy()
    expect(saved[0][0].configuracion).toEqual({ lookup: { monto__gte: '100' } })
  })
})
