# Spec — Reglas por transición (Condiciones + Requisitos)

**Fecha:** 2026-05-17
**Sub-proyecto:** B (fusionado con C; ahora B cubre condiciones + requisitos documentales)
**Estado:** Aprobado por el usuario en alcance, pendiente review de spec escrito

## Contexto

El backend de sinpapel ya tiene **todo** lo necesario para reglas por transición:

- **`CondicionTransicion`** (`sinpapel/models/predicates.py`) — FK a `ConfiguracionTransicion`, con `tipo` (`python_path` / `json_logic` / `django_orm`), `configuracion` (JSON), `mensaje_error`, `orden`, `activo`. `PredicateEngine` evalúa AND lógico antes de permitir la transición (`workflow_engine.py:100-132`).
- **`RequisitoEstadoDocumento`** (`sinpapel/models/workflow.py:266-297`) — FK a `Estado` destino y a `TipoDocumento`, con `porcentaje` y `auto_carga`. El engine los considera al validar documentos antes de permitir entrar al estado.
- **Schema v0.2 backend** ya serializa e importa `condiciones` por transición (`flujo_export.py:82-94` y `434-440`) y `requisitos` por estado (`flujo_export.py:101-111`). El round-trip backend↔backend funciona.

**Problema:** el designer no sabe nada de condiciones. El JSON v0.2 que produce el cliente las omite; el store no las maneja; `WorkflowCanvasTransitionPanel` sólo muestra `grupos_permitidos`. Si un usuario abre un flujo con condiciones existentes en el designer y lo guarda, **las condiciones se pierden silenciosamente** (data loss).

Los requisitos sí están en el schema v0.2 del cliente desde S27.5 pero **nunca se exponen en la UI** — el usuario no puede verlos ni editarlos desde el designer.

## Objetivo

Cerrar la brecha entre designer y backend para reglas:

1. El JSON v0.2 cliente round-trippea `condiciones` por transición (no más data loss).
2. El designer permite ver, crear, editar, reordenar y borrar **condiciones** por transición (con editor estructurado por tipo).
3. El designer permite ver, crear, editar y borrar **requisitos documentales** (vinculados al estado destino) desde el panel de la transición que llega a ese estado.
4. `bulkReplaceTransiciones` del store preserva las condiciones existentes de las transiciones que sobreviven al guardado.

## Out of scope

- **No** se modifica ningún modelo backend ni se crea una migración.
- **No** se mueve `RequisitoEstadoDocumento` a ser por transición (queda por estado destino). Decidido con el usuario: el panel de transición muestra los requisitos del `estado_destino` contextualmente; editar requisitos desde una transición edita el estado destino subyacente, y la misma lista aparece en cualquier transición que llegue a ese estado.
- **No** se construye un visual JsonLogic builder (textarea con JSON parseable es suficiente para v1).
- **No** se valida en cliente que un `python_path` sea callable, que un `json_logic` produzca el output esperado, ni que un `django_orm` lookup sea válido. Esa validación es backend en runtime.
- **No** se exponen otros tipos de regla del backend (side_effects, SLAs) — sub-proyectos separados si se necesitan.

## Arquitectura

Cambios sólo en el cliente, en 4 capas:

### 1. Schema v0.2 cliente (`src/data/schema-v0_2.js`)

`_serializeTransicion` añade `condiciones` cuando hay ≥1 (omite el campo si está vacío, para mantener diff mínimo con backend que también lo omite). `_deserializeTransicion` añade `condiciones` al objeto interno cuando aparecen en el JSON, default `[]`.

Schema interno de una transición pasa de:
```js
{ id, estado_origen, estado_destino, grupos_permitidos }
```
a:
```js
{ id, estado_origen, estado_destino, grupos_permitidos, condiciones: [] }
```

Cada condición interna:
```js
{
  id: <hashId(tipo + JSON.stringify(configuracion) + orden)>,  // client-side stable id
  tipo: 'python_path' | 'json_logic' | 'django_orm',
  configuracion: object,  // shape depends on tipo
  mensaje_error: string,
  orden: number,
  activo: boolean
}
```

Round-trip JSON v0.2 condicion:
```json
{
  "tipo": "json_logic",
  "configuracion": { "rule": { ">=": [{"var": "monto"}, 100000] } },
  "mensaje_error": "Monto debe ser ≥ 100,000",
  "orden": 0,
  "activo": true
}
```

Requisitos (ya en schema desde S27.5) no cambian su shape; sólo se garantiza que `parseV0_2` los deserialice a `state.requisitos` (ya lo hace en `schema-v0_2.js:84`).

### 2. Store (`src/stores/workflow.js`)

**Modelo de propagación (importante).** Hay dos clases de cambios con flujos distintos en este codebase, y reglas de cada clase se alinean a esos flujos para evitar UX inconsistente:

| Categoría | Fuente de verdad durante edición | Persistencia |
|---|---|---|
| **Edge-level** (grupos, posiciones, **condiciones**) | `nodes`/`edges` locales en `WorkflowCanvasPage` | Manual al hacer clic "Guardar" en toolbar → `bulkReplaceTransiciones` + `saveLayout` |
| **Catálogo-level** (estados, etapas, grupos, tipos_documento, **requisitos**) | `store.current.*` | Autosave 500ms vía `_markDirty` |

Las **condiciones** son edge-level porque conceptualmente pertenecen a la conexión visible en el canvas: si el usuario re-conecta un edge o lo borra, las condiciones deben seguir esa intención. Por eso viven en `edge.data.condiciones` durante la sesión de edición, como ya lo hacen `grupos_ids`.

Los **requisitos** son catálogo-level porque pertenecen al estado destino (no a una transición específica); editarlos desde el panel de transición conceptualmente edita el estado, no la transición.

**Nuevas acciones del store (sólo requisitos):**

- `addRequisito(estadoNombre, data)` — `data` shape: `{ tipo_documento, porcentaje, auto_carga }`. Push a `current.value.requisitos` con `estado = estadoNombre`. Validar unicidad por `(estado, tipo_documento)` con `_assertUniqueRequisito`. `_markDirty`.
- `updateRequisito(estadoNombre, tipoDocNombre, patch)` — el "id" compuesto es `(estado, tipo_documento)`, porque el JSON v0.2 no tiene id propio. `_markDirty`.
- `removeRequisito(estadoNombre, tipoDocNombre)` — filter out, `_markDirty`.
- `getRequisitosForEstado(estadoNombre)` — helper de lectura (puede ser un getter computed o un método): retorna `requisitos.filter(r => r.estado === estadoNombre)`.

**Cambios a `bulkReplaceTransiciones`:** el payload de la página ya incluirá `condiciones` por transición (ver §3 abajo). El store ahora las recibe y las asigna directamente:

```js
function bulkReplaceTransiciones(id, transicionesPayload) {
  // ... existing setup (estadoById, etc.) ...
  current.value.transiciones = transicionesPayload.map((t, i) => ({
    id: i + 1,
    estado_origen: estadoById[t.estado_origen_id] || { nombre: String(t.estado_origen_id) },
    estado_destino: estadoById[t.estado_destino_id] || { nombre: String(t.estado_destino_id) },
    grupos_permitidos: (t.grupos_ids || []).map(gid => /* existing logic */),
    condiciones: t.condiciones || [],
  }))
  _markDirty()
}
```

No se preservan condiciones por key origen→destino: la página es la fuente de verdad para todo lo edge-level durante la sesión, y el payload contiene lo que el usuario tiene en pantalla.

### 3. UI — `WorkflowCanvasTransitionPanel.vue`

Cuando hay una `selectedEdge`, debajo del editor de grupos_permitidos existente, dos secciones nuevas:

#### 3a. Sección "Condiciones"

Las condiciones se leen y mutan en `selectedEdge.data.condiciones`. El panel expone un evento `condiciones-change` al padre, análogo al `grupos-change` actual, para que `WorkflowCanvasPage` actualice el edge correspondiente y marque `isDirty.value = true`.

- Header: "Condiciones" + chip con count + botón `+`.
- Lista vertical con cada condición como una row:
  - Drag handle (izquierda) para reordenar.
  - Chip de tipo (color por tipo: `python_path` violeta, `json_logic` ámbar, `django_orm` azul).
  - Texto preview de `mensaje_error` (truncado).
  - Toggle `activo` (right).
  - Botón eliminar.
- Click en row abre `CondicionFormDialog` en modo edit.
- Empty state: "Sin condiciones. Todas las transiciones pasarán este check."

#### 3b. Sección "Documentos requeridos del estado destino"

- Header: "Documentos requeridos (al llegar a [nombre destino])" + count + botón `+`.
- Lista con cada requisito:
  - Chip de tipo_documento (color del tipo).
  - Texto `porcentaje%` + badge `auto_carga` si está activo.
  - Botón eliminar.
- Click en row abre `RequisitoFormDialog` en modo edit.
- Empty state: "Sin requisitos documentales para entrar a [destino]."

### 4. Diálogos nuevos

#### `CondicionFormDialog.vue`

Props: `modelValue` (open), `editing` (null = crear), `existing` (array de condiciones actuales del edge, para calcular el `orden` por defecto del nuevo registro).

Emite `saved` con el objeto condición (no llama directamente al store: las condiciones se actualizan vía mutación de `edge.data.condiciones` en el padre).

Campos:
- `tipo` — `q-select` con 3 opciones (con label y descripción de cada uno).
- `mensaje_error` — `q-input` text.
- `activo` — `q-toggle` (default true).
- **Form específico por tipo** (slot v-if según `form.tipo`):
  - **python_path**: `q-input` `path` con placeholder `module.submodule.function`. Hint: "Ruta de Python a una función `f(instance, user) → (bool, str|None)`".
  - **json_logic**: `q-input` type=textarea `rule_json` con el JSON serializado de `configuracion.rule`. Parse al guardar; si falla, mostrar error inline. Hint con link a `jsonlogic.com`.
  - **django_orm**: editor key/value para `configuracion.lookup` (cada par es `field__lookup` → `value`). Botón "+ par" añade fila. Hint: "Filtros estilo Django ORM, ej. `monto__gte`: `100000`".

Validación cliente:
- `tipo` requerido.
- Por tipo: `path` no vacío / `rule_json` parseable / al menos 1 par en `lookup`.
- `mensaje_error` opcional (backend tiene default).

Al guardar: emitir `saved` con el objeto condición. El padre (`WorkflowCanvasTransitionPanel`) actualiza `edge.data.condiciones` y emite `condiciones-change` hacia la página. Usar el mismo patrón try/catch + `$q.notify` que `CatalogoFormDialog` tras Task 3 del sub-proyecto A para errores de validación (p.ej. JSON no parseable).

#### `RequisitoFormDialog.vue`

Props: `modelValue`, `editing`, `estadoId`.

Campos:
- `tipo_documento` — `q-select` con opciones de `store.current.tipos_documento` (label = `nombre`, value = `id`).
- `porcentaje` — `q-input` type=number, rango 0-100, default 100.
- `auto_carga` — `q-toggle`, default false.

Validación cliente:
- `tipo_documento` requerido.
- `porcentaje` entre 0 y 100.

Al guardar: `store.addRequisito(estadoNombre, data)` o `store.updateRequisito(estadoNombre, editing.tipo_documento, patch)`. Try/catch + notify negativo para errores (p.ej. duplicado).

## Data flow

```
User selecciona una edge en el canvas
  ▼
WorkflowCanvasTransitionPanel renderiza:
  - grupos_permitidos     (lee selectedEdge.data.grupos_ids)
  - condiciones           (lee selectedEdge.data.condiciones)
  - requisitos destino    (lee store.getRequisitosForEstado(destinoNombre))

──── Path A: Condiciones (edge-level, no autosave) ────
User clic + en "Condiciones" → CondicionFormDialog
  ▼
User llena form → submit → dialog emit 'saved' con condición
  ▼
Panel actualiza edge.data.condiciones y emite condiciones-change
  ▼
Page handler actualiza edges.value[idx].data.condiciones + isDirty.value = true
  ▼
[User sigue editando o hace Guardar]
  ▼
User clic "Guardar" en toolbar del canvas
  ▼
saveChanges construye payload con condiciones por edge
  ▼
store.bulkReplaceTransiciones recibe payload, asigna condiciones tal cual
  ▼
store.saveLayout + exportToFile (JSON v0.2 incluye condiciones)

──── Path B: Requisitos (catálogo-level, autosave) ────
User clic + en "Documentos requeridos" → RequisitoFormDialog
  ▼
User llena form → submit
  ▼
store.addRequisito(estadoDestinoNombre, data)
  - push a current.requisitos
  - _markDirty → autosave 500ms
  ▼
Panel re-renderiza (getRequisitosForEstado es reactivo)
```

## Errores

| Error | Comportamiento |
|---|---|
| `tipo` no seleccionado al crear condición | Form bloqueado (regla q-form). |
| `rule_json` no parseable | Error inline bajo el textarea, dialog no cierra. |
| Requisito duplicado (mismo tipo_documento para el mismo estado) | `_assertUniqueRequisito` lanza; dialog atrapa y muestra notify negativo. |
| Borrar condición de transición que ya no existe | `removeCondicion` no-op defensivo (return false). |
| JSON v0.2 importado con condiciones de tipo desconocido (futuro backend añade nuevo tipo) | `_deserializeTransicion` preserva el `tipo` y `configuracion` tal cual. El panel muestra el chip con tipo desconocido en gris y "Tipo no soportado por este designer" como mensaje; no se rompe el round-trip. |

## Testing

### Unit / componente (vitest + @vue/test-utils)

Nuevos archivos:
- `tests/schema-v0_2-condiciones.test.js` — round-trip de condiciones (serialize → JSON → parse → deep equal), backward-compat con JSON sin `condiciones`, preservación de tipos desconocidos.
- `tests/store-bulk-replace-condiciones.test.js` — `bulkReplaceTransiciones` con payload incluyendo `condiciones` las persiste correctamente; payload sin `condiciones` para una transición las elimina; condiciones de tipo desconocido se preservan.
- `tests/store-crud-requisitos.test.js` — addRequisito/updateRequisito/removeRequisito, unicidad por (estado, tipo_documento), getRequisitosForEstado filtra correctamente.
- `tests/transition-panel-reglas.test.js` — render condicional cuando hay edge seleccionada, contadores correctos, eventos `condiciones-change` emitidos al añadir/borrar/reordenar, panel lee `getRequisitosForEstado(destino)`.
- `tests/condicion-form-dialog.test.js` — render por tipo (3 mini-forms), validación de form (JSON parseable, campos requeridos), evento `saved` emitido con la condición construida correctamente.
- `tests/requisito-form-dialog.test.js` — render del select de tipo_documento, validación de porcentaje (0-100), llamada al store action correcto, error de duplicado mostrado.

### Manual

- Abrir flujo existente que tenga condiciones (cargar JSON con condiciones desde sinpapel) → verificar que se ven en el panel de transición.
- Crear una condición de cada tipo desde el dialog, guardar, recargar la página → confirmar persistencia en localStorage.
- Exportar JSON v0.2 → comparar diff con JSON original; condiciones y requisitos preservados.
- Borrar una transición, recrear con mismo origen/destino → confirmar que condiciones se preservan (gracias a `bulkReplaceTransiciones`).

## Decisiones tomadas

- **D1**: Condiciones siempre AND lógico (backend ya impone esto; sin OR/NOT en v1).
- **D2**: Requisitos viven en el estado destino, mostrados contextualmente en panel de transición. Misma lista aparece en cualquier transición hacia el mismo destino.
- **D3**: Editor estructurado por tipo (`tipo` específico → form distinto) en vez de JSON crudo universal. Decidido con el usuario.
- **D4**: Condiciones viven en `edge.data.condiciones` durante edición y viajan en el payload de `bulkReplaceTransiciones`. Esto las alinea con el patrón existente de `grupos_ids` y respeta la intención del usuario cuando re-conecta o borra edges. Requisitos viven en `store.current.requisitos` y autosalvan (alineados con catálogos).
- **D5**: Validación profunda (JsonLogic correcto, path callable, ORM válido) queda en backend. Cliente sólo valida campos requeridos y JSON parseable.
- **D6**: Tipos de condición desconocidos se preservan en round-trip aunque el designer no los pueda editar (forward-compat con nuevos backends).
- **D7**: Identidad de requisito en JSON v0.2 es compuesta (`estado` + `tipo_documento`), porque el schema no tiene id. El store usa esa misma tupla como "id" lógico.

## Riesgos

- **Medio**: `bulkReplaceTransiciones` cambia signature del payload (ahora acepta `condiciones`). Tests deben cubrir: (a) save con condiciones presentes preserva la data; (b) save sin condiciones en una transición las borra (intencional, sigue al usuario); (c) save con condiciones de tipo desconocido las preserva tal cual.
- **Medio**: editor `django_orm` con pares libres (`field__lookup`) puede generar configs inválidas que el backend rechaza en runtime sin que el cliente lo sepa. Mitigación: documentar en hint que la validez se verifica en backend.
- **Bajo**: `WorkflowCanvasTransitionPanel` ya cumple su responsabilidad de panel; añadir 2 secciones extra puede engordarlo. Si pasa de ~250 líneas, considerar extraer `TransitionRulesSection.vue` como sub-componente — fuera de scope inicial pero apuntar en seguimiento.

## Componentes nuevos vs. modificados

**Nuevos:**
- `src/components/CondicionFormDialog.vue`
- `src/components/RequisitoFormDialog.vue`

**Modificados:**
- `src/data/schema-v0_2.js` (serialize/deserialize condiciones)
- `src/stores/workflow.js` (CRUD + bulkReplaceTransiciones)
- `src/components/WorkflowCanvasTransitionPanel.vue` (sección reglas)

**Sin cambios:**
- Backend sinpapel — nada.
- `src/data/catalogo-fields.js` — tipos_documento ya existe.
- `WorkflowCanvasPage.vue` — el panel recibe edge y store por props; los handlers son internos del panel y los dialogs.
