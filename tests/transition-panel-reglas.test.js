import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const STUBS = {
  QIcon: true,
  QSelect: true,
  QChip: { template: '<span class="q-chip"><slot/></span>' },
  QBtn: { template: '<button :aria-label="$attrs[`aria-label`]" @click="$emit(\'click\')"><slot/></button>', inheritAttrs: false, emits: ['click'] },
  QToggle: true,
  CondicionFormDialog: {
    name: 'CondicionFormDialog',
    template: '<div data-testid="cond-dialog" v-if="modelValue"/>',
    props: ['modelValue', 'editing', 'existing'],
    emits: ['update:modelValue', 'saved'],
  },
  RequisitoFormDialog: {
    name: 'RequisitoFormDialog',
    template: '<div data-testid="req-dialog" v-if="modelValue"/>',
    props: ['modelValue', 'editing', 'estadoNombre'],
    emits: ['update:modelValue', 'saved'],
  },
}

const makeEdge = (overrides = {}) => ({
  id: 'transicion-1',
  source: '1',
  target: '2',
  data: {
    origen_nombre: 'A',
    destino_nombre: 'B',
    grupos_ids: [],
    condiciones: [],
    ...overrides,
  },
})

describe('WorkflowCanvasTransitionPanel — reglas', () => {
  it('no renderiza secciones de reglas si no hay edge seleccionada', async () => {
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ current: null, getRequisitosForEstado: () => [] }),
    }))
    const { default: Panel } = await import('../src/components/WorkflowCanvasTransitionPanel.vue')
    const wrapper = mount(Panel, {
      props: { selectedEdge: null, gruposOptions: [], editMode: true },
      global: { stubs: STUBS },
    })
    expect(wrapper.find('[data-testid="condiciones-section"]').exists()).toBe(false)
  })

  it('renderiza sección condiciones con count cuando hay edge', async () => {
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ current: { tipos_documento: [] }, getRequisitosForEstado: () => [] }),
    }))
    const { default: Panel } = await import('../src/components/WorkflowCanvasTransitionPanel.vue')
    const edge = makeEdge({
      condiciones: [
        { tipo: 'python_path', configuracion: { path: 'a' }, mensaje_error: '', orden: 0, activo: true },
      ],
    })
    const wrapper = mount(Panel, {
      props: { selectedEdge: edge, gruposOptions: [], editMode: true },
      global: { stubs: STUBS },
    })
    const section = wrapper.find('[data-testid="condiciones-section"]')
    expect(section.exists()).toBe(true)
    expect(section.text()).toContain('1')
  })

  it('emite condiciones-change al añadir una condición via dialog', async () => {
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ current: { tipos_documento: [] }, getRequisitosForEstado: () => [] }),
    }))
    const { default: Panel } = await import('../src/components/WorkflowCanvasTransitionPanel.vue')
    const edge = makeEdge()
    const wrapper = mount(Panel, {
      props: { selectedEdge: edge, gruposOptions: [], editMode: true },
      global: { stubs: STUBS },
    })
    await wrapper.find('button[aria-label="Agregar condición"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cond-dialog"]').exists()).toBe(true)
    const newCond = { tipo: 'python_path', configuracion: { path: 'x' }, mensaje_error: '', orden: 0, activo: true }
    wrapper.findComponent({ name: 'CondicionFormDialog' }).vm.$emit('saved', newCond)
    await flushPromises()
    const emitted = wrapper.emitted('condiciones-change')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toEqual([newCond])
  })

  it('lee requisitos del estado destino vía getRequisitosForEstado', async () => {
    vi.resetModules()
    const getMock = vi.fn().mockReturnValue([
      { estado: 'B', tipo_documento: 'DNI', porcentaje: 100, auto_carga: false },
    ])
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ current: { tipos_documento: [] }, getRequisitosForEstado: getMock }),
    }))
    const { default: Panel } = await import('../src/components/WorkflowCanvasTransitionPanel.vue')
    const edge = makeEdge()
    const wrapper = mount(Panel, {
      props: { selectedEdge: edge, gruposOptions: [], editMode: true },
      global: { stubs: STUBS },
    })
    await flushPromises()
    expect(getMock).toHaveBeenCalledWith('B')
    expect(wrapper.text()).toContain('DNI')
  })
})
