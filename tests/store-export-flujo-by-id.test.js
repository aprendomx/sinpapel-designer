import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkflowStore } from '../src/stores/workflow.js'

function createStorageMock() {
  const data = {}
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = String(v) },
    removeItem: (k) => { delete data[k] },
    clear: () => { for (const k of Object.keys(data)) delete data[k] },
  }
}

describe('store.exportFlujoById', () => {
  let clickSpy

  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    setActivePinia(createPinia())

    // Stub URL.createObjectURL / revokeObjectURL (jsdom no implementa)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    })

    // Spy el click del anchor — capturamos el filename
    clickSpy = vi.fn()
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        const a = origCreateElement(tag)
        a.click = clickSpy
        return a
      }
      return origCreateElement(tag)
    })
  })

  it('descarga blob con filename workflow-<nombre>.json', async () => {
    const store = useWorkflowStore()
    const fakeJson = {
      schema_version: '0.2',
      flujo: { nombre: 'Mi Flujo', descripcion: '', activo: false },
      catalogos: { estados: [], etapas: [], grupos: [], tipos_documento: [] },
    }
    localStorage.setItem('sinpapel-designer/workflow/abc123', JSON.stringify(fakeJson))

    await store.exportFlujoById('abc123')

    expect(clickSpy).toHaveBeenCalledTimes(1)
    // El anchor capturado tiene .download asignado antes del click
    const anchor = document.createElement.mock.results.find(
      (r) => r.value.tagName === 'A',
    )?.value
    expect(anchor.download).toBe('workflow-Mi Flujo.json')
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('lanza Error si el flujo no existe en localStorage', async () => {
    const store = useWorkflowStore()
    await expect(store.exportFlujoById('nope')).rejects.toThrow(/no encontrado/i)
  })

  it('lanza Error si el JSON en localStorage está corrupto', async () => {
    const store = useWorkflowStore()
    localStorage.setItem('sinpapel-designer/workflow/bad', '{not json')
    await expect(store.exportFlujoById('bad')).rejects.toThrow()
  })

  it('no muta store.current al exportar', async () => {
    const store = useWorkflowStore()
    const fakeJson = {
      schema_version: '0.2',
      flujo: { nombre: 'X' },
      catalogos: { estados: [], etapas: [], grupos: [], tipos_documento: [] },
    }
    localStorage.setItem('sinpapel-designer/workflow/x', JSON.stringify(fakeJson))

    expect(store.current).toBeNull()
    await store.exportFlujoById('x')
    expect(store.current).toBeNull()
  })
})
