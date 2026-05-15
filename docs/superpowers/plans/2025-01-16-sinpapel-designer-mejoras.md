# Sinpapel Designer — Mejoras Post-Análisis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar las 9 recomendaciones inmediatas y corto plazo identificadas en el análisis del codebase.

**Architecture:** Refactor progresivo con TDD: fix bugs críticos → extracción de utilidades → normalización de temas → refactor de componentes grandes → validaciones de seguridad.

**Tech Stack:** Vue 3 + Quasar + Pinia + Vitest + jsdom

---

## File Structure

| File | Responsibility |
|------|--------------|
| `src/utils/hash-id.js` | `_hashId` compartido entre store y schema |
| `src/css/theme.scss` | Variables CSS del tema Sinpapel |
| `src/components/WorkflowCanvasToolbar.vue` | Header del canvas (back, título, badge, toolbar) |
| `src/components/WorkflowCanvasStatesPanel.vue` | Sidebar izquierdo de estados disponibles |
| `src/components/WorkflowCanvasTransitionPanel.vue` | Panel derecho de edición de transición |
| `src/utils/sanitize.js` | Sanitización de JSON importado |
| `src/stores/workflow.js` | Store Pinia (monolítico, se reduce con extracciones) |
| `src/pages/WorkflowCanvasPage.vue` | Page contenedora del canvas |
| `src/pages/WorkflowListPage.vue` | Page de listado |
| `tests/` | Suite de tests existente |

---

### Task 1: Fix routing name inconsistente

**Files:**
- Modify: `src/pages/WorkflowCanvasPage.vue:7`

**Bug:** `router.push({ name: 'designer-workflows' })` usa un nombre de ruta inexistente.

- [ ] **Step 1: Cambiar a nombre de ruta correcto**
  ```vue
  <button class="wf-canvas-page__back" @click="router.push({ name: 'workflows' })">
  ```
- [ ] **Step 2: Verificar routes.js**
  `src/router/routes.js:7` define `{ path: 'workflows', name: 'workflows', ... }`
- [ ] **Step 3: Commit**
  ```bash
  git add src/pages/WorkflowCanvasPage.vue
  git commit -m "fix(canvas): corregir nombre de ruta 'designer-workflows' → 'workflows'"
  ```

---

### Task 2: Unificar isDirty entre store y componente

**Files:**
- Modify: `src/pages/WorkflowCanvasPage.vue`
- Modify: `src/stores/workflow.js`

**Problem:** `WorkflowCanvasPage.vue` define `const isDirty = ref(false)` local que shadowea `store.isDirty`. El autosave del store usa `watch(store.isDirty, ...)` pero el componente nunca lo toca.

- [ ] **Step 1: Eliminar `isDirty` local del componente**
  Remover: `const isDirty = ref(false)` y todas sus asignaciones directas.
- [ ] **Step 2: Usar `store.isDirty` en el template**
  Cambiar `v-if="editMode && isDirty"` → `v-if="editMode && store.isDirty"`
  Cambiar `@click="discardChanges"` → llama a `store.discard()`
  Cambiar `@click="saveChanges"` → llama a `store.saveChanges(...)` o mantiene lógica pero usa `store.isDirty = true`
- [ ] **Step 3: Ajustar `saveChanges` y `discardChanges`**
  `saveChanges` debe setear `store.isDirty = false` al final (ya lo hace el store internamente? Verificar). `discardChanges` llama `store.discard()`.
- [ ] **Step 4: Test**
  ```bash
  npm test
  ```
- [ ] **Step 5: Commit**

---

### Task 3: Extraer `_hashId` a utilidad compartida

**Files:**
- Create: `src/utils/hash-id.js`
- Modify: `src/stores/workflow.js`
- Modify: `src/data/schema-v0_2.js`

- [ ] **Step 1: Crear utilidad**
  ```js
  // src/utils/hash-id.js
  export function hashId(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
    }
    return Math.abs(hash).toString()
  }
  ```
- [ ] **Step 2: Reemplazar en workflow.js**
  Importar `{ hashId }` y reemplazar `_hashId` por `hashId`. Eliminar definición local.
- [ ] **Step 3: Reemplazar en schema-v0_2.js**
  Importar `{ hashId }` y reemplazar `_hashId` por `hashId`. Eliminar definición local.
- [ ] **Step 4: Test**
  ```bash
  npm test
  ```
- [ ] **Step 5: Commit**

---

### Task 4: Definir variables CSS del tema

**Files:**
- Create: `src/css/theme.scss`
- Modify: `src/css/app.scss`
- Modify: `src/pages/WorkflowCanvasPage.vue`
- Modify: `src/pages/WorkflowListPage.vue`
- Modify: `src/layouts/MainLayout.vue`
- Modify: `src/components/EstadoNode.vue`
- Modify: `src/pages/CatalogosPage.vue`

- [ ] **Step 1: Crear theme.scss**
  ```scss
  :root {
    --sp-primary: #9b2247;
    --sp-primary-dark: #7a1836;
    --sp-secondary: #a57f2c;
    --sp-success: #1e5b4f;
    --sp-accent: #4DEFE2;
    --sp-warn: #f08217;
    --sp-bg: #f2ece5;
    --sp-bg-light: #faf5ef;
    --sp-text: #1e0c14;
    --sp-text-muted: #9a8e87;
    --sp-border: #e6ddd4;
  }
  ```
- [ ] **Step 2: Importar en app.scss**
  ```scss
  @import 'theme.scss';
  ```
- [ ] **Step 3: Refactor progresivo de colores hardcodeados**
  Reemplazar `#9b2247` → `var(--sp-primary)` en los archivos principales. Hacerlo por archivo para facilitar review.
- [ ] **Step 4: Test visual**
  ```bash
  npm run dev
  ```
  Verificar que colores se mantienen.
- [ ] **Step 5: Commit**

---

### Task 5: Sanitizar `loadFromFile` contra prototype pollution

**Files:**
- Create: `src/utils/sanitize.js`
- Modify: `src/stores/workflow.js`

- [ ] **Step 1: Crear `sanitizeJsonInput`**
  ```js
  export function sanitizeJsonInput(obj) {
    if (obj === null || typeof obj !== 'object') return obj
    const safe = Array.isArray(obj) ? [] : {}
    for (const [key, value] of Object.entries(obj)) {
      if (key === '__proto__' || key === 'constructor') continue
      safe[key] = sanitizeJsonInput(value)
    }
    return safe
  }
  ```
- [ ] **Step 2: Usar en `loadFromFile`**
  ```js
  const json = sanitizeJsonInput(JSON.parse(text))
  ```
- [ ] **Step 3: Agregar test**
  ```js
  it('loadFromFile rejects prototype pollution', async () => {
    const store = useWorkflowStore()
    const malicious = {
      text: async () => JSON.stringify({
        schema_version: '0.2',
        flujo: { nombre: 'X', '__proto__': { evil: true } },
      }),
    }
    await store.loadFromFile(malicious)
    expect(Object.prototype.evil).toBeUndefined()
  })
  ```
- [ ] **Step 4: Test**
  ```bash
  npm test
  ```
- [ ] **Step 5: Commit**

---

### Task 6: Refactor WorkflowCanvasPage en subcomponentes

**Files:**
- Create: `src/components/WorkflowCanvasToolbar.vue`
- Create: `src/components/WorkflowCanvasStatesPanel.vue`
- Create: `src/components/WorkflowCanvasTransitionPanel.vue`
- Modify: `src/pages/WorkflowCanvasPage.vue`

**Goal:** Reducir `WorkflowCanvasPage.vue` de 1033 a <400 líneas.

- [ ] **Step 1: Extraer Toolbar**
  Props: `flujo`, `editMode`, `isDirty`, `saving`
  Emits: `toggle-edit`, `discard`, `save`
- [ ] **Step 2: Extraer StatesPanel**
  Props: `estados`, `filtro`, `idsEnCanvas`, `editMode`
  Emits: `drag-start`
- [ ] **Step 3: Extraer TransitionPanel**
  Props: `selectedEdge`, `gruposOptions`, `editMode`
  Emits: `grupos-change`, `delete-edge`
- [ ] **Step 4: Simplificar page**
  Importar los 3 componentes y conectar con v-model / emits.
- [ ] **Step 5: Test**
  ```bash
  npm test
  ```
- [ ] **Step 6: Commit**

---

### Task 7: Validación de duplicados en CRUD de catálogos

**Files:**
- Modify: `src/stores/workflow.js`

- [ ] **Step 1: Agregar `_assertUniqueName` helper**
  ```js
  function _assertUniqueName(kind, name) {
    const { key, nameField } = CATALOG_KEYS[kind]
    const exists = current.value[key].some(e => e[nameField] === name)
    if (exists) throw new Error(`${kind} con ${nameField}='${name}' ya existe`)
  }
  ```
- [ ] **Step 2: Usar en `_addToCatalog` y `_updateInCatalog`**
- [ ] **Step 3: Agregar tests**
  ```js
  it('addEstado throws on duplicate nombre', async () => { ... })
  it('updateEstado throws on rename collision', async () => { ... })
  ```
- [ ] **Step 4: Test**
  ```bash
  npm test
  ```
- [ ] **Step 5: Commit**

---

### Task 8: Agregar QuotaExceededError fallback

**Files:**
- Modify: `src/stores/workflow.js`

- [ ] **Step 1: Modificar `_persist`**
  ```js
  function _persist(id, state) {
    try {
      const json = serializeV0_2(state)
      localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(json))
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
        console.warn('[workflow-store] localStorage quota exceeded')
        // Fallback: export to file automatically
        exportToFile()
        throw new Error('Almacenamiento local lleno. Se descargó el archivo de respaldo.')
      }
      throw e
    }
  }
  ```
- [ ] **Step 2: Agregar test simulado**
  ```js
  it('_persist fallback on QuotaExceededError', async () => { ... })
  ```
- [ ] **Step 3: Test**
  ```bash
  npm test
  ```
- [ ] **Step 4: Commit**

---

### Task 9: Stub global de directivas Quasar en vitest.config.js

**Files:**
- Modify: `vitest.config.js`

- [ ] **Step 1: Agregar directivas stub global**
  ```js
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
  },
  ```
  O bien crear `tests/setup.js` con stubs.
- [ ] **Step 2: Crear `tests/setup.js`**
  ```js
  import { config } from '@vue/test-utils'
  config.global.directives = {
    'close-popup': () => {},
    'ripple': () => {},
  }
  ```
- [ ] **Step 3: Test**
  ```bash
  npm test
  ```
  Verificar que desaparecen warnings de directivas.
- [ ] **Step 4: Commit**

---

## Execution Order

1. Task 1 (Fix routing) — 2 min
2. Task 3 (Extract hashId) — 10 min
3. Task 2 (Unify isDirty) — 20 min
4. Task 9 (Stub directives) — 10 min
5. Task 5 (Sanitize loadFromFile) — 20 min
6. Task 7 (Duplicate validation) — 20 min
8. Task 8 (Quota fallback) — 15 min
9. Task 4 (Theme CSS variables) — 90 min
10. Task 6 (Refactor canvas page) — 120 min

Total estimado: ~5 hrs
