import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AiGeneratorPreview from '../src/components/AiGeneratorPreview.vue'

const STUBS = {
  QCard: { template: '<div><slot/></div>' },
  QCardSection: { template: '<div><slot/></div>' },
  QIcon: true,
  QChip: { template: '<span class="q-chip"><slot/></span>' },
}

const baseResult = {
  flujo: { id: 'x', nombre: 'Demo', descripcion: '', activo: false, metadatos: null, transiciones_count: 2 },
  estados: [{ id: 1, nombre: 'A' }, { id: 2, nombre: 'B' }, { id: 3, nombre: 'C' }],
  etapas: [],
  grupos: [{ id: 1, name: 'g1' }],
  tipos_documento: [{ id: 1, nombre: 'INE' }],
  transiciones: [
    { id: 1, condiciones: [{ tipo: 'json_logic' }, { tipo: 'python_path' }] },
    { id: 2, condiciones: [] },
  ],
  requisitos: [{ estado: 'B', tipo_documento: 'INE', porcentaje: 100, auto_carga: false }],
}

describe('AiGeneratorPreview', () => {
  it('muestra counts correctos', () => {
    const wrapper = mount(AiGeneratorPreview, {
      props: { result: baseResult, validationWarnings: [] },
      global: { stubs: STUBS },
    })
    const text = wrapper.text()
    expect(text).toContain('3') // estados
    expect(text).toContain('INE') // tipo_documento
    expect(text).toContain('2 transiciones')
    expect(text).toContain('2 condiciones') // sumadas
    expect(text).toContain('1 requisito')
  })

  it('renderiza warnings cuando se pasan', () => {
    const wrapper = mount(AiGeneratorPreview, {
      props: {
        result: baseResult,
        validationWarnings: ['Condición 0: tipo inválido', 'Requisito sin tipo_documento'],
      },
      global: { stubs: STUBS },
    })
    expect(wrapper.text()).toContain('Condición 0: tipo inválido')
    expect(wrapper.text()).toContain('Requisito sin tipo_documento')
  })

  it('muestra estado vacío cuando result es null', () => {
    const wrapper = mount(AiGeneratorPreview, {
      props: { result: null, validationWarnings: [] },
      global: { stubs: STUBS },
    })
    expect(wrapper.text()).toMatch(/sin resultado|nada generado/i)
  })
})
