// S27.4 update: smoke test ahora valida IndexPage home (card "Workflows")
// en lugar del S27.1 Vue Flow + q-btn canvas demo (replaced por domain home).
// Real Vue Flow render se valida en tests/workflow-canvas.test.js + browser smoke.

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IndexPage from '../src/pages/IndexPage.vue'

describe('IndexPage smoke', () => {
  it('renders home with Workflows card', () => {
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          QPage: { template: '<div><slot/></div>' },
          QCard: { template: '<div data-testid="home-card"><slot/></div>' },
          QCardSection: { template: '<div><slot/></div>' },
          QIcon: true,
        },
        mocks: {
          $router: { push: () => {} },
        },
      },
    })

    expect(wrapper.find('[data-testid="home-card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Workflows')
    expect(wrapper.text()).toContain('Sinpapel Designer')
  })
})
