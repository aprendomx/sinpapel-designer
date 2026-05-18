# Botón Exportar por Flujo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir botón "Exportar" por row en `WorkflowListPage` que descarga el JSON v0.2 del flujo correspondiente.

**Architecture:** Nueva acción `exportFlujoById(id)` en el store que lee directo de localStorage (sin tocar `current.value`). Botón con icono `file_download` en cada row entre el toggle y el delete.

**Tech Stack:** Vue 3 `<script setup>`, Quasar, Pinia, vitest. Sin nuevas dependencias.

**Spec:** `docs/superpowers/specs/2026-05-18-export-por-flujo-design.md`

---

## File Structure

**Modify:**
- `src/stores/workflow.js` — añadir `exportFlujoById` action + export en `return`.
- `src/pages/WorkflowListPage.vue` — añadir botón + handler.

**Create:**
- `tests/store-export-flujo-by-id.test.js` — 3 tests para la acción del store.

---

## Task 1: Store action `exportFlujoById`

**Files:**
- Modify: `src/stores/workflow.js`
- Test: `tests/store-export-flujo-by-id.test.js` (nuevo)

- [ ] **Step 1.1: Crear test que falla**

Crear `tests/store-export-flujo-by-id.test.js`:

```javascript
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
```

- [ ] **Step 1.2: Correr y verificar que falla**

```bash
npm test -- --run tests/store-export-flujo-by-id.test.js
```

Expected: 4 FAIL (acción no existe).

- [ ] **Step 1.3: Añadir `exportFlujoById` al store**

En `src/stores/workflow.js`, localizar la función `exportToFile()` existente (alrededor de la línea 196). Inmediatamente después de su cierre `}`, añadir:

```javascript
  async function exportFlujoById(id) {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`)
    if (!raw) throw new Error(`Flujo ${id} no encontrado`)
    const json = JSON.parse(raw)
    const nombre = json?.flujo?.nombre || 'untitled'
    const blob = new Blob([JSON.stringify(json, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workflow-${nombre}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
```

En el `return { ... }` final del defineStore (alrededor de la línea 540), localizar la línea con `exportToFile,` y añadir inmediatamente después:

```javascript
    exportFlujoById,
```

- [ ] **Step 1.4: Correr y verificar PASS**

```bash
npm test -- --run tests/store-export-flujo-by-id.test.js
```

Expected: 4 PASS.

- [ ] **Step 1.5: Suite + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan.

- [ ] **Step 1.6: Commit**

```bash
git add src/stores/workflow.js tests/store-export-flujo-by-id.test.js
git commit -m "$(cat <<'EOF'
feat(store): exportFlujoById para descargar JSON v0.2 por id

Lee directo de localStorage (clave sinpapel-designer/workflow/<id>),
sin tocar current.value. Filename workflow-<nombre>.json (mismo
patrón que exportToFile). Lanza Error si el flujo no existe o el
JSON está corrupto.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Botón Exportar en WorkflowListPage

**Files:**
- Modify: `src/pages/WorkflowListPage.vue`

- [ ] **Step 2.1: Añadir botón al template**

En `src/pages/WorkflowListPage.vue`, localizar el bloque `<div class="wf-list__row-actions" @click.stop>` (alrededor de la línea 104). Entre el `<q-toggle>` y el `<q-btn icon="delete">`, insertar:

```vue
            <q-btn
              flat dense round
              icon="file_download"
              :aria-label="`Exportar ${flujo.nombre}`"
              @click="exportar(flujo)"
            />
```

La estructura final de `.wf-list__row-actions` queda:

```vue
          <div class="wf-list__row-actions" @click.stop>
            <q-btn
              flat dense no-caps
              icon="open_in_full"
              label="Ver canvas"
              class="wf-list__row-link"
              @click="abrirCanvas(flujo.id)"
            />
            <q-toggle
              :model-value="flujo.activo"
              color="positive"
              dense
              :loading="togglingId === flujo.id"
              @update:model-value="toggleActivo(flujo)"
            />
            <q-btn
              flat dense round
              icon="file_download"
              :aria-label="`Exportar ${flujo.nombre}`"
              @click="exportar(flujo)"
            />
            <q-btn
              flat dense round
              icon="delete"
              color="negative"
              :aria-label="`Eliminar ${flujo.nombre}`"
              @click="confirmDelete(flujo)"
            />
          </div>
```

- [ ] **Step 2.2: Añadir handler en el script**

En el `<script setup>`, localizar la función `toggleActivo` (alrededor de línea 263). Inmediatamente después de su cierre `}`, añadir:

```javascript
async function exportar(flujo) {
  try {
    await store.exportFlujoById(flujo.id)
    $q.notify({
      type: 'positive',
      message: `Exportado: workflow-${flujo.nombre}.json`,
      position: 'top',
    })
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e?.message || 'Error al exportar',
      position: 'top',
    })
  }
}
```

- [ ] **Step 2.3: Suite + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan. El smoke test existente de `workflow-list.test.js` no asume número específico de botones por row — debería seguir verde.

- [ ] **Step 2.4: Commit**

```bash
git add src/pages/WorkflowListPage.vue
git commit -m "$(cat <<'EOF'
feat(workflows): botón Exportar por row en WorkflowListPage

Icono file_download entre el toggle activo y el botón eliminar.
Llama store.exportFlujoById(flujo.id) con try/catch + notify
positivo/negativo según resultado.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Verificación manual + push

- [ ] **Step 3.1: Arrancar dev server**

```bash
npm run dev
```

- [ ] **Step 3.2: Recorrer el flujo dorado**

1. Abrir `/workflows`.
2. Si no hay flujos, crear uno (botón "Nuevo flujo" → llenar nombre → Crear).
3. En la row del flujo, clic en el botón con icono `file_download`.
4. Verificar que el browser descarga un archivo `workflow-<nombre>.json`.
5. Abrir el archivo descargado → confirmar shape JSON v0.2 (schema_version, catalogos, flujo, transiciones, requisitos).
6. Confirmar notify positivo "Exportado: workflow-<nombre>.json".

- [ ] **Step 3.3: Recorrer caso de error**

1. Abrir DevTools → Application → Local Storage.
2. Borrar manualmente la entry `sinpapel-designer/workflow/<id>` de un flujo (sin recargar la lista).
3. Clic en Exportar en ese flujo.
4. Confirmar notify negativo con mensaje "Flujo X no encontrado".

- [ ] **Step 3.4: Push**

```bash
git push
```

Expected: 2 commits pusheados a `origin/develop`.
