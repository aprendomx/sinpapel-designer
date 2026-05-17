# Agregar Estado desde Canvas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir crear un nuevo Estado desde el panel izquierdo del `WorkflowCanvasPage` sin salir al `CatalogosPage`, reutilizando `CatalogoFormDialog` y `store.addEstado`.

**Architecture:** Botón `+` en el header de `WorkflowCanvasStatesPanel` que emite `'create'` → la página del canvas abre el diálogo existente `CatalogoFormDialog` (catalog-key=`estados`) → al guardar, refresca la lista local de estados → el chip nuevo aparece en el panel y el usuario lo arrastra al canvas. Como mejora colateral defensiva, el diálogo gana `try/catch` + notify cuando el store lanza (p.ej. nombre duplicado).

**Tech Stack:** Vue 3 `<script setup>`, Quasar (q-btn, q-input, q-notify), Pinia (`useWorkflowStore`), vitest + `@vue/test-utils` (jsdom), eslint flat config.

**Spec:** `docs/superpowers/specs/2026-05-16-agregar-estado-desde-canvas-design.md`

---

## File Structure

**Modify:**
- `src/components/WorkflowCanvasStatesPanel.vue` — añadir botón `+` en header + emit `'create'`.
- `src/pages/WorkflowCanvasPage.vue` — declarar `createDialogOpen`, montar `CatalogoFormDialog`, extraer `reloadEstatuses()`.
- `src/components/CatalogoFormDialog.vue` — try/catch + notify alrededor de `store[addAction/updateAction]`.

**Create:**
- `tests/canvas-add-estado.test.js` — tests de comportamiento de las 3 piezas.

---

## Task 1: Botón "+" en `WorkflowCanvasStatesPanel`

**Files:**
- Test: `tests/canvas-add-estado.test.js` (nuevo)
- Modify: `src/components/WorkflowCanvasStatesPanel.vue` (header, ~líneas 4-7; script setup ~líneas 78)

- [ ] **Step 1.1: Crear test que falla**

Crear `tests/canvas-add-estado.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowCanvasStatesPanel from '../src/components/WorkflowCanvasStatesPanel.vue'

describe('WorkflowCanvasStatesPanel — botón crear', () => {
  it('muestra botón + con aria-label "Crear Estado" cuando editMode=true', () => {
    const wrapper = mount(WorkflowCanvasStatesPanel, {
      props: { estados: [], idsEnCanvas: new Set(), editMode: true },
      global: {
        stubs: {
          QInput: true,
          QIcon: true,
          QBtn: { template: '<button :aria-label="$attrs[`aria-label`]"><slot/></button>', inheritAttrs: false },
        },
      },
    })
    const btn = wrapper.find('button[aria-label="Crear Estado"]')
    expect(btn.exists()).toBe(true)
  })

  it('emite "create" al hacer click en el botón +', async () => {
    const wrapper = mount(WorkflowCanvasStatesPanel, {
      props: { estados: [], idsEnCanvas: new Set(), editMode: true },
      global: {
        stubs: {
          QInput: true,
          QIcon: true,
          QBtn: { template: '<button :aria-label="$attrs[`aria-label`]" @click="$emit(\'click\')"><slot/></button>', inheritAttrs: false, emits: ['click'] },
        },
      },
    })
    await wrapper.find('button[aria-label="Crear Estado"]').trigger('click')
    expect(wrapper.emitted('create')).toBeTruthy()
    expect(wrapper.emitted('create')).toHaveLength(1)
  })
})
```

- [ ] **Step 1.2: Correr el test y verificar que falla**

```bash
npm test -- --run tests/canvas-add-estado.test.js
```

Expected: 2 tests FAIL (botón no existe).

- [ ] **Step 1.3: Añadir botón + emit en el panel**

En `src/components/WorkflowCanvasStatesPanel.vue`, dentro de `<div class="wf-states__header">`, añadir el botón al final del div (después del span "Estados"):

```vue
<div class="wf-states__header">
  <q-icon name="widgets" size="14px" style="color: rgba(255,255,255,0.6)" />
  <span>Estados</span>
  <q-space />
  <q-btn
    flat dense round
    icon="add"
    size="sm"
    aria-label="Crear Estado"
    class="wf-states__create-btn"
    @click="$emit('create')"
  />
</div>
```

Actualizar `defineEmits` (línea ~78):

```javascript
const emit = defineEmits(['drag-start', 'create'])
```

Añadir estilo al `<style scoped>` (al final, antes del cierre):

```css
.wf-states__create-btn {
  color: rgba(255, 255, 255, 0.7) !important;
}

.wf-states__create-btn:hover {
  color: #fff !important;
}
```

Nota: `q-space` viene de Quasar y empuja el botón a la derecha. Verificar que el header use `display: flex` y `align-items: center`. Si no, añadir esas reglas al selector `.wf-states__header` existente (ya las tiene, líneas 127-129 en el archivo actual).

- [ ] **Step 1.4: Correr el test y verificar que pasa**

```bash
npm test -- --run tests/canvas-add-estado.test.js
```

Expected: 2 tests PASS.

- [ ] **Step 1.5: Correr lint**

```bash
npm run lint
```

Expected: `ESLint: No issues found`.

- [ ] **Step 1.6: Commit**

```bash
git add src/components/WorkflowCanvasStatesPanel.vue tests/canvas-add-estado.test.js
git commit -m "$(cat <<'EOF'
feat(canvas): botón + en panel Estados emite 'create'

Sub-proyecto A — paso 1: el panel del canvas gana un botón de
crear Estado en el header. Wiring del diálogo en la página viene
en el siguiente paso.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wiring del diálogo en `WorkflowCanvasPage`

**Files:**
- Test: `tests/canvas-add-estado.test.js` (extender)
- Modify: `src/pages/WorkflowCanvasPage.vue`

- [ ] **Step 2.1: Añadir test de integración (refresh tras saved)**

Anexar al final de `tests/canvas-add-estado.test.js` un nuevo describe:

```javascript
import { flushPromises } from '@vue/test-utils'

describe('WorkflowCanvasPage — crear Estado desde panel', () => {
  it('refresca estados tras evento "saved" del diálogo', async () => {
    const getEstatusesMock = vi.fn()
      .mockResolvedValueOnce([{ id: 1, nombre: 'Inicio', activo: true }])
      .mockResolvedValueOnce([
        { id: 1, nombre: 'Inicio', activo: true },
        { id: 2, nombre: 'NuevoEstado', activo: true },
      ])

    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({
        current: null,
        isDirty: false,
        getFlujo: vi.fn().mockResolvedValue({
          id: 1, nombre: 'Test', descripcion: '', activo: true,
          metadatos: { positions: {} },
        }),
        getFlujoTransiciones: vi.fn().mockResolvedValue([]),
        getGrupos: vi.fn().mockResolvedValue([]),
        getEstatuses: getEstatusesMock,
        bulkReplaceTransiciones: vi.fn(),
        saveLayout: vi.fn(),
        exportToFile: vi.fn(),
      }),
    }))
    vi.doMock('vue-router', () => ({
      useRoute: () => ({ params: { id: '1' } }),
      useRouter: () => ({ push: vi.fn() }),
    }))
    vi.doMock('@vue-flow/core', () => ({
      VueFlow: { template: '<div/>' },
      useVueFlow: () => ({ screenToFlowCoordinate: vi.fn() }),
      MarkerType: { ArrowClosed: 'arrowclosed' },
      Handle: { template: '<div/>' },
      Position: { Top: 'top', Bottom: 'bottom' },
    }))
    vi.doMock('@vue-flow/background', () => ({ Background: { template: '<div/>' } }))
    vi.doMock('@vue-flow/controls', () => ({ Controls: { template: '<div/>' } }))
    vi.doMock('@vue-flow/minimap', () => ({ MiniMap: { template: '<div/>' } }))

    const { default: WorkflowCanvasPage } = await import('../src/pages/WorkflowCanvasPage.vue')

    const wrapper = mount(WorkflowCanvasPage, {
      global: {
        stubs: {
          QPage: { template: '<div><slot/></div>' },
          QBtn: true, QToggle: true, QInput: true, QSelect: true,
          QIcon: true, QSpinnerDots: true,
          WorkflowCanvasToolbar: true,
          WorkflowCanvasTransitionPanel: true,
          WorkflowCanvasStatesPanel: {
            template: '<div data-testid="states-panel" @click="$emit(\'create\')"/>',
            emits: ['create', 'drag-start'],
          },
          CatalogoFormDialog: {
            template: '<div data-testid="estado-dialog" v-if="modelValue" @click="$emit(\'saved\')"/>',
            props: ['modelValue', 'catalogKey', 'editing'],
            emits: ['update:modelValue', 'saved'],
          },
        },
        mocks: { $q: { notify: vi.fn() } },
      },
    })

    await flushPromises()
    expect(getEstatusesMock).toHaveBeenCalledTimes(1)

    // Simular clic en panel -> emite create -> dialog se abre
    await wrapper.find('[data-testid="states-panel"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="estado-dialog"]').exists()).toBe(true)

    // Simular saved -> reloadEstatuses se llama
    await wrapper.find('[data-testid="estado-dialog"]').trigger('click')
    await flushPromises()
    expect(getEstatusesMock).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2.2: Correr el test y verificar que falla**

```bash
npm test -- --run tests/canvas-add-estado.test.js
```

Expected: el nuevo test FAILS (`CatalogoFormDialog` no se renderiza porque no está montado en la página).

- [ ] **Step 2.3: Editar `WorkflowCanvasPage.vue` — extraer `reloadEstatuses`**

En `src/pages/WorkflowCanvasPage.vue`, añadir tras la declaración de `todosEstatuses` (línea ~145):

```javascript
async function reloadEstatuses() {
  const result = await store.getEstatuses()
  todosEstatuses.value = (result ?? []).filter(e => e.activo !== false)
}
```

En el bloque `onMounted` (líneas ~241-252), reemplazar el manejo de `estatuses`:

```javascript
onMounted(async () => {
  await loadFlujo()
  const [grupos] = await Promise.allSettled([store.getGrupos()])
  if (grupos.status === 'fulfilled') gruposOptions.value = grupos.value
  await reloadEstatuses()
})
```

- [ ] **Step 2.4: Añadir state del diálogo + import**

Después de los demás `ref()` en el setup (cerca de línea ~138), añadir:

```javascript
const createEstadoDialogOpen = ref(false)
```

Verificar imports en el `<script setup>`. Si `CatalogoFormDialog` no está importado, añadir:

```javascript
import CatalogoFormDialog from 'src/components/CatalogoFormDialog.vue'
```

- [ ] **Step 2.5: Conectar el panel y montar el diálogo en el template**

En el template, encontrar `<WorkflowCanvasStatesPanel>` (línea ~34) y añadir el handler `@create`:

```vue
<WorkflowCanvasStatesPanel
  :estados="todosEstatuses"
  :ids-en-canvas="idsEnCanvas"
  :edit-mode="editMode"
  @drag-start="onSidebarDragStart"
  @create="createEstadoDialogOpen = true"
/>
```

Al final del `<q-page>` (justo antes del cierre `</q-page>`), añadir:

```vue
<CatalogoFormDialog
  v-model="createEstadoDialogOpen"
  catalog-key="estados"
  :editing="null"
  @saved="reloadEstatuses"
/>
```

- [ ] **Step 2.6: Correr el test y verificar que pasa**

```bash
npm test -- --run tests/canvas-add-estado.test.js
```

Expected: los 3 tests PASS.

- [ ] **Step 2.7: Correr toda la suite + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos los tests pasan y lint clean.

- [ ] **Step 2.8: Commit**

```bash
git add src/pages/WorkflowCanvasPage.vue tests/canvas-add-estado.test.js
git commit -m "$(cat <<'EOF'
feat(canvas): montar CatalogoFormDialog y refrescar estados

Sub-proyecto A — paso 2: la página del canvas escucha el evento
'create' del panel, abre CatalogoFormDialog con catalog-key
estados, y al recibir 'saved' recarga la lista vía
reloadEstatuses() (extraída de onMounted).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Error handling defensivo en `CatalogoFormDialog`

**Files:**
- Test: `tests/canvas-add-estado.test.js` (extender)
- Modify: `src/components/CatalogoFormDialog.vue`

- [ ] **Step 3.1: Añadir test de notify en error**

Anexar al final de `tests/canvas-add-estado.test.js`:

```javascript
describe('CatalogoFormDialog — manejo de error en save', () => {
  it('muestra notify negativo y mantiene el diálogo abierto si addAction lanza', async () => {
    const notifyMock = vi.fn()
    const addEstadoMock = vi.fn(() => { throw new Error('estado con nombre=Foo ya existe') })

    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({
        current: { etapas: [] },
        addEstado: addEstadoMock,
      }),
    }))

    const { default: CatalogoFormDialog } = await import('../src/components/CatalogoFormDialog.vue')

    const wrapper = mount(CatalogoFormDialog, {
      props: { modelValue: true, catalogKey: 'estados', editing: null },
      global: {
        stubs: {
          QDialog: { template: '<div><slot/></div>', props: ['modelValue'] },
          QCard: { template: '<div><slot/></div>' },
          QCardSection: { template: '<div><slot/></div>' },
          QForm: {
            template: '<form @submit.prevent="$emit(\'submit\')"><slot/></form>',
            emits: ['submit'],
          },
          QInput: {
            template: '<input :data-field="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"/>',
            props: ['modelValue', 'label'],
            emits: ['update:modelValue'],
          },
          QToggle: { template: '<input type="checkbox"/>', props: ['modelValue'] },
          QSelect: { template: '<select/>', props: ['modelValue'] },
          QBtn: { template: '<button :type="type" @click="$emit(\'click\')"><slot/></button>', props: ['type'], emits: ['click'] },
        },
        mocks: { $q: { notify: notifyMock } },
      },
    })

    // Llenar el campo Nombre vía el stub de QInput (pasa la guarda `if (!form[nameField]) return`)
    await wrapper.find('input[data-field="Nombre"]').setValue('Foo')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(addEstadoMock).toHaveBeenCalled()
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'negative' })
    )
    // El diálogo NO se cerró (update:modelValue=false no se emitió)
    const closeEmits = (wrapper.emitted('update:modelValue') || [])
      .filter(args => args[0] === false)
    expect(closeEmits).toHaveLength(0)
  })
})
```

- [ ] **Step 3.2: Correr el test y verificar que falla**

```bash
npm test -- --run tests/canvas-add-estado.test.js
```

Expected: el nuevo test FAILS (hoy el dialog no usa `$q` y deja propagar el throw, o cierra incondicionalmente — depende del runtime).

- [ ] **Step 3.3: Añadir try/catch + notify en `onSave`**

En `src/components/CatalogoFormDialog.vue`, dentro del `<script setup>`, importar `useQuasar` y obtener `$q`:

```javascript
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkflowStore } from 'src/stores/workflow.js'
import { CATALOGO_CONFIGS, defaultsFor } from 'src/data/catalogo-fields.js'
```

Después de `const store = useWorkflowStore()`:

```javascript
const $q = useQuasar()
```

Reemplazar la función `onSave` completa por:

```javascript
function onSave() {
  const cfg = config.value
  const nameField = cfg.nameField
  if (!form.value[nameField]) return
  try {
    if (isEdit.value) {
      store[cfg.updateAction](props.editing.id, { ...form.value })
    } else {
      store[cfg.addAction]({ ...form.value })
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e?.message || `No se pudo guardar el ${cfg.label}`,
      position: 'top',
    })
  }
}
```

- [ ] **Step 3.4: Correr el test y verificar que pasa**

```bash
npm test -- --run tests/canvas-add-estado.test.js
```

Expected: los 4 tests PASS.

- [ ] **Step 3.5: Correr toda la suite + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos los tests pasan, lint clean. Verificar que `catalogos-page.test.js` sigue verde (Task 3 toca un componente compartido).

- [ ] **Step 3.6: Commit**

```bash
git add src/components/CatalogoFormDialog.vue tests/canvas-add-estado.test.js
git commit -m "$(cat <<'EOF'
fix(catalogos): notify error en CatalogoFormDialog si el store lanza

Sub-proyecto A — paso 3: si store.addEstado/updateEstado lanza (p.ej.
nombre duplicado por _assertUniqueName), mostrar notify negativo y
mantener el diálogo abierto en lugar de cerrar silenciosamente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Verificación manual + push

- [ ] **Step 4.1: Arrancar dev server**

```bash
npm run dev
```

Abrir el browser en la URL que muestra la terminal (típicamente `http://localhost:9000`).

- [ ] **Step 4.2: Recorrer el flujo dorado**

1. Crear un flujo nuevo desde `WorkflowListPage` (o abrir uno existente).
2. En el canvas, activar el toggle "Editar".
3. Verificar que el botón `+` aparece en el header del panel izquierdo.
4. Click en `+` → confirma que se abre el diálogo "Nuevo Estado".
5. Llenar nombre + color → Guardar.
6. Verificar que el diálogo cierra y el nuevo Estado aparece como chip en el panel izquierdo.
7. Arrastrar el chip al canvas → confirma que se añade como nodo.

- [ ] **Step 4.3: Recorrer el caso de error (nombre duplicado)**

1. Click en `+` otra vez.
2. Usar el mismo nombre del estado recién creado → Guardar.
3. Confirmar que aparece notify negativo "estado con nombre='X' ya existe" y el diálogo sigue abierto.
4. Cambiar el nombre y guardar → cierra normal.

- [ ] **Step 4.4: Push**

```bash
git push
```

Expected: 3 commits pusheados a `origin/develop`.
