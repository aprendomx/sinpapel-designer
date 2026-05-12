// S27.5 T3 — smoke mount test for WorkflowListPage post-Pinia migration.
// vi.mock 'src/stores/workflow.js' replaces S27.4 stub-fixture mock.

import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('src/stores/workflow.js', () => ({
  useWorkflowStore: () => ({
    getFlujos: vi.fn().mockResolvedValue([
      { id: '1', nombre: 'Flujo Test', descripcion: '', activo: true, transiciones_count: 2 },
      { id: '2', nombre: 'Flujo Alt', descripcion: '', activo: false, transiciones_count: 0 },
    ]),
    createFlujo: vi.fn(),
    updateFlujo: vi.fn(),
    loadFromFile: vi.fn(),
  }),
}))

import WorkflowListPage from '../src/pages/WorkflowListPage.vue'

describe('WorkflowListPage smoke (S27.5)', () => {
  it('mounts and renders list rows with mocked store', async () => {
    const wrapper = mount(WorkflowListPage, {
      global: {
        stubs: {
          QPage: { template: '<div data-testid="list-page"><slot/></div>' },
          QBtn: true, QToggle: true, QIcon: true,
          QDialog: { template: '<div><slot/></div>' },
          QCard: { template: '<div><slot/></div>' },
          QCardSection: { template: '<div><slot/></div>' },
          QCardActions: { template: '<div><slot/></div>' },
          QInput: true,
        },
        mocks: { $q: { notify: vi.fn() } },
      },
    })

    await flushPromises()
    expect(wrapper.find('[data-testid="list-page"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Flujo Test')
  })
})
