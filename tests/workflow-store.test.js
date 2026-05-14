// S27.5 T2 — Pinia store tests.
// localStorage mocked via vitest jsdom (default behavior).
// Pinia setup via createTestingPinia OR setActivePinia + createPinia.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkflowStore } from '../src/stores/workflow.js'

// Explicit localStorage mock — jsdom localStorage incomplete en algunos
// entornos Node, mock garantiza determinismo cross-environment.
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

describe('workflow store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    setActivePinia(createPinia())
  })

  it('createFlujo + getFlujo persists + retrieves from localStorage', async () => {
    const store = useWorkflowStore()
    const created = await store.createFlujo({
      nombre: 'Test Flujo',
      descripcion: 'test',
    })
    expect(created.nombre).toBe('Test Flujo')
    expect(created.id).toBeDefined()
    // Verify persisted
    expect(localStorage.getItem(`sinpapel-designer/workflow/${created.id}`)).toBeTruthy()
    // Retrieve via getFlujo
    const fetched = await store.getFlujo(created.id)
    expect(fetched.nombre).toBe('Test Flujo')
  })

  it('getFlujos enumerates localStorage index', async () => {
    const store = useWorkflowStore()
    await store.createFlujo({ nombre: 'A' })
    await store.createFlujo({ nombre: 'B' })
    const flujos = await store.getFlujos()
    expect(flujos.length).toBe(2)
    expect(flujos.map((f) => f.nombre).sort()).toEqual(['A', 'B'])
  })

  it('exportToFile triggers download via Blob URL', () => {
    const store = useWorkflowStore()
    store.current = {
      flujo: { id: '1', nombre: 'Demo', descripcion: '', activo: true, metadatos: null },
      estados: [], etapas: [], grupos: [], tipos_documento: [],
      transiciones: [], requisitos: [],
    }
    // jsdom no provides URL.createObjectURL — mock explicit
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const clickSpy = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: clickSpy,
    })

    store.exportToFile()

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalled()
  })

  it('discard restores snapshot', async () => {
    const store = useWorkflowStore()
    const created = await store.createFlujo({ nombre: 'Original' })
    await store.getFlujo(created.id)  // populates snapshot
    // Mutate current
    store.current.flujo.nombre = 'Modified'
    store.discard()
    expect(store.current.flujo.nombre).toBe('Original')
  })

  // ── S27.6 deleteFlujo tests ──

  it('deleteFlujo removes from localStorage + index', async () => {
    const store = useWorkflowStore()
    const f1 = await store.createFlujo({ nombre: 'A' })
    const f2 = await store.createFlujo({ nombre: 'B' })
    await store.deleteFlujo(f1.id)
    expect(localStorage.getItem(`sinpapel-designer/workflow/${f1.id}`)).toBeNull()
    expect(localStorage.getItem(`sinpapel-designer/workflow/${f2.id}`)).toBeTruthy()
    const index = JSON.parse(localStorage.getItem('sinpapel-designer/workflow-index'))
    expect(index).toEqual([f2.id])
  })

  it('deleteFlujo cascades clear current if matching (D6)', async () => {
    const store = useWorkflowStore()
    const created = await store.createFlujo({ nombre: 'Active' })
    await store.getFlujo(created.id)
    expect(store.current).not.toBeNull()
    await store.deleteFlujo(created.id)
    expect(store.current).toBeNull()
    expect(store.isDirty).toBe(false)
  })

  it('deleteFlujo throws if id not found', async () => {
    const store = useWorkflowStore()
    await expect(store.deleteFlujo('nonexistent')).rejects.toThrow(/not found/)
  })

  it('validateSchema (via loadFromFile) rejects unsupported version', async () => {
    const store = useWorkflowStore()
    // jsdom File.text() incomplete — mock con minimal duck-typed object
    const file = {
      text: async () => JSON.stringify({ schema_version: '0.3', flujo: { nombre: 'X' } }),
    }
    await expect(store.loadFromFile(file)).rejects.toThrow(/Unsupported schema_version/)
  })
})
