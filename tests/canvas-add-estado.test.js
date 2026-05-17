import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WorkflowCanvasStatesPanel from '../src/components/WorkflowCanvasStatesPanel.vue'

describe('WorkflowCanvasStatesPanel — botón crear', () => {
  it('muestra botón + con aria-label "Crear Estado" cuando editMode=true', () => {
    const wrapper = mount(WorkflowCanvasStatesPanel, {
      props: { estados: [], idsEnCanvas: new Set(), editMode: true },
      global: {
        stubs: {
          QInput: true,
          QIcon: true,
          QBtn: { template: '<button :aria-label="$attrs[`aria-label`]" @click="$emit(\'click\')"><slot/></button>', inheritAttrs: false, emits: ['click'] },
        },
      },
    })
    const btn = wrapper.find('button[aria-label="Crear Estado"]')
    expect(btn.exists()).toBe(true)
  })

  it('emite "create" al hacer click en el botón +', async () => {
    const wrapper = mount(WorkflowCanvasStatesPanel, {
      props: { estados: [], idsEnCanvas: new Set(), editMode: true },
      global: {
        stubs: {
          QInput: true,
          QIcon: true,
          QBtn: { template: '<button :aria-label="$attrs[`aria-label`]" @click="$emit(\'click\')"><slot/></button>', inheritAttrs: false, emits: ['click'] },
        },
      },
    })
    await wrapper.find('button[aria-label="Crear Estado"]').trigger('click')
    expect(wrapper.emitted('create')).toBeTruthy()
    expect(wrapper.emitted('create')).toHaveLength(1)
  })
})

describe('WorkflowCanvasPage — crear Estado desde panel', () => {
  it('refresca estados tras evento "saved" del diálogo', async () => {
    const getEstatusesMock = vi.fn()
      .mockResolvedValueOnce([{ id: 1, nombre: 'Inicio', activo: true }])
      .mockResolvedValueOnce([
        { id: 1, nombre: 'Inicio', activo: true },
        { id: 2, nombre: 'NuevoEstado', activo: true },
      ])

    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({
        current: null,
        isDirty: false,
        getFlujo: vi.fn().mockResolvedValue({
          id: 1, nombre: 'Test', descripcion: '', activo: true,
          metadatos: { positions: {} },
        }),
        getFlujoTransiciones: vi.fn().mockResolvedValue([]),
        getGrupos: vi.fn().mockResolvedValue([]),
        getEstatuses: getEstatusesMock,
        bulkReplaceTransiciones: vi.fn(),
        saveLayout: vi.fn(),
        exportToFile: vi.fn(),
      }),
    }))
    vi.doMock('vue-router', () => ({
      useRoute: () => ({ params: { id: '1' } }),
      useRouter: () => ({ push: vi.fn() }),
    }))
    vi.doMock('@vue-flow/core', () => ({
      VueFlow: { template: '<div/>' },
      useVueFlow: () => ({ screenToFlowCoordinate: vi.fn() }),
      MarkerType: { ArrowClosed: 'arrowclosed' },
      Handle: { template: '<div/>' },
      Position: { Top: 'top', Bottom: 'bottom' },
    }))
    vi.doMock('@vue-flow/background', () => ({ Background: { template: '<div/>' } }))
    vi.doMock('@vue-flow/controls', () => ({ Controls: { template: '<div/>' } }))
    vi.doMock('@vue-flow/minimap', () => ({ MiniMap: { template: '<div/>' } }))

    const { default: WorkflowCanvasPage } = await import('../src/pages/WorkflowCanvasPage.vue')

    const wrapper = mount(WorkflowCanvasPage, {
      global: {
        stubs: {
          QPage: { template: '<div><slot/></div>' },
          QBtn: true, QToggle: true, QInput: true, QSelect: true,
          QIcon: true, QSpinnerDots: true,
          WorkflowCanvasToolbar: true,
          WorkflowCanvasTransitionPanel: true,
          WorkflowCanvasStatesPanel: {
            template: '<div data-testid="states-panel" @click="$emit(\'create\')"/>',
            emits: ['create', 'drag-start'],
          },
          CatalogoFormDialog: {
            template: '<div data-testid="estado-dialog" v-if="modelValue" @click="$emit(\'saved\')"/>',
            props: ['modelValue', 'catalogKey', 'editing'],
            emits: ['update:modelValue', 'saved'],
          },
        },
        mocks: { $q: { notify: vi.fn() } },
      },
    })

    await flushPromises()
    expect(getEstatusesMock).toHaveBeenCalledTimes(1)

    // Simular clic en panel -> emite create -> dialog se abre
    await wrapper.find('[data-testid="states-panel"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="estado-dialog"]').exists()).toBe(true)

    // Simular saved -> reloadEstatuses se llama
    await wrapper.find('[data-testid="estado-dialog"]').trigger('click')
    await flushPromises()
    expect(getEstatusesMock).toHaveBeenCalledTimes(2)
  })
})
