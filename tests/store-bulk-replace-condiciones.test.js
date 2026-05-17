import { describe, it, expect, beforeEach, vi } from 'vitest'
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
    grupos: [{ id: 1, name: 'admin' }],
    tipos_documento: [],
    transiciones: [],
    requisitos: [],
  }
}

describe('store — bulkReplaceTransiciones con condiciones', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWorkflowStore()
    bootstrapFlujo(store)
    // Stub getFlujo para que no haga IO; el id ya está sincronizado.
    store.getFlujo = vi.fn().mockResolvedValue(store.current.flujo)
  })

  it('asigna condiciones desde el payload con shape normalizado completo', async () => {
    await store.bulkReplaceTransiciones('f1', [{
      estado_origen_id: 'eA',
      estado_destino_id: 'eB',
      grupos_ids: [1],
      condiciones: [
        { tipo: 'json_logic', configuracion: { rule: { '==': [1, 1] } }, mensaje_error: 'falla', orden: 2, activo: false },
      ],
    }])
    expect(store.current.transiciones[0].condiciones).toEqual([
      { tipo: 'json_logic', configuracion: { rule: { '==': [1, 1] } }, mensaje_error: 'falla', orden: 2, activo: false },
    ])
  })

  it('asigna array vacío si el payload no incluye condiciones', async () => {
    await store.bulkReplaceTransiciones('f1', [{
      estado_origen_id: 'eA',
      estado_destino_id: 'eB',
      grupos_ids: [],
    }])
    expect(store.current.transiciones[0].condiciones).toEqual([])
  })

  it('preserva condiciones de tipo desconocido', async () => {
    await store.bulkReplaceTransiciones('f1', [{
      estado_origen_id: 'eA',
      estado_destino_id: 'eB',
      grupos_ids: [],
      condiciones: [
        { tipo: 'futuro', configuracion: { foo: 'bar' }, mensaje_error: '', orden: 0, activo: true },
      ],
    }])
    expect(store.current.transiciones[0].condiciones[0].tipo).toBe('futuro')
    expect(store.current.transiciones[0].condiciones[0].configuracion).toEqual({ foo: 'bar' })
  })
})
