# Spec — Agregar Estado desde el canvas

**Fecha:** 2026-05-16
**Sub-proyecto:** A (de una descomposición A→B→C→D)
**Estado:** Aprobado por el usuario, pendiente plan de implementación

## Contexto

Hoy, para añadir un Estado nuevo al diseñar un workflow, el usuario tiene que:
1. Salir del canvas → ir a `CatalogosPage` (pestaña Estados).
2. Crear el Estado en el formulario.
3. Volver al canvas, abrir el flujo y arrastrar el nuevo estado desde el panel izquierdo.

Esto rompe el flujo de trabajo y obliga a navegar fuera del diseñador. El sub-proyecto A añade un botón "+" en el panel de Estados del canvas que abre el mismo diálogo de creación in-place.

Los sub-proyectos B (reglas por transición), C (archivos requeridos por transición) y D (generador IA) se documentan en specs separados cuando este cierre.

## Objetivo

Permitir crear un nuevo Estado sin salir del `WorkflowCanvasPage`. El estado recién creado aparece en el panel izquierdo y el usuario lo arrastra al canvas igual que cualquier otro.

## Out of scope

- Reglas por transición (sub-proyecto B).
- Requisitos documentales por transición (sub-proyecto C).
- Generador IA (sub-proyecto D).
- Botones equivalentes para Etapas/Grupos/Tipos Documento desde el canvas — esos siguen viviendo en `CatalogosPage`.
- Auto-añadir el nuevo estado al canvas en una posición predeterminada — el usuario lo arrastra (decisión de UX confirmada para mantener consistencia con el flujo drag-and-drop actual).

## Arquitectura

Se reutilizan dos piezas existentes:

- `CatalogoFormDialog.vue` — ya acepta `catalog-key="estados"` y el prop `editing` (null = crear). Llama internamente a `store.addEstado()` o `store.updateEstado()`.
- `store.addEstado(data)` (en `src/stores/workflow.js`) — añade el estado al `current.value.estados`, dispara `_markDirty()`, y el autosave del store lo persiste a localStorage en 500 ms.

No se necesitan nuevas acciones del store ni cambios en el schema v0.2.

## Componentes tocados

### 1. `src/components/WorkflowCanvasStatesPanel.vue`

- Añadir un `q-btn` con icono `add_circle_outline` en el header (`wf-states__header`), alineado a la derecha.
- Botón emite el evento `'create'` (sin payload) al click.
- Sólo visible en `editMode` (el panel completo ya lo está, así que es heredado).
- Atributo `aria-label="Crear Estado"`.

### 2. `src/pages/WorkflowCanvasPage.vue`

- Declarar `const createDialogOpen = ref(false)`.
- Importar `CatalogoFormDialog` (ya importado indirectamente; verificar).
- Escuchar `@create="createDialogOpen = true"` en el `<WorkflowCanvasStatesPanel>`.
- Renderizar `<CatalogoFormDialog v-model="createDialogOpen" catalog-key="estados" :editing="null" @saved="reloadEstatuses" />`.
- Extraer una función `reloadEstatuses()` que reproduzca la lógica actual del bloque `estatuses` dentro de `onMounted`:
  ```js
  async function reloadEstatuses() {
    const result = await store.getEstatuses()
    todosEstatuses.value = (result ?? []).filter(e => e.activo !== false)
  }
  ```
- Dentro de `onMounted`, reemplazar el manejo del resultado de `estatuses` (en el bloque `Promise.allSettled([store.getGrupos(), store.getEstatuses()])`) por una llamada directa a `reloadEstatuses()`. El bloque de `grupos` se mantiene como está. Se acepta que `reloadEstatuses()` sea una llamada secuencial extra: el costo es despreciable y simplifica el código.

### 3. `src/components/CatalogoFormDialog.vue` (mejora defensiva)

- Envolver la llamada a `store[cfg.addAction]` / `store[cfg.updateAction]` en `onSave()` con `try/catch`. Si falla (p. ej. nombre duplicado, que el store lanza con `_assertUniqueName`), mostrar `$q.notify` negativo con el mensaje y **no** cerrar el dialog. Hoy el dialog cierra sin avisar al usuario aunque el store haya lanzado.

## Data flow

```
User (editMode on canvas)
  │ clic "+" en panel
  ▼
WorkflowCanvasStatesPanel → emit 'create'
  │
  ▼
WorkflowCanvasPage → createDialogOpen = true
  │
  ▼
CatalogoFormDialog (catalog-key="estados", editing=null)
  │ user llena formulario, clic Guardar
  ▼
store.addEstado(data)
  │ _assertUniqueName → _markDirty (autosave 500ms)
  ▼
CatalogoFormDialog emit 'saved' + cierra
  │
  ▼
WorkflowCanvasPage → reloadEstatuses()
  │
  ▼
todosEstatuses.value actualizado → panel re-renderiza con el nuevo chip
  │
  ▼
User arrastra el chip al canvas (flujo existente, sin cambios)
```

## Errores

| Error | Comportamiento |
|---|---|
| Nombre vacío | El form ya tiene validación (`f.required` → regla `(v) => !!v`). |
| Nombre duplicado | `_assertUniqueName` lanza `Error('estado con nombre='X' ya existe')`. Con el `try/catch` añadido en `CatalogoFormDialog`, mostramos notify negativo y el dialog queda abierto para que el usuario corrija. |
| Sin flujo cargado (`store.current === null`) | El botón "+" sólo aparece dentro del canvas, que ya garantiza un flujo cargado. Caso imposible en práctica; `_addToCatalog` devuelve `null` defensivamente sin lanzar. |

## Testing

### Unit / componente (vitest + @vue/test-utils)

Añadir casos en `tests/workflow-canvas.test.js` (o nuevo archivo `tests/canvas-add-estado.test.js` si crece):

1. **Botón visible en edit mode**: montar `WorkflowCanvasStatesPanel` con `editMode=true`, verificar que existe un botón con `aria-label="Crear Estado"`.
2. **Emisión del evento**: simular click en el botón → verificar `wrapper.emitted('create')`.
3. **Refresh tras saved**: en `WorkflowCanvasPage`, mockear `store.getEstatuses()` para devolver primero `[A]` y luego `[A, B]`. Disparar el evento `saved` del dialog → verificar que `todosEstatuses` contiene ahora ambos.
4. **Notificación de error**: en `CatalogoFormDialog`, mockear `store.addEstado` para que lance → verificar que `$q.notify` se llamó con `type: 'negative'` y que `modelValue` sigue siendo `true`.

### Manual

- Abrir un flujo en el canvas → activar Edit → clic "+" → crear Estado nuevo → confirmar que aparece como chip en el panel y se puede arrastrar al canvas.
- Intentar crear con nombre duplicado → confirmar notify + dialog abierto.

## Decisiones tomadas

- **D1**: Reusar `CatalogoFormDialog` en vez de crear un componente nuevo. Razón: cero duplicación, hereda futuros cambios (validaciones, nuevos campos).
- **D2**: No auto-añadir al canvas. Razón: consistencia con el flujo drag-and-drop actual, evita conflictos de posicionamiento.
- **D3**: Refresco vía recarga (`reloadEstatuses`), no vía push reactivo. Razón: simplicidad — `store.getEstatuses()` ya es la fuente de verdad y devuelve `current.value.estados` que es reactivo de todas formas. Una variante futura sería usar directamente `store.current.estados` como `computed`; se deja como mejora opcional fuera de scope.

## Riesgos

- Bajo. Reutiliza piezas probadas. El único riesgo nuevo es el `try/catch` en `CatalogoFormDialog`, que mejora silenciosamente el comportamiento en los 4 catálogos (Estados, Etapas, Grupos, Tipos Documento) — beneficio neto pero hay que verificar que los tests existentes de catálogos no asumen cierre incondicional.
