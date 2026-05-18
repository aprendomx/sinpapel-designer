# Spec — Botón Exportar por flujo en WorkflowListPage

**Fecha:** 2026-05-18
**Tamaño:** S (1 store action + 1 botón UI + tests).
**Estado:** Aprobado por el usuario en alcance.

## Contexto

`WorkflowListPage` lista los flujos de trabajo guardados en localStorage. Cada row tiene acciones: `Ver canvas | Toggle activo | Eliminar`. Falta una forma directa de exportar el JSON v0.2 de un flujo sin tener que abrirlo en el canvas y guardar.

El store tiene `exportToFile()` que opera sobre `current.value` (el flujo cargado en canvas) — útil al guardar desde el canvas, pero requiere cargar el flujo primero. Para exportar desde la lista necesitamos un path directo.

Cada flujo vive en localStorage como JSON v0.2 ya serializado bajo la clave `sinpapel-designer/workflow/<id>`.

## Objetivo

Añadir un botón "Exportar" por row en `WorkflowListPage` que descarga el JSON v0.2 del flujo correspondiente con nombre `workflow-<nombre>.json`. Sin afectar el flujo activo cargado en canvas.

## Decisiones

- **D1**: Nueva acción `exportFlujoById(id)` en el store. Lee localStorage directamente, no toca `current.value`.
- **D2**: Filename = `workflow-<flujo.nombre>.json` (mismo patrón que `exportToFile()` existente).
- **D3**: Botón con icono `file_download`, flat dense round, en row de acciones entre toggle y delete.
- **D4**: Si el flujo no existe (race con delete o localStorage desincronizado), lanza error que la página atrapa y muestra notify negativo.

## Out of scope

- Export en formato CSV/PDF/otro.
- Bulk export (varios flujos a la vez).
- Compartir / upload.
- Versionado del export.

## Arquitectura

**Capa store** (`src/stores/workflow.js`):

```js
async function exportFlujoById(id) {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`)
  if (!raw) throw new Error(`Flujo ${id} no encontrado`)
  const json = JSON.parse(raw)
  const nombre = json?.flujo?.nombre || 'untitled'
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `workflow-${nombre}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

Exportada en el `return` del defineStore.

**Capa UI** (`src/pages/WorkflowListPage.vue`):

Botón nuevo en `.wf-list__row-actions`, entre el toggle y el botón eliminar:

```vue
<q-btn
  flat dense round
  icon="file_download"
  :aria-label="`Exportar ${flujo.nombre}`"
  @click="exportar(flujo)"
/>
```

Handler en el script:

```js
async function exportar(flujo) {
  try {
    await store.exportFlujoById(flujo.id)
    $q.notify({ type: 'positive', message: `Exportado: workflow-${flujo.nombre}.json`, position: 'top' })
  } catch (e) {
    $q.notify({ type: 'negative', message: e?.message || 'Error al exportar', position: 'top' })
  }
}
```

## Errores

| Caso | Comportamiento |
|---|---|
| Flujo no existe en localStorage | Store lanza `Error('Flujo X no encontrado')` → notify negativo. |
| JSON corrupto en localStorage | `JSON.parse` lanza → notify negativo con mensaje del SyntaxError. |
| Browser bloquea descarga (popup blocker) | Fuera de nuestro control — el `a.click()` es silencioso. |

## Testing

Nuevo archivo `tests/store-export-flujo-by-id.test.js` con 3-4 tests:
1. Export existente: descarga blob con filename `workflow-<nombre>.json`.
2. Flujo inexistente: lanza error.
3. JSON corrupto: lanza error de parse.
4. No muta `current.value` (path ortogonal).

UI: el botón es declarativo simple (1 línea, 1 handler). Cubierto por el smoke test existente de `workflow-list.test.js` si se quiere extender; opcional para v1.

## Componentes nuevos vs modificados

**Modificados:**
- `src/stores/workflow.js` — añadir `exportFlujoById` + export en `return`.
- `src/pages/WorkflowListPage.vue` — botón + handler.

**Nuevo:**
- `tests/store-export-flujo-by-id.test.js`.

**Sin cambios:** `exportToFile()` existente (lo sigue usando el canvas), schema v0.2, otros componentes.

## Riesgos

Bajo. Path ortogonal, sin side effects sobre `current.value`. Reutiliza patrón de download blob ya validado en `exportToFile()`.
