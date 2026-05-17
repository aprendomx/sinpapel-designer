import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
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
