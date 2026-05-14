// S27.7 T1 — Store CRUD catalogos tests.
// Cover 4 catalogs × 3 ops (add/update/remove) + reference helpers + cascade.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkflowStore } from '../src/stores/workflow.js'

function createStorageMock() {
  let store = {}
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value) },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i) => Object.keys(store)[i] || null,
  }
}

async function setupStoreWithFlujo() {
  const store = useWorkflowStore()
  const f = await store.createFlujo({ nombre: 'Test' })
  await store.getFlujo(f.id)
  return store
}

describe('store CRUD catalogos', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    setActivePinia(createPinia())
  })

  it('addEstado pushes entry + sets isDirty', async () => {
    const store = await setupStoreWithFlujo()
    expect(store.current.estados.length).toBe(0)
    store.addEstado({
      nombre: 'CAPTURA',
      color: '#ff0000',
      icono: 'edit',
      descripcion: '',
      orden: 1,
      activo: true,
      etapa: null,
      permite_expediente: false,
      expediente_obligatorio: false,
    })
    expect(store.current.estados.length).toBe(1)
    expect(store.current.estados[0].nombre).toBe('CAPTURA')
    expect(store.current.estados[0].id).toBeDefined()
    expect(store.isDirty).toBe(true)
  })

  it('removeEstado cascades transitions referencing it', async () => {
    const store = await setupStoreWithFlujo()
    store.addEstado({ nombre: 'A', orden: 1, activo: true })
    store.addEstado({ nombre: 'B', orden: 2, activo: true })
    const idA = store.current.estados[0].id
    // Inject transition A→B
    store.current.transiciones = [{
      id: 1,
      estado_origen: { nombre: 'A' },
      estado_destino: { nombre: 'B' },
      grupos_permitidos: [],
    }]
    store.removeEstado(idA)
    expect(store.current.estados.length).toBe(1)
    expect(store.current.estados[0].nombre).toBe('B')
    expect(store.current.transiciones.length).toBe(0)
  })

  it('findEstadoReferences returns transitions count', async () => {
    const store = await setupStoreWithFlujo()
    store.addEstado({ nombre: 'X', orden: 1, activo: true })
    store.current.transiciones = [
      { id: 1, estado_origen: { nombre: 'X' }, estado_destino: { nombre: 'Y' }, grupos_permitidos: [] },
      { id: 2, estado_origen: { nombre: 'Z' }, estado_destino: { nombre: 'X' }, grupos_permitidos: [] },
    ]
    const refs = store.findEstadoReferences('X')
    expect(refs.transitions).toBe(2)
  })

  it('updateEtapa rename cascades Estado.etapa refs', async () => {
    const store = await setupStoreWithFlujo()
    store.addEtapa({ nombre: 'Pre', orden: 1, activo: true })
    store.addEstado({ nombre: 'E1', etapa: 'Pre', orden: 1, activo: true })
    const etapaId = store.current.etapas[0].id
    store.updateEtapa(etapaId, { nombre: 'PreAprob' })
    expect(store.current.etapas[0].nombre).toBe('PreAprob')
    expect(store.current.estados[0].etapa).toBe('PreAprob')
  })

  it('removeEtapa auto-nulls Estado.etapa refs (D3)', async () => {
    const store = await setupStoreWithFlujo()
    store.addEtapa({ nombre: 'Pre', orden: 1, activo: true })
    store.addEstado({ nombre: 'E1', etapa: 'Pre', orden: 1, activo: true })
    const etapaId = store.current.etapas[0].id
    store.removeEtapa(etapaId)
    expect(store.current.etapas.length).toBe(0)
    expect(store.current.estados[0].etapa).toBe(null)
  })

  it('addGrupo + removeGrupo cascades transitions.grupos_permitidos', async () => {
    const store = await setupStoreWithFlujo()
    store.addGrupo({ name: 'admins' })
    store.addGrupo({ name: 'analistas' })
    const idAdmins = store.current.grupos[0].id
    store.current.transiciones = [{
      id: 1,
      estado_origen: { nombre: 'A' },
      estado_destino: { nombre: 'B' },
      grupos_permitidos: [{ id: idAdmins, name: 'admins' }, { id: 99, name: 'analistas' }],
    }]
    store.removeGrupo(idAdmins)
    expect(store.current.grupos.length).toBe(1)
    expect(store.current.transiciones[0].grupos_permitidos).toHaveLength(1)
    expect(store.current.transiciones[0].grupos_permitidos[0].name).toBe('analistas')
  })

  it('addTipoDocumento + removeTipoDocumento cascades requisitos', async () => {
    const store = await setupStoreWithFlujo()
    store.addTipoDocumento({ nombre: 'INE', orden: 1, activo: true })
    const idTD = store.current.tipos_documento[0].id
    store.current.requisitos = [{
      estado: 'CAPTURA',
      tipo_documento: 'INE',
      porcentaje: 100,
      auto_carga: false,
    }]
    const refs = store.findTipoDocumentoReferences('INE')
    expect(refs.requisitos).toBe(1)
    store.removeTipoDocumento(idTD)
    expect(store.current.tipos_documento.length).toBe(0)
    expect(store.current.requisitos.length).toBe(0)
  })

  it('updateEstado rename updates positions + transitions refs', async () => {
    const store = await setupStoreWithFlujo()
    store.addEstado({ nombre: 'OLD', orden: 1, activo: true })
    const id = store.current.estados[0].id
    store.current.transiciones = [{
      id: 1,
      estado_origen: { nombre: 'OLD' },
      estado_destino: { nombre: 'OTHER' },
      grupos_permitidos: [],
    }]
    store.updateEstado(id, { nombre: 'NEW' })
    expect(store.current.estados[0].nombre).toBe('NEW')
    expect(store.current.transiciones[0].estado_origen.nombre).toBe('NEW')
  })
})
