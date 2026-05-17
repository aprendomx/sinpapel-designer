# Reglas por Transición — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la brecha designer↔backend para reglas de transición: round-trip de `CondicionTransicion` (no más data loss) y CRUD UI tanto de condiciones (per-transición, edge-level) como de requisitos documentales (per-estado destino, catálogo-level).

**Architecture:** Condiciones viven en `edge.data.condiciones` durante edición (mismo patrón que `grupos_ids`) y se persisten al hacer "Guardar" del toolbar vía `bulkReplaceTransiciones`. Requisitos viven en `store.current.requisitos` y autosalvan vía `_markDirty`. El panel de transición agrega 2 secciones nuevas (condiciones + requisitos del destino) con sus respectivos diálogos modales. Editor estructurado por tipo de condición (`python_path` / `json_logic` / `django_orm`).

**Tech Stack:** Vue 3 `<script setup>`, Quasar, Pinia (`useWorkflowStore`), vitest + `@vue/test-utils` (jsdom), eslint flat config. Schema v0.2 cliente alineado con backend `sinpapel/schemas/flujo_export.py`.

**Spec:** `docs/superpowers/specs/2026-05-17-reglas-transicion-design.md`

---

## File Structure

**Modify:**
- `src/data/schema-v0_2.js` — `_serializeTransicion` / `_deserializeTransicion` añaden `condiciones`.
- `src/stores/workflow.js` — CRUD para requisitos, `bulkReplaceTransiciones` acepta `condiciones`.
- `src/components/WorkflowCanvasTransitionPanel.vue` — 2 secciones nuevas (condiciones, requisitos).
- `src/pages/WorkflowCanvasPage.vue` — pasa `condiciones` en payload de save, handler para `condiciones-change`.

**Create:**
- `src/components/CondicionFormDialog.vue` — form estructurado por tipo, emite `saved`.
- `src/components/RequisitoFormDialog.vue` — select tipo_documento + porcentaje + auto_carga, llama store.
- `tests/schema-v0_2-condiciones.test.js`
- `tests/store-bulk-replace-condiciones.test.js`
- `tests/store-crud-requisitos.test.js`
- `tests/transition-panel-reglas.test.js`
- `tests/condicion-form-dialog.test.js`
- `tests/requisito-form-dialog.test.js`

---

## Task 1: Schema v0.2 — Round-trip de condiciones

**Files:**
- Test: `tests/schema-v0_2-condiciones.test.js` (nuevo)
- Modify: `src/data/schema-v0_2.js:147-155` (`_serializeTransicion`) y `:221-234` (`_deserializeTransicion`)

- [ ] **Step 1.1: Crear test que falla**

Crear `tests/schema-v0_2-condiciones.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { serializeV0_2, parseV0_2 } from '../src/data/schema-v0_2.js'

describe('schema v0.2 — condiciones round-trip', () => {
  const baseState = {
    flujo: { id: 'f1', nombre: 'F1', descripcion: '', activo: false, metadatos: null },
    estados: [
      { id: 1, nombre: 'A', color: '#fff', icono: 'circle', descripcion: '', orden: 0, activo: true },
      { id: 2, nombre: 'B', color: '#fff', icono: 'circle', descripcion: '', orden: 1, activo: true },
    ],
    etapas: [],
    grupos: [],
    tipos_documento: [],
    requisitos: [],
  }

  it('serializa condiciones cuando una transición las tiene', () => {
    const state = {
      ...baseState,
      transiciones: [{
        id: 1,
        estado_origen: baseState.estados[0],
        estado_destino: baseState.estados[1],
        grupos_permitidos: [],
        condiciones: [
          { tipo: 'json_logic', configuracion: { rule: { '==': [1, 1] } }, mensaje_error: 'falla', orden: 0, activo: true },
        ],
      }],
    }
    const json = serializeV0_2(state)
    expect(json.flujo.transiciones[0].condiciones).toEqual([
      { tipo: 'json_logic', configuracion: { rule: { '==': [1, 1] } }, mensaje_error: 'falla', orden: 0, activo: true },
    ])
  })

  it('omite el campo condiciones cuando está vacío (paridad con backend)', () => {
    const state = {
      ...baseState,
      transiciones: [{
        id: 1,
        estado_origen: baseState.estados[0],
        estado_destino: baseState.estados[1],
        grupos_permitidos: [],
        condiciones: [],
      }],
    }
    const json = serializeV0_2(state)
    expect(json.flujo.transiciones[0]).not.toHaveProperty('condiciones')
  })

  it('parsea condiciones desde JSON v0.2 y default a [] si ausentes', () => {
    const json = {
      schema_version: '0.2',
      exported_at: '2026-05-17T00:00:00Z',
      catalogos: {
        estados: [
          { nombre: 'A', color: '#fff', icono: 'circle', descripcion: '', orden: 0, activo: true },
          { nombre: 'B', color: '#fff', icono: 'circle', descripcion: '', orden: 1, activo: true },
        ],
        etapas: [], grupos: [], tipos_documento: [],
      },
      flujo: {
        nombre: 'F1', descripcion: '', activo: false, metadatos: null,
        transiciones: [
          {
            estado_origen: 'A', estado_destino: 'B', grupos_permitidos: [],
            condiciones: [
              { tipo: 'python_path', configuracion: { path: 'mod.fn' }, mensaje_error: '', orden: 0, activo: true },
            ],
          },
          { estado_origen: 'B', estado_destino: 'A', grupos_permitidos: [] },
        ],
        requisitos: [],
      },
    }
    const parsed = parseV0_2(json)
    expect(parsed.transiciones[0].condiciones).toHaveLength(1)
    expect(parsed.transiciones[0].condiciones[0].tipo).toBe('python_path')
    expect(parsed.transiciones[1].condiciones).toEqual([])
  })

  it('preserva condiciones de tipo desconocido en round-trip', () => {
    const state = {
      ...baseState,
      transiciones: [{
        id: 1,
        estado_origen: baseState.estados[0],
        estado_destino: baseState.estados[1],
        grupos_permitidos: [],
        condiciones: [
          { tipo: 'futuro_tipo', configuracion: { foo: 'bar' }, mensaje_error: '', orden: 0, activo: true },
        ],
      }],
    }
    const json = serializeV0_2(state)
    const parsed = parseV0_2(json)
    expect(parsed.transiciones[0].condiciones[0].tipo).toBe('futuro_tipo')
    expect(parsed.transiciones[0].condiciones[0].configuracion).toEqual({ foo: 'bar' })
  })
})
```

- [ ] **Step 1.2: Correr test y verificar que falla**

```bash
npm test -- --run tests/schema-v0_2-condiciones.test.js
```

Expected: los 4 tests FAIL (schema actual no emite `condiciones` ni las preserva al parse).

- [ ] **Step 1.3: Modificar `_serializeTransicion`**

En `src/data/schema-v0_2.js`, reemplazar la función `_serializeTransicion` (alrededor de líneas 147-155):

```javascript
function _serializeTransicion(t) {
  const out = {
    estado_origen: t.estado_origen?.nombre || t.estado_origen,
    estado_destino: t.estado_destino?.nombre || t.estado_destino,
    grupos_permitidos: (t.grupos_permitidos || [])
      .map((g) => g.name || g)
      .sort(),
  }
  const condiciones = (t.condiciones || []).map((c) => ({
    tipo: c.tipo,
    configuracion: c.configuracion ?? {},
    mensaje_error: c.mensaje_error ?? '',
    orden: c.orden ?? 0,
    activo: c.activo ?? true,
  }))
  if (condiciones.length > 0) {
    out.condiciones = condiciones
  }
  return out
}
```

- [ ] **Step 1.4: Modificar `_deserializeTransicion`**

En `src/data/schema-v0_2.js`, reemplazar la función `_deserializeTransicion` (alrededor de líneas 221-234):

```javascript
function _deserializeTransicion(t, idx, estados, gruposJson) {
  const estadoLookup = Object.fromEntries(estados.map((e) => [e.nombre, e]))
  const grupoLookup = Object.fromEntries(
    gruposJson.map((g, i) => [g.name, { id: i + 1, name: g.name }])
  )
  return {
    id: idx + 1,
    estado_origen: estadoLookup[t.estado_origen] || { nombre: t.estado_origen },
    estado_destino: estadoLookup[t.estado_destino] || { nombre: t.estado_destino },
    grupos_permitidos: (t.grupos_permitidos || []).map(
      (name) => grupoLookup[name] || { id: 0, name }
    ),
    condiciones: (t.condiciones || []).map((c) => ({
      tipo: c.tipo,
      configuracion: c.configuracion ?? {},
      mensaje_error: c.mensaje_error ?? '',
      orden: c.orden ?? 0,
      activo: c.activo ?? true,
    })),
  }
}
```

- [ ] **Step 1.5: Correr test y verificar que pasa**

```bash
npm test -- --run tests/schema-v0_2-condiciones.test.js
```

Expected: 4 PASS.

- [ ] **Step 1.6: Correr suite completa + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos los tests previos siguen pasando (round-trip-v0_2.test.js es el más sensible — verificar que no cambió comportamiento para transiciones sin condiciones).

- [ ] **Step 1.7: Commit**

```bash
git add src/data/schema-v0_2.js tests/schema-v0_2-condiciones.test.js
git commit -m "$(cat <<'EOF'
feat(schema): round-trip de condiciones en transiciones v0.2

Sub-proyecto B paso 1: _serialize/_deserializeTransicion ahora
preservan el array condiciones. Omite el campo cuando está vacío
(paridad con sinpapel backend serializer). Tipos desconocidos se
preservan tal cual para forward-compat.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Store — CRUD requisitos por estado

**Files:**
- Test: `tests/store-crud-requisitos.test.js` (nuevo)
- Modify: `src/stores/workflow.js` (añadir acciones y helper, exportar)

- [ ] **Step 2.1: Crear test que falla**

Crear `tests/store-crud-requisitos.test.js`:

```javascript
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
```

- [ ] **Step 2.2: Correr test y verificar que falla**

```bash
npm test -- --run tests/store-crud-requisitos.test.js
```

Expected: 5 tests FAIL (las funciones no existen en el store).

- [ ] **Step 2.3: Añadir acciones al store**

En `src/stores/workflow.js`, después del bloque de helpers `_assertUniqueName` / `_addToCatalog` / etc. (alrededor de la sección "Reference helpers"), añadir:

```javascript
// ── S27.8 — CRUD requisitos por estado destino ───────────────────────

function _assertUniqueRequisito(estadoNombre, tipoDocNombre, exclude = false) {
  const dup = current.value.requisitos.some(
    (r) => r.estado === estadoNombre && r.tipo_documento === tipoDocNombre,
  )
  if (dup && !exclude) {
    throw new Error(
      `Requisito ya existe: ${tipoDocNombre} para estado ${estadoNombre}`,
    )
  }
}

function addRequisito(estadoNombre, data) {
  if (!current.value) return null
  _assertUniqueRequisito(estadoNombre, data.tipo_documento)
  const entry = {
    estado: estadoNombre,
    tipo_documento: data.tipo_documento,
    porcentaje: data.porcentaje ?? 100,
    auto_carga: data.auto_carga ?? false,
  }
  current.value.requisitos.push(entry)
  _markDirty()
  return entry
}

function updateRequisito(estadoNombre, tipoDocNombre, patch) {
  if (!current.value) return null
  const idx = current.value.requisitos.findIndex(
    (r) => r.estado === estadoNombre && r.tipo_documento === tipoDocNombre,
  )
  if (idx === -1) return null
  current.value.requisitos[idx] = {
    ...current.value.requisitos[idx],
    ...patch,
    estado: estadoNombre,
    tipo_documento: patch.tipo_documento ?? tipoDocNombre,
  }
  _markDirty()
  return current.value.requisitos[idx]
}

function removeRequisito(estadoNombre, tipoDocNombre) {
  if (!current.value) return false
  const before = current.value.requisitos.length
  current.value.requisitos = current.value.requisitos.filter(
    (r) => !(r.estado === estadoNombre && r.tipo_documento === tipoDocNombre),
  )
  const removed = current.value.requisitos.length < before
  if (removed) _markDirty()
  return removed
}

function getRequisitosForEstado(estadoNombre) {
  if (!current.value) return []
  return current.value.requisitos.filter((r) => r.estado === estadoNombre)
}
```

Luego, en el `return { ... }` final del defineStore (alrededor de línea 524), añadir las exports:

```javascript
return {
  // ... existing exports ...
  // S27.8 CRUD requisitos
  addRequisito, updateRequisito, removeRequisito, getRequisitosForEstado,
}
```

(Insertar la línea `addRequisito, updateRequisito, removeRequisito, getRequisitosForEstado,` justo después de la línea de `addTipoDocumento, updateTipoDocumento, removeTipoDocumento,`.)

- [ ] **Step 2.4: Correr test y verificar que pasa**

```bash
npm test -- --run tests/store-crud-requisitos.test.js
```

Expected: 5 PASS.

- [ ] **Step 2.5: Lint + suite completa**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan.

- [ ] **Step 2.6: Commit**

```bash
git add src/stores/workflow.js tests/store-crud-requisitos.test.js
git commit -m "$(cat <<'EOF'
feat(store): CRUD de requisitos documentales por estado

Sub-proyecto B paso 2: addRequisito/updateRequisito/removeRequisito
+ getRequisitosForEstado, unicidad por (estado, tipo_documento).
Mismo patrón _markDirty/autosave que los catálogos existentes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Store — `bulkReplaceTransiciones` acepta condiciones

**Files:**
- Test: `tests/store-bulk-replace-condiciones.test.js` (nuevo)
- Modify: `src/stores/workflow.js:149-161` (la función `bulkReplaceTransiciones`)

- [ ] **Step 3.1: Crear test que falla**

Crear `tests/store-bulk-replace-condiciones.test.js`:

```javascript
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

  it('asigna condiciones desde el payload', async () => {
    await store.bulkReplaceTransiciones('f1', [{
      estado_origen_id: 'eA',
      estado_destino_id: 'eB',
      grupos_ids: [1],
      condiciones: [
        { tipo: 'json_logic', configuracion: { rule: { '==': [1, 1] } }, mensaje_error: '', orden: 0, activo: true },
      ],
    }])
    expect(store.current.transiciones[0].condiciones).toHaveLength(1)
    expect(store.current.transiciones[0].condiciones[0].tipo).toBe('json_logic')
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
```

- [ ] **Step 3.2: Correr test y verificar que falla**

```bash
npm test -- --run tests/store-bulk-replace-condiciones.test.js
```

Expected: 3 tests FAIL (el `bulkReplaceTransiciones` actual no asigna `condiciones`).

- [ ] **Step 3.3: Modificar `bulkReplaceTransiciones`**

En `src/stores/workflow.js`, reemplazar la función `bulkReplaceTransiciones` (líneas 140-163) por:

```javascript
async function bulkReplaceTransiciones(id, transiciones) {
  if (!current.value || current.value.flujo.id !== id) {
    await getFlujo(id)
  }
  const estadoById = Object.fromEntries(
    current.value.estados.map((e) => [String(e.id), e]),
  )
  current.value.transiciones = transiciones.map((t, i) => ({
    id: i + 1,
    estado_origen: estadoById[String(t.estado_origen_id)] || {
      nombre: String(t.estado_origen_id),
    },
    estado_destino: estadoById[String(t.estado_destino_id)] || {
      nombre: String(t.estado_destino_id),
    },
    grupos_permitidos: (t.grupos_ids || []).map((gid) => {
      const g = current.value.grupos.find((x) => x.id === gid)
      return g || { id: gid, name: String(gid) }
    }),
    condiciones: (t.condiciones || []).map((c) => ({
      tipo: c.tipo,
      configuracion: c.configuracion ?? {},
      mensaje_error: c.mensaje_error ?? '',
      orden: c.orden ?? 0,
      activo: c.activo ?? true,
    })),
  }))
  _markDirty()
}
```

- [ ] **Step 3.4: Correr test y verificar que pasa**

```bash
npm test -- --run tests/store-bulk-replace-condiciones.test.js
```

Expected: 3 PASS.

- [ ] **Step 3.5: Suite completa + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan (incluyendo `workflow-store.test.js` que ya tenía cobertura de `bulkReplaceTransiciones`).

- [ ] **Step 3.6: Commit**

```bash
git add src/stores/workflow.js tests/store-bulk-replace-condiciones.test.js
git commit -m "$(cat <<'EOF'
feat(store): bulkReplaceTransiciones acepta condiciones en payload

Sub-proyecto B paso 3: el payload de saveChanges del canvas ahora
viaja con condiciones[] por transición (edge-level). El store las
asigna tal cual sin transformación. Tipos desconocidos se preservan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `CondicionFormDialog.vue` — editor estructurado por tipo

**Files:**
- Test: `tests/condicion-form-dialog.test.js` (nuevo)
- Create: `src/components/CondicionFormDialog.vue` (nuevo)

- [ ] **Step 4.1: Crear test que falla**

Crear `tests/condicion-form-dialog.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CondicionFormDialog from '../src/components/CondicionFormDialog.vue'

const COMMON_STUBS = {
  QDialog: { template: '<div><slot/></div>', props: ['modelValue'] },
  QCard: { template: '<div><slot/></div>' },
  QCardSection: { template: '<div><slot/></div>' },
  QForm: {
    template: '<form @submit.prevent="$emit(\'submit\', $event)"><slot/></form>',
    emits: ['submit'],
  },
  QInput: {
    template: '<input :data-field="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"/>',
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
  QSelect: {
    template: '<select :data-field="label" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
    props: ['modelValue', 'label', 'options'],
    emits: ['update:modelValue'],
  },
  QToggle: {
    template: '<input type="checkbox" :data-field="label" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)"/>',
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
  QBtn: {
    template: '<button :type="type" @click="$emit(\'click\')"><slot/></button>',
    props: ['type'],
    emits: ['click'],
  },
}

describe('CondicionFormDialog', () => {
  it('renderiza input "path" cuando tipo=python_path', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('python_path')
    await flushPromises()
    expect(wrapper.find('input[data-field="Python path"]').exists()).toBe(true)
  })

  it('renderiza textarea "rule_json" cuando tipo=json_logic', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('json_logic')
    await flushPromises()
    expect(wrapper.find('input[data-field="Regla JSON Logic"]').exists()).toBe(true)
  })

  it('renderiza pares key/value cuando tipo=django_orm', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('django_orm')
    await flushPromises()
    // Al menos un par key/value visible
    expect(wrapper.find('input[data-field="campo__lookup"]').exists()).toBe(true)
    expect(wrapper.find('input[data-field="valor"]').exists()).toBe(true)
  })

  it('emite "saved" con la condición construida para json_logic', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('json_logic')
    await flushPromises()
    await wrapper.find('input[data-field="Regla JSON Logic"]').setValue('{"==":[1,1]}')
    await wrapper.find('input[data-field="Mensaje de error"]').setValue('Falla')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const saved = wrapper.emitted('saved')
    expect(saved).toBeTruthy()
    expect(saved[0][0]).toMatchObject({
      tipo: 'json_logic',
      configuracion: { rule: { '==': [1, 1] } },
      mensaje_error: 'Falla',
      orden: 0,
      activo: true,
    })
  })

  it('muestra notify negativo y no emite "saved" si rule_json no parsea', async () => {
    const notify = vi.fn()
    const wrapper = mount(CondicionFormDialog, {
      props: { modelValue: true, editing: null, existing: [] },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('json_logic')
    await flushPromises()
    await wrapper.find('input[data-field="Regla JSON Logic"]').setValue('{invalid')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'negative' }))
    expect(wrapper.emitted('saved')).toBeFalsy()
  })

  it('calcula orden = existing.length para registros nuevos', async () => {
    const wrapper = mount(CondicionFormDialog, {
      props: {
        modelValue: true,
        editing: null,
        existing: [
          { tipo: 'python_path', configuracion: { path: 'a' }, mensaje_error: '', orden: 0, activo: true },
          { tipo: 'python_path', configuracion: { path: 'b' }, mensaje_error: '', orden: 1, activo: true },
        ],
      },
      global: { stubs: COMMON_STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('select[data-field="Tipo"]').setValue('python_path')
    await flushPromises()
    await wrapper.find('input[data-field="Python path"]').setValue('c.mod')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('saved')[0][0].orden).toBe(2)
  })
})
```

- [ ] **Step 4.2: Correr test y verificar que falla**

```bash
npm test -- --run tests/condicion-form-dialog.test.js
```

Expected: 6 tests FAIL (componente no existe).

- [ ] **Step 4.3: Crear `CondicionFormDialog.vue`**

Crear `src/components/CondicionFormDialog.vue`:

```vue
<template>
  <q-dialog v-model="open" persistent>
    <q-card style="min-width: 480px">
      <q-card-section>
        <div class="text-h6">{{ isEdit ? 'Editar' : 'Nueva' }} condición</div>
      </q-card-section>
      <q-card-section>
        <q-form @submit.prevent="onSave" class="q-gutter-sm">
          <q-select
            v-model="form.tipo"
            label="Tipo"
            :options="TIPO_OPTIONS"
            emit-value
            map-options
            dense
          />

          <!-- python_path -->
          <q-input
            v-if="form.tipo === 'python_path'"
            v-model="form.path"
            label="Python path"
            placeholder="modulo.submodulo.funcion"
            hint="Función con firma (instance, user) → (bool, str|None)"
            dense
          />

          <!-- json_logic -->
          <q-input
            v-else-if="form.tipo === 'json_logic'"
            v-model="form.rule_json"
            label="Regla JSON Logic"
            type="textarea"
            autogrow
            placeholder='{"==":[1,1]}'
            hint="Ver jsonlogic.com — JSON parseable, sin trailing commas"
            dense
          />

          <!-- django_orm -->
          <div v-else-if="form.tipo === 'django_orm'" class="column q-gutter-xs">
            <div class="text-caption">Lookup ORM (par campo__lookup → valor)</div>
            <div v-for="(pair, idx) in form.lookupPairs" :key="idx" class="row q-gutter-xs items-center">
              <q-input
                v-model="pair.key"
                label="campo__lookup"
                placeholder="monto__gte"
                dense
                style="flex: 1"
              />
              <q-input
                v-model="pair.value"
                label="valor"
                placeholder="100000"
                dense
                style="flex: 1"
              />
              <q-btn flat dense round icon="close" @click="removePair(idx)" />
            </div>
            <q-btn flat dense no-caps icon="add" label="Agregar par" @click="addPair" />
          </div>

          <q-input
            v-model="form.mensaje_error"
            label="Mensaje de error"
            placeholder="No cumple con las condiciones requeridas."
            dense
          />
          <q-toggle v-model="form.activo" label="Activo" />

          <div class="row q-gutter-sm justify-end">
            <q-btn flat label="Cancelar" v-close-popup />
            <q-btn color="primary" label="Guardar" type="submit" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

const TIPO_OPTIONS = [
  { label: 'Python path', value: 'python_path' },
  { label: 'JSON Logic', value: 'json_logic' },
  { label: 'Django ORM', value: 'django_orm' },
]

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  editing: { type: Object, default: null },
  existing: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const $q = useQuasar()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const isEdit = computed(() => !!props.editing)

const form = ref(emptyForm())

function emptyForm() {
  return {
    tipo: '',
    path: '',
    rule_json: '',
    lookupPairs: [{ key: '', value: '' }],
    mensaje_error: '',
    activo: true,
  }
}

watch(
  () => [props.modelValue, props.editing],
  ([modelValue, editing]) => {
    if (!modelValue) return
    if (editing) {
      const cfg = editing.configuracion || {}
      form.value = {
        tipo: editing.tipo,
        path: cfg.path ?? '',
        rule_json: cfg.rule != null ? JSON.stringify(cfg.rule, null, 2) : '',
        lookupPairs: cfg.lookup
          ? Object.entries(cfg.lookup).map(([k, v]) => ({ key: k, value: String(v) }))
          : [{ key: '', value: '' }],
        mensaje_error: editing.mensaje_error ?? '',
        activo: editing.activo ?? true,
      }
    } else {
      form.value = emptyForm()
    }
  },
  { immediate: true },
)

function addPair() {
  form.value.lookupPairs.push({ key: '', value: '' })
}

function removePair(idx) {
  form.value.lookupPairs.splice(idx, 1)
  if (form.value.lookupPairs.length === 0) addPair()
}

function buildConfiguracion() {
  if (form.value.tipo === 'python_path') {
    return { path: form.value.path }
  }
  if (form.value.tipo === 'json_logic') {
    return { rule: JSON.parse(form.value.rule_json) }
  }
  if (form.value.tipo === 'django_orm') {
    const lookup = {}
    for (const p of form.value.lookupPairs) {
      if (p.key) lookup[p.key] = p.value
    }
    return { lookup }
  }
  return {}
}

function onSave() {
  if (!form.value.tipo) return
  let configuracion
  try {
    configuracion = buildConfiguracion()
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: `JSON inválido: ${e.message}`,
      position: 'top',
    })
    return
  }
  const condicion = {
    tipo: form.value.tipo,
    configuracion,
    mensaje_error: form.value.mensaje_error,
    orden: props.editing?.orden ?? props.existing.length,
    activo: form.value.activo,
  }
  emit('saved', condicion)
  emit('update:modelValue', false)
}
</script>
```

- [ ] **Step 4.4: Correr test y verificar que pasa**

```bash
npm test -- --run tests/condicion-form-dialog.test.js
```

Expected: 6 PASS.

- [ ] **Step 4.5: Lint + suite completa**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan.

- [ ] **Step 4.6: Commit**

```bash
git add src/components/CondicionFormDialog.vue tests/condicion-form-dialog.test.js
git commit -m "$(cat <<'EOF'
feat(canvas): CondicionFormDialog con editor estructurado por tipo

Sub-proyecto B paso 4: dialog para crear/editar CondicionTransicion
con form distinto por tipo (python_path, json_logic, django_orm).
Emite 'saved' con el objeto condición construido; no toca el store
(las condiciones viven en edge.data y se persisten al Guardar).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `RequisitoFormDialog.vue` — select tipo_documento + porcentaje

**Files:**
- Test: `tests/requisito-form-dialog.test.js` (nuevo)
- Create: `src/components/RequisitoFormDialog.vue` (nuevo)

- [ ] **Step 5.1: Crear test que falla**

Crear `tests/requisito-form-dialog.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const COMMON_STUBS = {
  QDialog: { template: '<div><slot/></div>', props: ['modelValue'] },
  QCard: { template: '<div><slot/></div>' },
  QCardSection: { template: '<div><slot/></div>' },
  QForm: {
    template: '<form @submit.prevent="$emit(\'submit\', $event)"><slot/></form>',
    emits: ['submit'],
  },
  QInput: {
    template: '<input :data-field="label" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))"/>',
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
  QSelect: {
    template: '<select :data-field="label" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.value || o" :value="o.value || o">{{ o.label || o }}</option></select>',
    props: ['modelValue', 'label', 'options'],
    emits: ['update:modelValue'],
  },
  QToggle: {
    template: '<input type="checkbox" :data-field="label" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)"/>',
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
  QBtn: { template: '<button :type="type" @click="$emit(\'click\')"><slot/></button>', props: ['type'], emits: ['click'] },
}

describe('RequisitoFormDialog', () => {
  it('llama store.addRequisito al guardar (modo create)', async () => {
    const addRequisitoMock = vi.fn()
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({
        current: { tipos_documento: [{ id: 'tD', nombre: 'DNI' }] },
        addRequisito: addRequisitoMock,
        updateRequisito: vi.fn(),
      }),
    }))
    vi.doMock('quasar', async () => {
      const actual = await vi.importActual('quasar')
      return { ...actual, useQuasar: () => ({ notify: vi.fn() }) }
    })
    const { default: RequisitoFormDialog } = await import('../src/components/RequisitoFormDialog.vue')

    const wrapper = mount(RequisitoFormDialog, {
      props: { modelValue: true, editing: null, estadoNombre: 'A' },
      global: { stubs: COMMON_STUBS },
    })
    await wrapper.find('select[data-field="Tipo Documento"]').setValue('DNI')
    await wrapper.find('input[data-field="Porcentaje (0-100)"]').setValue('80')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(addRequisitoMock).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ tipo_documento: 'DNI', porcentaje: 80, auto_carga: false }),
    )
  })

  it('muestra notify negativo si store.addRequisito lanza', async () => {
    const notify = vi.fn()
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({
        current: { tipos_documento: [{ id: 'tD', nombre: 'DNI' }] },
        addRequisito: vi.fn(() => { throw new Error('Requisito ya existe') }),
        updateRequisito: vi.fn(),
      }),
    }))
    vi.doMock('quasar', async () => {
      const actual = await vi.importActual('quasar')
      return { ...actual, useQuasar: () => ({ notify }) }
    })
    const { default: RequisitoFormDialog } = await import('../src/components/RequisitoFormDialog.vue')

    const wrapper = mount(RequisitoFormDialog, {
      props: { modelValue: true, editing: null, estadoNombre: 'A' },
      global: { stubs: COMMON_STUBS },
    })
    await wrapper.find('select[data-field="Tipo Documento"]').setValue('DNI')
    await wrapper.find('input[data-field="Porcentaje (0-100)"]').setValue('100')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'negative' }))
    // No cierra
    const closeEmits = (wrapper.emitted('update:modelValue') || []).filter(a => a[0] === false)
    expect(closeEmits).toHaveLength(0)
  })

  it('llama updateRequisito en modo edit', async () => {
    const updateRequisitoMock = vi.fn()
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({
        current: { tipos_documento: [{ id: 'tD', nombre: 'DNI' }] },
        addRequisito: vi.fn(),
        updateRequisito: updateRequisitoMock,
      }),
    }))
    vi.doMock('quasar', async () => {
      const actual = await vi.importActual('quasar')
      return { ...actual, useQuasar: () => ({ notify: vi.fn() }) }
    })
    const { default: RequisitoFormDialog } = await import('../src/components/RequisitoFormDialog.vue')

    const wrapper = mount(RequisitoFormDialog, {
      props: {
        modelValue: true,
        editing: { estado: 'A', tipo_documento: 'DNI', porcentaje: 50, auto_carga: false },
        estadoNombre: 'A',
      },
      global: { stubs: COMMON_STUBS },
    })
    await wrapper.find('input[data-field="Porcentaje (0-100)"]').setValue('90')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(updateRequisitoMock).toHaveBeenCalledWith(
      'A',
      'DNI',
      expect.objectContaining({ porcentaje: 90 }),
    )
  })
})
```

- [ ] **Step 5.2: Correr test y verificar que falla**

```bash
npm test -- --run tests/requisito-form-dialog.test.js
```

Expected: 3 tests FAIL (componente no existe).

- [ ] **Step 5.3: Crear `RequisitoFormDialog.vue`**

Crear `src/components/RequisitoFormDialog.vue`:

```vue
<template>
  <q-dialog v-model="open" persistent>
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">{{ isEdit ? 'Editar' : 'Nuevo' }} requisito documental</div>
        <div class="text-caption text-grey-7">Estado destino: <strong>{{ estadoNombre }}</strong></div>
      </q-card-section>
      <q-card-section>
        <q-form @submit.prevent="onSave" class="q-gutter-sm">
          <q-select
            v-model="form.tipo_documento"
            label="Tipo Documento"
            :options="tipoDocOptions"
            emit-value
            map-options
            :disable="isEdit"
            dense
          />
          <q-input
            v-model.number="form.porcentaje"
            label="Porcentaje (0-100)"
            type="number"
            min="0"
            max="100"
            dense
          />
          <q-toggle v-model="form.auto_carga" label="Auto carga" />
          <div class="row q-gutter-sm justify-end">
            <q-btn flat label="Cancelar" v-close-popup />
            <q-btn color="primary" label="Guardar" type="submit" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkflowStore } from 'src/stores/workflow.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  editing: { type: Object, default: null },
  estadoNombre: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const store = useWorkflowStore()
const $q = useQuasar()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const isEdit = computed(() => !!props.editing)

const tipoDocOptions = computed(() =>
  (store.current?.tipos_documento || []).map((t) => ({ label: t.nombre, value: t.nombre })),
)

const form = ref({ tipo_documento: '', porcentaje: 100, auto_carga: false })

watch(
  () => [props.modelValue, props.editing],
  ([modelValue, editing]) => {
    if (!modelValue) return
    form.value = editing
      ? {
          tipo_documento: editing.tipo_documento,
          porcentaje: editing.porcentaje,
          auto_carga: editing.auto_carga,
        }
      : { tipo_documento: '', porcentaje: 100, auto_carga: false }
  },
  { immediate: true },
)

function onSave() {
  if (!form.value.tipo_documento) return
  const porcentaje = Math.max(0, Math.min(100, Number(form.value.porcentaje) || 0))
  try {
    if (isEdit.value) {
      store.updateRequisito(props.estadoNombre, props.editing.tipo_documento, {
        porcentaje,
        auto_carga: form.value.auto_carga,
      })
    } else {
      store.addRequisito(props.estadoNombre, {
        tipo_documento: form.value.tipo_documento,
        porcentaje,
        auto_carga: form.value.auto_carga,
      })
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e?.message || 'No se pudo guardar el requisito',
      position: 'top',
    })
  }
}
</script>
```

- [ ] **Step 5.4: Correr test y verificar que pasa**

```bash
npm test -- --run tests/requisito-form-dialog.test.js
```

Expected: 3 PASS.

- [ ] **Step 5.5: Lint + suite completa**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan.

- [ ] **Step 5.6: Commit**

```bash
git add src/components/RequisitoFormDialog.vue tests/requisito-form-dialog.test.js
git commit -m "$(cat <<'EOF'
feat(canvas): RequisitoFormDialog con select tipo_documento + porcentaje

Sub-proyecto B paso 5: dialog para crear/editar requisitos
documentales por estado destino. Llama directamente a
store.addRequisito/updateRequisito (autosave). Try/catch + notify
en errores (p.ej. duplicado por _assertUniqueRequisito).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `WorkflowCanvasTransitionPanel` — secciones de reglas

**Files:**
- Test: `tests/transition-panel-reglas.test.js` (nuevo)
- Modify: `src/components/WorkflowCanvasTransitionPanel.vue` (template + script + style)

- [ ] **Step 6.1: Crear test que falla**

Crear `tests/transition-panel-reglas.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const STUBS = {
  QIcon: true,
  QSelect: true,
  QChip: { template: '<span class="q-chip"><slot/></span>' },
  QBtn: { template: '<button :aria-label="$attrs[`aria-label`]" @click="$emit(\'click\')"><slot/></button>', inheritAttrs: false, emits: ['click'] },
  QToggle: true,
  CondicionFormDialog: {
    template: '<div data-testid="cond-dialog" v-if="modelValue"/>',
    props: ['modelValue', 'editing', 'existing'],
    emits: ['update:modelValue', 'saved'],
  },
  RequisitoFormDialog: {
    template: '<div data-testid="req-dialog" v-if="modelValue"/>',
    props: ['modelValue', 'editing', 'estadoNombre'],
    emits: ['update:modelValue', 'saved'],
  },
}

const makeEdge = (overrides = {}) => ({
  id: 'transicion-1',
  source: '1',
  target: '2',
  data: {
    origen_nombre: 'A',
    destino_nombre: 'B',
    grupos_ids: [],
    condiciones: [],
    ...overrides,
  },
})

describe('WorkflowCanvasTransitionPanel — reglas', () => {
  it('no renderiza secciones de reglas si no hay edge seleccionada', async () => {
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ current: null, getRequisitosForEstado: () => [] }),
    }))
    const { default: Panel } = await import('../src/components/WorkflowCanvasTransitionPanel.vue')
    const wrapper = mount(Panel, {
      props: { selectedEdge: null, gruposOptions: [], editMode: true },
      global: { stubs: STUBS },
    })
    expect(wrapper.find('[data-testid="condiciones-section"]').exists()).toBe(false)
  })

  it('renderiza sección condiciones con count cuando hay edge', async () => {
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ current: { tipos_documento: [] }, getRequisitosForEstado: () => [] }),
    }))
    const { default: Panel } = await import('../src/components/WorkflowCanvasTransitionPanel.vue')
    const edge = makeEdge({
      condiciones: [
        { tipo: 'python_path', configuracion: { path: 'a' }, mensaje_error: '', orden: 0, activo: true },
      ],
    })
    const wrapper = mount(Panel, {
      props: { selectedEdge: edge, gruposOptions: [], editMode: true },
      global: { stubs: STUBS },
    })
    const section = wrapper.find('[data-testid="condiciones-section"]')
    expect(section.exists()).toBe(true)
    expect(section.text()).toContain('1')
  })

  it('emite condiciones-change al añadir una condición via dialog', async () => {
    vi.resetModules()
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ current: { tipos_documento: [] }, getRequisitosForEstado: () => [] }),
    }))
    const { default: Panel } = await import('../src/components/WorkflowCanvasTransitionPanel.vue')
    const edge = makeEdge()
    const wrapper = mount(Panel, {
      props: { selectedEdge: edge, gruposOptions: [], editMode: true },
      global: { stubs: STUBS },
    })
    await wrapper.find('button[aria-label="Agregar condición"]').trigger('click')
    await flushPromises()
    // Dialog visible
    expect(wrapper.find('[data-testid="cond-dialog"]').exists()).toBe(true)
    // Simular saved del dialog stub
    const newCond = { tipo: 'python_path', configuracion: { path: 'x' }, mensaje_error: '', orden: 0, activo: true }
    wrapper.findComponent({ name: 'CondicionFormDialog' }).vm.$emit('saved', newCond)
    await flushPromises()
    const emitted = wrapper.emitted('condiciones-change')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toEqual([newCond])
  })

  it('lee requisitos del estado destino vía getRequisitosForEstado', async () => {
    vi.resetModules()
    const getMock = vi.fn().mockReturnValue([
      { estado: 'B', tipo_documento: 'DNI', porcentaje: 100, auto_carga: false },
    ])
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ current: { tipos_documento: [] }, getRequisitosForEstado: getMock }),
    }))
    const { default: Panel } = await import('../src/components/WorkflowCanvasTransitionPanel.vue')
    const edge = makeEdge()
    const wrapper = mount(Panel, {
      props: { selectedEdge: edge, gruposOptions: [], editMode: true },
      global: { stubs: STUBS },
    })
    await flushPromises()
    expect(getMock).toHaveBeenCalledWith('B')
    expect(wrapper.text()).toContain('DNI')
  })
})
```

- [ ] **Step 6.2: Correr test y verificar que falla**

```bash
npm test -- --run tests/transition-panel-reglas.test.js
```

Expected: 4 tests FAIL (panel actual no tiene secciones de reglas).

- [ ] **Step 6.3: Modificar `WorkflowCanvasTransitionPanel.vue`**

Reemplazar el contenido completo de `src/components/WorkflowCanvasTransitionPanel.vue` por:

```vue
<template>
  <transition name="panel-slide">
    <div v-if="editMode && selectedEdge" class="wf-canvas-page__panel">
      <div class="wf-panel__header">
        <q-icon name="swap_horiz" size="16px" />
        <span>Transición</span>
      </div>

      <div class="wf-panel__route">
        <span class="wf-panel__state-tag">{{ selectedEdge.data?.origen_nombre }}</span>
        <q-icon name="arrow_forward" size="12px" style="color: var(--sp-secondary); flex-shrink:0" />
        <span class="wf-panel__state-tag">{{ selectedEdge.data?.destino_nombre }}</span>
      </div>

      <div class="wf-panel__divider"></div>

      <div class="wf-panel__field-label">Grupos permitidos</div>
      <p class="wf-panel__field-hint">Vacío = cualquier usuario puede ejecutarla</p>
      <q-select
        v-model="localGrupos"
        :options="gruposOptions"
        option-value="id"
        option-label="name"
        multiple
        use-chips
        dense
        outlined
        emit-value
        map-options
        class="q-mt-xs"
        @update:model-value="$emit('grupos-change', $event)"
      />

      <div class="wf-panel__divider"></div>

      <!-- Sección Condiciones -->
      <div class="wf-panel__section-header" data-testid="condiciones-section">
        <span class="wf-panel__field-label">Condiciones</span>
        <q-chip dense square size="10px">{{ condiciones.length }}</q-chip>
        <q-btn
          flat dense round
          icon="add"
          size="sm"
          aria-label="Agregar condición"
          @click="openCondicionDialog(null)"
        />
      </div>
      <div v-if="condiciones.length === 0" class="wf-panel__empty">
        Sin condiciones. La transición sólo verifica grupos.
      </div>
      <div v-else class="wf-panel__list">
        <div
          v-for="(c, idx) in condiciones"
          :key="idx"
          class="wf-panel__row"
          @click="openCondicionDialog(c, idx)"
        >
          <q-chip dense square :class="`wf-panel__tipo-${c.tipo}`">{{ c.tipo }}</q-chip>
          <span class="wf-panel__row-text">{{ c.mensaje_error || '(sin mensaje)' }}</span>
          <q-toggle
            :model-value="c.activo"
            size="xs"
            @update:model-value="(v) => toggleCondicion(idx, v)"
            @click.stop
          />
          <q-btn flat dense round icon="close" size="xs" @click.stop="removeCondicion(idx)" />
        </div>
      </div>

      <div class="wf-panel__divider"></div>

      <!-- Sección Requisitos -->
      <div class="wf-panel__section-header">
        <span class="wf-panel__field-label">Documentos requeridos al llegar a {{ selectedEdge.data?.destino_nombre }}</span>
        <q-chip dense square size="10px">{{ requisitos.length }}</q-chip>
        <q-btn
          flat dense round
          icon="add"
          size="sm"
          aria-label="Agregar requisito"
          @click="openRequisitoDialog(null)"
        />
      </div>
      <div v-if="requisitos.length === 0" class="wf-panel__empty">
        Sin requisitos documentales para entrar a {{ selectedEdge.data?.destino_nombre }}.
      </div>
      <div v-else class="wf-panel__list">
        <div
          v-for="r in requisitos"
          :key="r.tipo_documento"
          class="wf-panel__row"
          @click="openRequisitoDialog(r)"
        >
          <q-chip dense square>{{ r.tipo_documento }}</q-chip>
          <span class="wf-panel__row-text">{{ r.porcentaje }}%{{ r.auto_carga ? ' · auto' : '' }}</span>
        </div>
      </div>

      <div class="wf-panel__divider"></div>

      <button class="wf-panel__delete-btn" @click="$emit('delete-edge', selectedEdge)">
        <q-icon name="delete_outline" size="15px" />
        Eliminar transición
      </button>

      <CondicionFormDialog
        v-model="condDialogOpen"
        :editing="condEditing"
        :existing="condiciones"
        @saved="onCondicionSaved"
      />
      <RequisitoFormDialog
        v-if="selectedEdge"
        v-model="reqDialogOpen"
        :editing="reqEditing"
        :estado-nombre="selectedEdge.data?.destino_nombre"
        @saved="onRequisitoSaved"
      />
    </div>
  </transition>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useWorkflowStore } from 'src/stores/workflow.js'
import CondicionFormDialog from 'src/components/CondicionFormDialog.vue'
import RequisitoFormDialog from 'src/components/RequisitoFormDialog.vue'

const props = defineProps({
  selectedEdge: { type: Object, default: null },
  gruposOptions: { type: Array, default: () => [] },
  editMode: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:selected-edge-grupos',
  'grupos-change',
  'delete-edge',
  'condiciones-change',
])

const store = useWorkflowStore()

const localGrupos = computed({
  get: () => props.selectedEdge?.data?.grupos_ids ?? [],
  set: (val) => emit('update:selected-edge-grupos', val),
})

const condiciones = computed(() => props.selectedEdge?.data?.condiciones ?? [])

const requisitos = computed(() => {
  const destino = props.selectedEdge?.data?.destino_nombre
  if (!destino) return []
  return store.getRequisitosForEstado(destino)
})

// ── Dialog state ───────────────────────────────────────────────
const condDialogOpen = ref(false)
const condEditing = ref(null)
const condEditingIdx = ref(-1)

function openCondicionDialog(c, idx = -1) {
  condEditing.value = c
  condEditingIdx.value = idx
  condDialogOpen.value = true
}

function onCondicionSaved(condicion) {
  const next = [...condiciones.value]
  if (condEditingIdx.value >= 0) {
    next[condEditingIdx.value] = condicion
  } else {
    next.push(condicion)
  }
  emit('condiciones-change', next)
}

function removeCondicion(idx) {
  const next = condiciones.value.filter((_, i) => i !== idx)
  emit('condiciones-change', next)
}

function toggleCondicion(idx, value) {
  const next = condiciones.value.map((c, i) => (i === idx ? { ...c, activo: value } : c))
  emit('condiciones-change', next)
}

const reqDialogOpen = ref(false)
const reqEditing = ref(null)

function openRequisitoDialog(r) {
  reqEditing.value = r
  reqDialogOpen.value = true
}

function onRequisitoSaved() {
  // El store ya autosalva; nada que propagar.
}
</script>

<style scoped>
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: width 0.22s ease, opacity 0.18s ease;
  overflow: hidden;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  width: 0;
  opacity: 0;
}

.wf-canvas-page__panel {
  width: 280px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid var(--sp-border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.wf-panel__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 16px 10px;
  font-family: 'Cabin', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #fff;
  background: var(--sp-primary);
  flex-shrink: 0;
}

.wf-panel__route {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 16px 0;
  flex-wrap: wrap;
}

.wf-panel__state-tag {
  background: var(--sp-bg-light);
  border: 1px solid #e0d5cc;
  border-radius: 4px;
  padding: 3px 10px;
  font-family: 'Cabin', sans-serif;
  font-size: 11px;
  font-weight: 700;
  color: var(--sp-text);
}

.wf-panel__divider {
  height: 1px;
  background: #e8e0d8;
  margin: 12px 16px;
  flex-shrink: 0;
}

.wf-panel__field-label {
  font-family: 'Cabin', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--sp-text-secondary);
  flex: 1;
}

.wf-panel__field-hint {
  font-size: 11px;
  color: var(--sp-text-placeholder);
  padding: 2px 16px 0;
  margin: 0;
  line-height: 1.4;
  flex-shrink: 0;
}

.wf-panel__section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
}

.wf-panel__empty {
  font-size: 11px;
  color: #aaa;
  padding: 4px 16px 0;
  font-style: italic;
}

.wf-panel__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 12px 0;
}

.wf-panel__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.wf-panel__row:hover {
  background: #faf5ef;
}

.wf-panel__row-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #6b5e56;
}

.wf-panel__tipo-python_path { background: #ede1f3 !important; color: #6b3fa0 !important; }
.wf-panel__tipo-json_logic { background: #fff3e0 !important; color: #a36b00 !important; }
.wf-panel__tipo-django_orm { background: #e3edf7 !important; color: #2a5a8a !important; }

:deep(.wf-canvas-page__panel .q-select) {
  margin: 6px 16px 0;
}

.wf-panel__delete-btn {
  margin: 4px 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid #f5d5de;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Cabin', sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: var(--sp-primary);
  padding: 8px 12px;
  transition: background 0.12s;
  flex-shrink: 0;
}

.wf-panel__delete-btn:hover {
  background: #fdf0f4;
}
</style>
```

- [ ] **Step 6.4: Correr test y verificar que pasa**

```bash
npm test -- --run tests/transition-panel-reglas.test.js
```

Expected: 4 PASS.

- [ ] **Step 6.5: Suite completa + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan. `workflow-canvas.test.js` puede generar warns nuevos por componentes no stubbed — añadirles `CondicionFormDialog: true` y `RequisitoFormDialog: true` en sus stubs si aparecen como `[Vue warn]` que no estaban antes (no romperá el test mientras tanto).

- [ ] **Step 6.6: Commit**

```bash
git add src/components/WorkflowCanvasTransitionPanel.vue tests/transition-panel-reglas.test.js
git commit -m "$(cat <<'EOF'
feat(canvas): secciones de condiciones y requisitos en panel transición

Sub-proyecto B paso 6: el panel de transición ahora muestra y
permite editar condiciones (edge-level, emite condiciones-change)
y requisitos del estado destino (catálogo-level, vía store).
Reusa CondicionFormDialog y RequisitoFormDialog.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `WorkflowCanvasPage` — propagar condiciones al save

**Files:**
- Modify: `src/pages/WorkflowCanvasPage.vue` (template del panel + handler + saveChanges + loadFlujo)

- [ ] **Step 7.1: Añadir condiciones al edge data en `loadFlujo`**

En `src/pages/WorkflowCanvasPage.vue`, dentro de la función `loadFlujo`, encontrar el bloque que construye `edges.value` (líneas ~228-240). Reemplazar por:

```javascript
edges.value = transiciones.map((t) => ({
  id: `transicion-${t.id}`,
  source: String(t.estado_origen.id),
  target: String(t.estado_destino.id),
  label: t.grupos_permitidos.length
    ? t.grupos_permitidos.map((g) => g.name).join(' / ')
    : 'Sin restricción',
  markerEnd: MarkerType.ArrowClosed,
  style: { stroke: '#a57f2c' },
  labelStyle: { fontSize: '11px', fill: '#666' },
  labelBgStyle: { fill: '#fdfbf6', fillOpacity: 0.9 },
  data: {
    grupos_ids: t.grupos_permitidos.map((g) => g.id),
    origen_nombre: t.estado_origen.nombre,
    destino_nombre: t.estado_destino.nombre,
    condiciones: t.condiciones || [],
  },
}))
```

(El único cambio es añadir `condiciones: t.condiciones || []` al `data`.)

- [ ] **Step 7.2: Añadir handler `onCondicionesChange` y wireup en template**

En `src/pages/WorkflowCanvasPage.vue`, añadir esta función junto a `onEdgeGruposChange` (alrededor de línea 349):

```javascript
function onCondicionesChange(nuevasCondiciones) {
  if (!selectedEdge.value) return
  edges.value = edges.value.map((e) => {
    if (e.id !== selectedEdge.value.id) return e
    return {
      ...e,
      data: { ...e.data, condiciones: nuevasCondiciones },
    }
  })
  selectedEdge.value = edges.value.find((e) => e.id === selectedEdge.value?.id) ?? null
  isDirty.value = true
}
```

En el template, en el `<WorkflowCanvasTransitionPanel>` (alrededor de línea 91-97), añadir el handler:

```vue
<WorkflowCanvasTransitionPanel
  :selected-edge="selectedEdge"
  :grupos-options="gruposOptions"
  :edit-mode="editMode"
  @grupos-change="onEdgeGruposChange"
  @condiciones-change="onCondicionesChange"
  @delete-edge="eliminarEdge"
/>
```

- [ ] **Step 7.3: Incluir `condiciones` en el payload de `saveChanges`**

En `src/pages/WorkflowCanvasPage.vue`, encontrar la construcción de `transiciones` dentro de `saveChanges` (alrededor de líneas 381-386). Reemplazar por:

```javascript
const transiciones = edges.value.map(e => ({
  estado_origen_id: parseInt(e.source),
  estado_destino_id: parseInt(e.target),
  grupos_ids: e.data?.grupos_ids ?? [],
  condiciones: e.data?.condiciones ?? [],
}))
```

(El único cambio es añadir `condiciones: e.data?.condiciones ?? []`.)

- [ ] **Step 7.4: Actualizar mock del store en `tests/workflow-canvas.test.js`**

El panel ahora hace `store.getRequisitosForEstado(destino)` al mount. El mock actual en `tests/workflow-canvas.test.js` (líneas 24-40) NO incluye ese método. Añadirlo y stubbear los nuevos componentes. Reemplazar el bloque `vi.mock('src/stores/workflow.js', ...)` por:

```javascript
vi.mock('src/stores/workflow.js', () => ({
  useWorkflowStore: () => ({
    current: null,
    isDirty: false,
    getFlujo: vi.fn().mockResolvedValue({
      id: 1, nombre: 'Test Flujo', descripcion: '', activo: true,
      metadatos: { positions: {} },
    }),
    getFlujoTransiciones: vi.fn().mockResolvedValue([]),
    getGrupos: vi.fn().mockResolvedValue([]),
    getEstatuses: vi.fn().mockResolvedValue([]),
    getRequisitosForEstado: vi.fn().mockReturnValue([]),
    bulkReplaceTransiciones: vi.fn(),
    saveLayout: vi.fn(),
    exportToFile: vi.fn(),
    discard: vi.fn(),
  }),
}))
```

(El único cambio es añadir la línea `getRequisitosForEstado: vi.fn().mockReturnValue([]),`.)

Luego, en el bloque `global.stubs` del `mount(WorkflowCanvasPage, ...)` (línea 48), añadir:

```javascript
CondicionFormDialog: true,
RequisitoFormDialog: true,
```

junto a los demás stubs.

- [ ] **Step 7.5: Correr suite completa + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos los 60+ tests pasan, lint clean. Sin nuevos warns en `workflow-canvas.test.js`.

- [ ] **Step 7.6: Commit**

```bash
git add src/pages/WorkflowCanvasPage.vue tests/workflow-canvas.test.js
git commit -m "$(cat <<'EOF'
feat(canvas): propagar condiciones edge.data ↔ saveChanges payload

Sub-proyecto B paso 7: loadFlujo lee condiciones del store y las
expone en edge.data.condiciones. onCondicionesChange muta el edge
y marca isDirty. saveChanges incluye condiciones en el payload de
bulkReplaceTransiciones. Mock del store en workflow-canvas.test.js
actualizado con getRequisitosForEstado.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verificación end-to-end + push

- [ ] **Step 8.1: Arrancar dev server**

```bash
npm run dev
```

Abrir browser en la URL que muestra la terminal.

- [ ] **Step 8.2: Recorrer el flujo dorado completo**

1. Abrir un flujo existente o crear uno.
2. Activar Edit, crear 2 estados (A, B) y conectarlos A→B.
3. Seleccionar el edge A→B → confirmar que aparece el panel con:
   - Grupos permitidos (vacío).
   - Sección Condiciones (count 0, botón "+", empty state).
   - Sección Documentos requeridos al llegar a B (count 0, botón "+", empty state).
4. Clic "+" en Condiciones → abre `CondicionFormDialog`.
5. Elegir tipo `json_logic` → llenar `{"==":[1,1]}` y mensaje "Falla rule" → Guardar → aparece chip ámbar en la lista.
6. Clic "+" en Documentos requeridos → abre `RequisitoFormDialog`.
7. Elegir tipo_documento (precrear uno en CatalogosPage si no hay) + porcentaje 80% → Guardar → aparece en la lista.
8. Clic "Guardar" en el toolbar → confirmar notify positivo.
9. Recargar la página (F5) → reabrir el flujo → confirmar que tanto la condición como el requisito persisten.

- [ ] **Step 8.3: Verificar round-trip JSON**

1. Tras el guardado, descargar el JSON (`exportToFile` lo hace automáticamente al Guardar).
2. Abrir el JSON descargado en un editor → confirmar:
   - `flujo.transiciones[0].condiciones` con el objeto json_logic.
   - `flujo.requisitos[0]` con el tipo_documento y porcentaje.
3. Borrar el flujo del localStorage, importar el JSON descargado → confirmar que panel muestra las mismas reglas.

- [ ] **Step 8.4: Recorrer caso de error**

1. Crear una condición tipo `json_logic` con JSON inválido `{invalid` → confirmar notify negativo y dialog abierto.
2. Crear un requisito con el mismo tipo_documento dos veces → confirmar notify "Requisito ya existe" y dialog abierto.

- [ ] **Step 8.5: Push**

```bash
git push
```

Expected: 7 commits pusheados a `origin/develop`.
