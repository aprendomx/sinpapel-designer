import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const STUBS = {
  QIcon: true,
  QSelect: true,
  QChip: { template: '<span class="q-chip"><slot/></span>' },
  QBtn: { template: '<button :aria-label="$attrs[`aria-label`]" @click="$emit(\'click\', $event)"><slot/></button>', inheritAttrs: false, emits: ['click'] },
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

  it('emite condiciones-change al eliminar una condición', async () => {
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ current: { tipos_documento: [] }, getRequisitosForEstado: () => [] }),
    }))
    const { default: Panel } = await import('../src/components/WorkflowCanvasTransitionPanel.vue')
    const edge = makeEdge({
      condiciones: [
        { tipo: 'python_path', configuracion: { path: 'a' }, mensaje_error: 'm1', orden: 0, activo: true },
        { tipo: 'json_logic', configuracion: { rule: true }, mensaje_error: 'm2', orden: 1, activo: true },
      ],
    })
    const wrapper = mount(Panel, {
      props: { selectedEdge: edge, gruposOptions: [], editMode: true },
      global: { stubs: STUBS },
    })
    // close buttons are aria-less inside rows; find by index
    const closeButtons = wrapper.findAll('.wf-panel__row button')
    await closeButtons[0].trigger('click')
    const emitted = wrapper.emitted('condiciones-change')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toHaveLength(1)
    expect(emitted[0][0][0].mensaje_error).toBe('m2')
  })

  it('emite condiciones-change al editar una condición existente (replace en el mismo índice)', async () => {
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ current: { tipos_documento: [] }, getRequisitosForEstado: () => [] }),
    }))
    const { default: Panel } = await import('../src/components/WorkflowCanvasTransitionPanel.vue')
    const edge = makeEdge({
      condiciones: [
        { tipo: 'python_path', configuracion: { path: 'a' }, mensaje_error: 'orig', orden: 0, activo: true },
      ],
    })
    const wrapper = mount(Panel, {
      props: { selectedEdge: edge, gruposOptions: [], editMode: true },
      global: { stubs: STUBS },
    })
    // open dialog by clicking the row
    await wrapper.find('.wf-panel__row').trigger('click')
    await flushPromises()
    const updated = { tipo: 'python_path', configuracion: { path: 'a' }, mensaje_error: 'editado', orden: 0, activo: true }
    wrapper.findComponent({ name: 'CondicionFormDialog' }).vm.$emit('saved', updated)
    await flushPromises()
    const emitted = wrapper.emitted('condiciones-change')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toHaveLength(1)
    expect(emitted[0][0][0].mensaje_error).toBe('editado')
  })

  it('renderiza empty state de requisitos cuando getRequisitosForEstado retorna []', async () => {
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
    const section = wrapper.find('[data-testid="requisitos-section"]')
    expect(section.exists()).toBe(true)
    expect(wrapper.text()).toContain('Sin requisitos documentales')
  })
})
