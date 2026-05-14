// S27.7 T3 — smoke mount test for CatalogosPage.

import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('src/stores/workflow.js', () => ({
  useWorkflowStore: () => ({
    current: {
      flujo: { id: 1, nombre: 'Demo Workflow' },
      estados: [],
      etapas: [],
      grupos: [],
      tipos_documento: [],
      transiciones: [],
      requisitos: [],
    },
  }),
}))

import CatalogosPage from '../src/pages/CatalogosPage.vue'

describe('CatalogosPage smoke (S27.7)', () => {
  it('mounts and shows tabs when workflow is active', async () => {
    const wrapper = mount(CatalogosPage, {
      global: {
        stubs: {
          QPage: { template: '<div data-testid="catalogos-page"><slot/></div>' },
          QTabs: { template: '<div data-testid="tabs"><slot/></div>' },
          QTab: { template: '<div data-testid="tab"><slot/></div>' },
          QTabPanels: { template: '<div><slot/></div>' },
          QTabPanel: { template: '<div><slot/></div>' },
          QSeparator: true,
          QBtn: true,
          CatalogoEditor: true,
        },
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="catalogos-page"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="tab"]').length).toBe(4)
  })
})
