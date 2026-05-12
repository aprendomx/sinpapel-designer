// S27.4 T2 — smoke mount test for WorkflowCanvasPage.
// Mocks @vue-flow/core (useVueFlow + VueFlow component) y vue-router
// (useRoute/useRouter) porque la composition API usa injection.
// Stub fixture mockeado para tests deterministicos.
// Real Vue Flow rendering validado via browser smoke (npm run dev).

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

vi.mock('src/data/stub-fixture.js', () => ({
  stub: {
    getFlujo: vi.fn().mockResolvedValue({
      id: 1, nombre: 'Test Flujo', descripcion: '', activo: true,
      metadatos: { positions: {} },
    }),
    getFlujoTransiciones: vi.fn().mockResolvedValue([]),
    getGrupos: vi.fn().mockResolvedValue([]),
    getEstatuses: vi.fn().mockResolvedValue([]),
  },
}))

import WorkflowCanvasPage from '../src/pages/WorkflowCanvasPage.vue'

describe('WorkflowCanvasPage smoke', () => {
  it('mounts without errors with mocked stub data', async () => {
    const wrapper = mount(WorkflowCanvasPage, {
      global: {
        stubs: {
          QPage: { template: '<div data-testid="canvas-page"><slot/></div>' },
          QBtn: true, QToggle: true, QInput: true, QSelect: true,
          QIcon: true, QSpinnerDots: true,
        },
        mocks: { $q: { notify: vi.fn() } },
      },
    })

    await flushPromises()
    expect(wrapper.find('[data-testid="canvas-page"]').exists()).toBe(true)
  })
})
