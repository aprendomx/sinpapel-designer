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

describe('CatalogoFormDialog — manejo de error en save', () => {
  it('muestra notify negativo y mantiene el diálogo abierto si addAction lanza', async () => {
    const notifyMock = vi.fn()
    const addEstadoMock = vi.fn(() => { throw new Error('estado con nombre=Foo ya existe') })

    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({
        current: { etapas: [] },
        addEstado: addEstadoMock,
      }),
    }))
    vi.doMock('quasar', async () => {
      const actual = await vi.importActual('quasar')
      return { ...actual, useQuasar: () => ({ notify: notifyMock }) }
    })

    const { default: CatalogoFormDialog } = await import('../src/components/CatalogoFormDialog.vue')

    const wrapper = mount(CatalogoFormDialog, {
      props: { modelValue: true, catalogKey: 'estados', editing: null },
      global: {
        stubs: {
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
          QToggle: { template: '<input type="checkbox"/>', props: ['modelValue'] },
          QSelect: { template: '<select/>', props: ['modelValue', 'options'] },
          QBtn: { template: '<button :type="type" @click="$emit(\'click\')"><slot/></button>', props: ['type'], emits: ['click'] },
        },
        // Note: useQuasar() is patched via vi.doMock('quasar', ...) above —
        // the Options-API `mocks: { $q }` path does not reach the composable.
      },
    })

    // Llenar el campo Nombre vía el stub de QInput (pasa la guarda `if (!form[nameField]) return`)
    await wrapper.find('input[data-field="Nombre"]').setValue('Foo')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(addEstadoMock).toHaveBeenCalled()
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'negative' })
    )
    // El diálogo NO se cerró (update:modelValue=false no se emitió)
    const closeEmits = (wrapper.emitted('update:modelValue') || [])
      .filter(args => args[0] === false)
    expect(closeEmits).toHaveLength(0)
  })
})
