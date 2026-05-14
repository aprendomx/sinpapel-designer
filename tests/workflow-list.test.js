// S27.5 T3 — smoke mount test for WorkflowListPage post-Pinia migration.
// vi.mock 'src/stores/workflow.js' replaces S27.4 stub-fixture mock.

import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

const mockDeleteFlujo = vi.fn().mockResolvedValue(undefined)
const mockLoadFromFile = vi.fn()
const notifyMock = vi.fn()

vi.mock('quasar', async () => {
  const actual = await vi.importActual('quasar')
  return { ...actual, useQuasar: () => ({ notify: notifyMock }) }
})

vi.mock('src/stores/workflow.js', () => ({
  useWorkflowStore: () => ({
    getFlujos: vi.fn().mockResolvedValue([
      { id: '1', nombre: 'Flujo Test', descripcion: '', activo: true, transiciones_count: 2 },
      { id: '2', nombre: 'Flujo Alt', descripcion: '', activo: false, transiciones_count: 0 },
    ]),
    createFlujo: vi.fn(),
    updateFlujo: vi.fn(),
    loadFromFile: mockLoadFromFile,
    deleteFlujo: mockDeleteFlujo,
  }),
}))

import WorkflowListPage from '../src/pages/WorkflowListPage.vue'

function mountPage() {
  notifyMock.mockClear()
  mockLoadFromFile.mockClear()
  return mount(WorkflowListPage, {
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
    },
  })
}

describe('WorkflowListPage smoke (S27.5)', () => {
  it('mounts and renders list rows with mocked store', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('[data-testid="list-page"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Flujo Test')
  })
})

describe('WorkflowListPage S27.6 — DnD + delete', () => {
  it('drag-over sets isDragging state (overlay condition)', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.find('[data-testid="list-page"]').trigger('dragover')
    expect(wrapper.vm.isDragging).toBe(true)
  })

  it('drop with .txt file rejected (notify negative)', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const file = { name: 'foo.txt', text: async () => 'x' }
    await wrapper.find('[data-testid="list-page"]').trigger('drop', {
      dataTransfer: { files: [file] },
    })
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'negative' }),
    )
    expect(mockLoadFromFile).not.toHaveBeenCalled()
  })

  it('confirmDelete opens delete dialog with target', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const target = { id: '1', nombre: 'Flujo Test' }
    wrapper.vm.confirmDelete(target)
    await flushPromises()
    expect(wrapper.vm.deleteDialogVisible).toBe(true)
    expect(wrapper.vm.toDelete).toEqual(target)
  })
})
