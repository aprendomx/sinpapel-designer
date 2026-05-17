import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const COMMON_STUBS = {
  QDialog: { template: '<div><slot/></div>', props: ['modelValue'] },
  QCard: { template: '<div><slot/></div>' },
  QCardSection: { template: '<div><slot/></div>' },
  QForm: {
    template: '<form @submit.prevent="$emit(\'submit\', $event)"><slot/></form>',
    emits: ['submit'],
  },
  QInput: {
    template: '<input :data-field="label" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))"/>',
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
  QSelect: {
    template: '<select :data-field="label" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.value || o" :value="o.value || o">{{ o.label || o }}</option></select>',
    props: ['modelValue', 'label', 'options'],
    emits: ['update:modelValue'],
  },
  QToggle: {
    template: '<input type="checkbox" :data-field="label" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)"/>',
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
  QBtn: { template: '<button :type="type" @click="$emit(\'click\')"><slot/></button>', props: ['type'], emits: ['click'] },
}

describe('RequisitoFormDialog', () => {
  it('llama store.addRequisito al guardar (modo create)', async () => {
    const addRequisitoMock = vi.fn()
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({
        current: { tipos_documento: [{ id: 'tD', nombre: 'DNI' }] },
        addRequisito: addRequisitoMock,
        updateRequisito: vi.fn(),
      }),
    }))
    vi.doMock('quasar', async () => {
      const actual = await vi.importActual('quasar')
      return { ...actual, useQuasar: () => ({ notify: vi.fn() }) }
    })
    const { default: RequisitoFormDialog } = await import('../src/components/RequisitoFormDialog.vue')

    const wrapper = mount(RequisitoFormDialog, {
      props: { modelValue: true, editing: null, estadoNombre: 'A' },
      global: { stubs: COMMON_STUBS },
    })
    await wrapper.find('select[data-field="Tipo Documento"]').setValue('DNI')
    await wrapper.find('input[data-field="Porcentaje (0-100)"]').setValue('80')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(addRequisitoMock).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ tipo_documento: 'DNI', porcentaje: 80, auto_carga: false }),
    )
  })

  it('muestra notify negativo si store.addRequisito lanza', async () => {
    const notify = vi.fn()
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({
        current: { tipos_documento: [{ id: 'tD', nombre: 'DNI' }] },
        addRequisito: vi.fn(() => { throw new Error('Requisito ya existe') }),
        updateRequisito: vi.fn(),
      }),
    }))
    vi.doMock('quasar', async () => {
      const actual = await vi.importActual('quasar')
      return { ...actual, useQuasar: () => ({ notify }) }
    })
    const { default: RequisitoFormDialog } = await import('../src/components/RequisitoFormDialog.vue')

    const wrapper = mount(RequisitoFormDialog, {
      props: { modelValue: true, editing: null, estadoNombre: 'A' },
      global: { stubs: COMMON_STUBS },
    })
    await wrapper.find('select[data-field="Tipo Documento"]').setValue('DNI')
    await wrapper.find('input[data-field="Porcentaje (0-100)"]').setValue('100')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'negative' }))
    const closeEmits = (wrapper.emitted('update:modelValue') || []).filter(a => a[0] === false)
    expect(closeEmits).toHaveLength(0)
  })

  it('llama updateRequisito en modo edit', async () => {
    const updateRequisitoMock = vi.fn()
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({
        current: { tipos_documento: [{ id: 'tD', nombre: 'DNI' }] },
        addRequisito: vi.fn(),
        updateRequisito: updateRequisitoMock,
      }),
    }))
    vi.doMock('quasar', async () => {
      const actual = await vi.importActual('quasar')
      return { ...actual, useQuasar: () => ({ notify: vi.fn() }) }
    })
    const { default: RequisitoFormDialog } = await import('../src/components/RequisitoFormDialog.vue')

    const wrapper = mount(RequisitoFormDialog, {
      props: {
        modelValue: true,
        editing: { estado: 'A', tipo_documento: 'DNI', porcentaje: 50, auto_carga: false },
        estadoNombre: 'A',
      },
      global: { stubs: COMMON_STUBS },
    })
    await wrapper.find('input[data-field="Porcentaje (0-100)"]').setValue('90')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(updateRequisitoMock).toHaveBeenCalledWith(
      'A',
      'DNI',
      expect.objectContaining({ porcentaje: 90 }),
    )
  })
})
