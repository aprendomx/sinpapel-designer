// S27.1 T2 smoke test — validates IndexPage compiles and mounts in jsdom.
// Quasar plugin NOT installed (jsdom + Quasar server bundle conflicts on lang/window globals).
// All q-* and VueFlow components stubbed; test verifies component structure (data-testid wrappers).
// Real Vue Flow + Quasar coexistence is validated via browser smoke (`npm run dev`) — see s27.1-plan T2.

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IndexPage from '../src/pages/IndexPage.vue'

describe('IndexPage smoke', () => {
  it('renders smoke page structure with required testids', () => {
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          QPage: { template: '<div><slot/></div>' },
          QBtn: { template: '<button></button>' },
          VueFlow: { template: '<div data-testid="smoke-canvas-stub"></div>' },
          Background: true,
          Controls: true,
          MiniMap: true,
        },
      },
    })

    expect(wrapper.find('[data-testid="smoke-btn-wrap"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="smoke-canvas-wrap"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="smoke-canvas-stub"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Smoke Test')
  })
})
