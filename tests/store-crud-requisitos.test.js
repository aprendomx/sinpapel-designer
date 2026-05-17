import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkflowStore } from '../src/stores/workflow.js'

function bootstrapFlujo(store) {
  store.current = {
    flujo: { id: 'f1', nombre: 'F1', descripcion: '', activo: false, metadatos: null },
    estados: [
      { id: 'eA', nombre: 'A', color: '#fff', icono: 'circle', orden: 0, activo: true },
      { id: 'eB', nombre: 'B', color: '#fff', icono: 'circle', orden: 1, activo: true },
    ],
    etapas: [],
    grupos: [],
    tipos_documento: [
      { id: 'tD', nombre: 'DNI', color: '#fff' },
      { id: 'tF', nombre: 'FACTURA', color: '#fff' },
    ],
    transiciones: [],
    requisitos: [],
  }
}

describe('store — CRUD requisitos', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWorkflowStore()
    bootstrapFlujo(store)
  })

  it('addRequisito añade y getRequisitosForEstado lo lista', () => {
    store.addRequisito('A', { tipo_documento: 'DNI', porcentaje: 100, auto_carga: false })
    const reqs = store.getRequisitosForEstado('A')
    expect(reqs).toHaveLength(1)
    expect(reqs[0]).toMatchObject({ estado: 'A', tipo_documento: 'DNI', porcentaje: 100, auto_carga: false })
  })

  it('addRequisito lanza si ya existe (estado, tipo_documento)', () => {
    store.addRequisito('A', { tipo_documento: 'DNI', porcentaje: 100, auto_carga: false })
    expect(() =>
      store.addRequisito('A', { tipo_documento: 'DNI', porcentaje: 50, auto_carga: true })
    ).toThrow(/ya existe/)
  })

  it('updateRequisito muta porcentaje y auto_carga', () => {
    store.addRequisito('A', { tipo_documento: 'DNI', porcentaje: 100, auto_carga: false })
    store.updateRequisito('A', 'DNI', { porcentaje: 80, auto_carga: true })
    const r = store.getRequisitosForEstado('A')[0]
    expect(r.porcentaje).toBe(80)
    expect(r.auto_carga).toBe(true)
  })

  it('removeRequisito elimina por (estado, tipo_documento)', () => {
    store.addRequisito('A', { tipo_documento: 'DNI', porcentaje: 100, auto_carga: false })
    store.addRequisito('A', { tipo_documento: 'FACTURA', porcentaje: 100, auto_carga: false })
    store.removeRequisito('A', 'DNI')
    const reqs = store.getRequisitosForEstado('A')
    expect(reqs).toHaveLength(1)
    expect(reqs[0].tipo_documento).toBe('FACTURA')
  })

  it('getRequisitosForEstado filtra por estado', () => {
    store.addRequisito('A', { tipo_documento: 'DNI', porcentaje: 100, auto_carga: false })
    store.addRequisito('B', { tipo_documento: 'FACTURA', porcentaje: 50, auto_carga: false })
    expect(store.getRequisitosForEstado('A')).toHaveLength(1)
    expect(store.getRequisitosForEstado('B')).toHaveLength(1)
    expect(store.getRequisitosForEstado('NOPE')).toHaveLength(0)
  })
})
