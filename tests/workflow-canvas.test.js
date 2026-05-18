// S27.5 T3 — smoke mount test for WorkflowCanvasPage post-Pinia migration.
// vi.mock 'src/stores/workflow.js' replaces S27.4 stub-fixture mock.

import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '1' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@vue-flow/core', () => ({
  VueFlow: { template: '<div data-testid="canvas-stub"></div>' },
  useVueFlow: () => ({ screenToFlowCoordinate: vi.fn() }),
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Handle: { template: '<div/>' },
  Position: { Top: 'top', Bottom: 'bottom' },
}))

vi.mock('@vue-flow/background', () => ({ Background: { template: '<div/>' } }))
vi.mock('@vue-flow/controls', () => ({ Controls: { template: '<div/>' } }))
vi.mock('@vue-flow/minimap', () => ({ MiniMap: { template: '<div/>' } }))

vi.mock('src/stores/workflow.js', () => ({
  useWorkflowStore: () => ({
    current: null,
    isDirty: false,
    getFlujo: vi.fn().mockResolvedValue({
      id: 1, nombre: 'Test Flujo', descripcion: '', activo: true,
      metadatos: { positions: {} },
    }),
    getFlujoTransiciones: vi.fn().mockResolvedValue([]),
    getGrupos: vi.fn().mockResolvedValue([]),
    getEstatuses: vi.fn().mockResolvedValue([]),
    getRequisitosForEstado: vi.fn().mockReturnValue([]),
    bulkReplaceTransiciones: vi.fn(),
    saveLayout: vi.fn(),
    exportToFile: vi.fn(),
    discard: vi.fn(),
  }),
}))

import WorkflowCanvasPage from '../src/pages/WorkflowCanvasPage.vue'

describe('WorkflowCanvasPage smoke (S27.5)', () => {
  it('mounts without errors with mocked Pinia store', async () => {
    const wrapper = mount(WorkflowCanvasPage, {
      global: {
        stubs: {
          QPage: { template: '<div data-testid="canvas-page"><slot/></div>' },
          QBtn: true, QToggle: true, QInput: true, QSelect: true,
          QIcon: true, QSpinnerDots: true,
          CondicionFormDialog: true,
          RequisitoFormDialog: true,
        },
        mocks: { $q: { notify: vi.fn() } },
      },
    })

    await flushPromises()
    expect(wrapper.find('[data-testid="canvas-page"]').exists()).toBe(true)
  })
})
