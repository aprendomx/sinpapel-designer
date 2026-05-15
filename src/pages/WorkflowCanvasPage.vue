<template>
  <q-page class="wf-canvas-page">

    <!-- Header -->
    <div class="wf-canvas-page__header" :class="{ 'wf-canvas-page__header--edit': editMode }">
      <div class="wf-canvas-page__header-left">
        <button class="wf-canvas-page__back" @click="router.push({ name: 'workflows' })">
          <q-icon name="arrow_back" size="16px" />
          Workflows
        </button>
        <div class="wf-canvas-page__title-row">
          <h2 class="wf-canvas-page__title">{{ flujo?.nombre ?? '…' }}</h2>
          <span
            v-if="flujo"
            class="wf-canvas-page__status-badge"
            :class="flujo.activo ? 'wf-canvas-page__status-badge--on' : 'wf-canvas-page__status-badge--off'"
          >{{ flujo.activo ? 'Activo' : 'Inactivo' }}</span>
        </div>
        <p v-if="flujo?.descripcion" class="wf-canvas-page__desc">{{ flujo.descripcion }}</p>
      </div>

      <div class="wf-canvas-page__toolbar">
        <template v-if="editMode && isDirty">
          <span class="wf-canvas-page__unsaved-dot"></span>
          <q-btn
            flat no-caps
            label="Descartar"
            icon="undo"
            class="wf-canvas-page__btn-discard"
            :disable="saving"
            @click="discardChanges"
          />
          <q-btn
            unelevated no-caps
            label="Guardar"
            icon="save"
            class="wf-canvas-page__btn-save"
            :loading="saving"
            @click="saveChanges"
          />
        </template>
        <q-toggle
          v-model="editMode"
          label="Editar"
          color="primary"
          left-label
          class="wf-canvas-page__edit-toggle"
          :disable="saving"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="wf-canvas-page__loading">
      <q-spinner-dots color="primary" size="40px" />
      <span class="wf-canvas-page__loading-label">Cargando flujo…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="wf-canvas-page__centered">
      <q-icon name="error_outline" size="44px" style="color: #9b2247" />
      <span>No se pudo cargar el flujo</span>
    </div>

    <!-- Canvas + sidepanels -->
    <div v-else class="wf-canvas-page__body">

      <!-- Left: estados disponibles -->
      <transition name="panel-slide">
        <div v-if="editMode" class="wf-canvas-page__states-panel">
          <div class="wf-states__header">
            <q-icon name="widgets" size="14px" style="color: rgba(255,255,255,0.6)" />
            <span>Estados</span>
          </div>
          <div class="wf-states__filter">
            <q-input
              v-model="filtroEstados"
              dense
              borderless
              placeholder="Filtrar estados…"
              class="wf-states__filter-input"
            >
              <template #prepend>
                <q-icon name="search" size="14px" style="color: rgba(255,255,255,0.4)" />
              </template>
              <template v-if="filtroEstados" #append>
                <q-icon
                  name="close"
                  size="14px"
                  style="color: rgba(255,255,255,0.4); cursor: pointer"
                  @click="filtroEstados = ''"
                />
              </template>
            </q-input>
          </div>
          <p class="wf-states__hint">Arrastra al canvas para agregar</p>
          <div class="wf-states__list">
            <div
              v-for="estado in estadosFiltrados"
              :key="estado.id"
              class="wf-states__chip"
              :class="{ 'wf-states__chip--en-canvas': idsEnCanvas.has(String(estado.id)) }"
              :draggable="!idsEnCanvas.has(String(estado.id))"
              @dragstart="onSidebarDragStart($event, estado)"
            >
              <span
                class="material-icons wf-states__chip-icon"
                :style="{ color: estado.color || '#9b2247' }"
              >{{ estado.icono || 'circle' }}</span>
              <div class="wf-states__chip-content">
                <span class="wf-states__chip-name">{{ estado.nombre }}</span>
                <span v-if="estado.descripcion" class="wf-states__chip-desc">{{ estado.descripcion }}</span>
              </div>
              <q-icon
                v-if="idsEnCanvas.has(String(estado.id))"
                name="check_circle"
                size="14px"
                class="wf-states__chip-check"
              />
              <q-icon
                v-else
                name="drag_indicator"
                size="14px"
                class="wf-states__chip-drag"
              />
            </div>
            <div v-if="estadosFiltrados.length === 0" class="wf-states__all-done">
              <q-icon name="search_off" size="20px" style="color: rgba(255,255,255,0.4)" />
              <span>Sin resultados</span>
            </div>
          </div>
        </div>
      </transition>

      <!-- Canvas -->
      <div
        class="wf-canvas-page__canvas-wrap"
        @dragover.prevent
        @drop="onCanvasDrop"
      >
        <div v-if="editMode && nodes.length > 0" class="wf-canvas-page__hint">
          <q-icon name="info_outline" size="13px" />
          Arrastra nodos · Conecta arrastrando desde el borde del nodo · Clic en flecha para editarla
        </div>

        <div v-if="nodes.length === 0 && !editMode" class="wf-canvas-page__centered wf-canvas-page__centered--inline">
          <q-icon name="device_hub" size="44px" style="color: #d0c4bb" />
          <span class="wf-canvas-page__empty-label">Sin transiciones definidas para este flujo</span>
        </div>

        <div v-else-if="nodes.length === 0 && editMode" class="wf-canvas-page__centered wf-canvas-page__centered--inline">
          <q-icon name="device_hub" size="44px" style="color: #d0c4bb" />
          <span class="wf-canvas-page__empty-label">Arrastra estados desde el panel izquierdo</span>
        </div>

        <VueFlow
          v-show="nodes.length > 0"
          v-model:nodes="nodes"
          v-model:edges="edges"
          :nodes-draggable="editMode"
          :nodes-connectable="editMode"
          :edges-updatable="editMode"
          :elements-selectable="true"
          fit-view-on-init
          class="wf-canvas"
          @connect="onConnect"
          @node-drag-stop="onNodeDragStop"
          @edge-click="onEdgeClick"
        >
          <template #node-estado="nodeProps">
            <EstadoNode v-bind="nodeProps" :edit-mode="editMode" />
          </template>
          <Background pattern-color="#ddd4ca" :gap="22" />
          <Controls />
          <MiniMap
            :node-color="miniMapColor"
            node-stroke-width="2"
            class="wf-canvas__minimap"
          />
        </VueFlow>
      </div>

      <!-- Right: transición seleccionada -->
      <transition name="panel-slide">
        <div v-if="editMode && selectedEdge" class="wf-canvas-page__panel">
          <div class="wf-panel__header">
            <q-icon name="swap_horiz" size="16px" />
            <span>Transición</span>
          </div>

          <div class="wf-panel__route">
            <span class="wf-panel__state-tag">{{ selectedEdge.data?.origen_nombre }}</span>
            <q-icon name="arrow_forward" size="12px" style="color: #a57f2c; flex-shrink:0" />
            <span class="wf-panel__state-tag">{{ selectedEdge.data?.destino_nombre }}</span>
          </div>

          <div class="wf-panel__divider"></div>

          <div class="wf-panel__field-label">Grupos permitidos</div>
          <p class="wf-panel__field-hint">Vacío = cualquier usuario puede ejecutarla</p>
          <q-select
            v-model="selectedEdgeGrupos"
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
            @update:model-value="onEdgeGruposChange"
          />

          <div class="wf-panel__divider"></div>

          <button class="wf-panel__delete-btn" @click="eliminarEdge(selectedEdge)">
            <q-icon name="delete_outline" size="15px" />
            Eliminar transición
          </button>
        </div>
      </transition>

    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { VueFlow, MarkerType, useVueFlow } from '@vue-flow/core'
import EstadoNode from 'src/components/EstadoNode.vue'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { useWorkflowStore } from 'src/stores/workflow.js'

// ── Page logic ───────────────────────────────────────────────────────────────

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const { screenToFlowCoordinate } = useVueFlow()
const store = useWorkflowStore()

const flujo = ref(null)
const nodes = ref([])
const edges = ref([])
const loading = ref(true)
const error = ref(false)

// Edit mode state
const editMode = ref(false)
const isDirty = ref(false)
const saving = ref(false)

// Panel lateral (edge)
const selectedEdge = ref(null)
const selectedEdgeGrupos = ref([])
const gruposOptions = ref([])

// Estados sidebar
const todosEstatuses = ref([])
const draggedEstado = ref(null)
const filtroEstados = ref('')

const estadosFiltrados = computed(() => {
  const termino = filtroEstados.value.toLowerCase().trim()
  let lista = todosEstatuses.value
  if (termino) {
    lista = lista.filter(e =>
      e.nombre.toLowerCase().includes(termino) ||
      (e.descripcion && e.descripcion.toLowerCase().includes(termino))
    )
  }
  return lista
})

const idsEnCanvas = computed(() => new Set(nodes.value.map(n => n.id)))

// Snapshot for discard
let snapshotNodes = []
let snapshotEdges = []

function miniMapColor(node) {
  return node.data?.color || '#9b2247'
}

// ── Load ─────────────────────────────────────────────────────────────────────

async function loadFlujo() {
  loading.value = true
  error.value = false
  const id = route.params.id
  try {
    const [flujoData, transiciones] = await Promise.all([
      store.getFlujo(id),
      store.getFlujoTransiciones(id),
    ])
    flujo.value = flujoData

    if (transiciones.length === 0) {
      nodes.value = []
      edges.value = []
      return
    }

    // Extraer estados únicos, ordenar por .orden
    const estadosMap = new Map()
    for (const t of transiciones) {
      estadosMap.set(t.estado_origen.id, t.estado_origen)
      estadosMap.set(t.estado_destino.id, t.estado_destino)
    }
    const estados = [...estadosMap.values()].sort((a, b) => a.orden - b.orden)

    // Posiciones: usar metadatos.positions si existen, sino auto-layout
    const positions = flujoData.metadatos?.positions ?? {}

    nodes.value = estados.map((e, i) => ({
      id: String(e.id),
      type: 'estado',
      label: e.nombre,
      position: positions[String(e.id)] ?? { x: 250, y: i * 130 },
      data: { color: e.color, icono: e.icono, estado_id: e.id },
    }))

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
      },
    }))

    // Save snapshot
    snapshotNodes = JSON.parse(JSON.stringify(nodes.value))
    snapshotEdges = JSON.parse(JSON.stringify(edges.value))
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadFlujo()
  // Load grupos and all estatuses in parallel
  const [grupos, estatuses] = await Promise.allSettled([
    store.getGrupos(),
    store.getEstatuses(),
  ])
  if (grupos.status === 'fulfilled') gruposOptions.value = grupos.value
  if (estatuses.status === 'fulfilled') {
    todosEstatuses.value = (estatuses.value ?? []).filter(e => e.activo !== false)
  }
})

// ── Sidebar drag-and-drop ─────────────────────────────────────────────────────

function onSidebarDragStart(event, estado) {
  if (idsEnCanvas.value.has(String(estado.id))) {
    event.preventDefault()
    return
  }
  draggedEstado.value = estado
  event.dataTransfer.effectAllowed = 'move'
}

function onCanvasDrop(event) {
  if (!draggedEstado.value) return
  const estado = draggedEstado.value
  draggedEstado.value = null

  // Prevent adding duplicates
  if (nodes.value.some(n => n.id === String(estado.id))) return

  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })

  nodes.value = [
    ...nodes.value,
    {
      id: String(estado.id),
      type: 'estado',
      label: estado.nombre,
      position,
      data: { color: estado.color, icono: estado.icono, estado_id: estado.id },
    },
  ]
  isDirty.value = true
}

// ── Edit mode events ──────────────────────────────────────────────────────────

function onConnect(params) {
  // Find node labels for display
  const sourceNode = nodes.value.find(n => n.id === params.source)
  const targetNode = nodes.value.find(n => n.id === params.target)

  const newEdge = {
    id: `new-${params.source}-${params.target}`,
    source: params.source,
    target: params.target,
    label: 'Sin restricción',
    markerEnd: MarkerType.ArrowClosed,
    style: { stroke: '#a57f2c' },
    labelStyle: { fontSize: '11px', fill: '#666' },
    labelBgStyle: { fill: '#fdfbf6', fillOpacity: 0.9 },
    data: {
      grupos_ids: [],
      origen_nombre: sourceNode?.label ?? params.source,
      destino_nombre: targetNode?.label ?? params.target,
    },
  }

  // Avoid duplicates
  const exists = edges.value.some(
    e => e.source === params.source && e.target === params.target
  )
  if (!exists) {
    edges.value = [...edges.value, newEdge]
    isDirty.value = true
  }
}

function onNodeDragStop({ node }) {
  const idx = nodes.value.findIndex(n => n.id === node.id)
  if (idx !== -1) {
    nodes.value[idx] = { ...nodes.value[idx], position: { ...node.position } }
    isDirty.value = true
  }
}

function onEdgeClick({ edge }) {
  if (!editMode.value) return
  selectedEdge.value = edge
  selectedEdgeGrupos.value = edge.data?.grupos_ids ?? []
}

function onEdgeGruposChange(newGrupos) {
  if (!selectedEdge.value) return
  const labels = gruposOptions.value
    .filter(g => newGrupos.includes(g.id))
    .map(g => g.name)

  edges.value = edges.value.map(e => {
    if (e.id !== selectedEdge.value.id) return e
    return {
      ...e,
      label: labels.length ? labels.join(' / ') : 'Sin restricción',
      data: { ...e.data, grupos_ids: newGrupos },
    }
  })
  // Keep selectedEdge in sync
  selectedEdge.value = edges.value.find(e => e.id === selectedEdge.value?.id) ?? null
  isDirty.value = true
}

function eliminarEdge(edge) {
  edges.value = edges.value.filter(e => e.id !== edge.id)
  selectedEdge.value = null
  selectedEdgeGrupos.value = []
  isDirty.value = true
}

// ── Save / Discard ────────────────────────────────────────────────────────────

async function saveChanges() {
  saving.value = true
  const id = route.params.id
  try {
    // Build transiciones payload from current edges
    const transiciones = edges.value.map(e => ({
      estado_origen_id: parseInt(e.source),
      estado_destino_id: parseInt(e.target),
      grupos_ids: e.data?.grupos_ids ?? [],
    }))

    // Build positions payload from current nodes
    const positions = {}
    nodes.value.forEach(n => {
      positions[n.id] = { x: n.position.x, y: n.position.y }
    })

    await store.bulkReplaceTransiciones(id, transiciones)
    await store.saveLayout(id, positions)

    // Update snapshot after save
    snapshotNodes = JSON.parse(JSON.stringify(nodes.value))
    snapshotEdges = JSON.parse(JSON.stringify(edges.value))
    isDirty.value = false
    selectedEdge.value = null

    // S27.5: trigger download del JSON v0.2 (combined save UX per D5)
    store.exportToFile()

    $q.notify({
      type: 'positive',
      message: 'Workflow guardado (localStorage + descargado)',
      position: 'top',
    })
  } catch {
    $q.notify({ type: 'negative', message: 'Error al guardar', position: 'top' })
  } finally {
    saving.value = false
  }
}

function discardChanges() {
  nodes.value = JSON.parse(JSON.stringify(snapshotNodes))
  edges.value = JSON.parse(JSON.stringify(snapshotEdges))
  isDirty.value = false
  selectedEdge.value = null
  selectedEdgeGrupos.value = []
}

// Clear panel when leaving edit mode
watch(editMode, (val) => {
  if (!val) {
    selectedEdge.value = null
    selectedEdgeGrupos.value = []
  }
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Cabin:wght@400;700&display=swap');
</style>

<style scoped>
/* ── Page layout ──────────────────────────────────────────────── */
.wf-canvas-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f2ece5;
  overflow: hidden;
  font-family: 'Cabin', sans-serif;
}

/* ── Header ───────────────────────────────────────────────────── */
.wf-canvas-page__header {
  padding: 14px 28px;
  background: #fff;
  border-bottom: 2px solid #e6ddd4;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  transition: border-color 0.2s;
}

.wf-canvas-page__header--edit {
  border-bottom-color: #9b2247;
}

.wf-canvas-page__header-left {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wf-canvas-page__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Cabin', sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: #9b2247;
  padding: 0;
  margin-bottom: 4px;
  letter-spacing: 0.02em;
  opacity: 0.8;
  transition: opacity 0.15s;
}

.wf-canvas-page__back:hover {
  opacity: 1;
}

.wf-canvas-page__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wf-canvas-page__title {
  font-family: 'Cabin', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #1e0c14;
  margin: 0;
}

.wf-canvas-page__status-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 3px;
}

.wf-canvas-page__status-badge--on {
  background: #e4f3ec;
  color: #1e5b4f;
}

.wf-canvas-page__status-badge--off {
  background: #eeebe7;
  color: #999;
}

.wf-canvas-page__desc {
  font-size: 11px;
  color: #9a8e87;
  margin: 2px 0 0;
}

/* ── Toolbar ──────────────────────────────────────────────────── */
.wf-canvas-page__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.wf-canvas-page__unsaved-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f08217;
  flex-shrink: 0;
  animation: dot-pulse 1.6s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.wf-canvas-page__btn-discard {
  color: #777 !important;
  font-family: 'Cabin', sans-serif;
  font-size: 13px;
}

.wf-canvas-page__btn-save {
  background: #9b2247 !important;
  color: #fff !important;
  font-family: 'Cabin', sans-serif;
  font-weight: 700;
  font-size: 13px;
}

.wf-canvas-page__edit-toggle {
  font-family: 'Cabin', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #555;
}

/* ── Loading / error ──────────────────────────────────────────── */
.wf-canvas-page__loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.wf-canvas-page__loading-label {
  font-size: 13px;
  color: #aaa;
  font-family: 'Cabin', sans-serif;
}

.wf-canvas-page__centered {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
  color: #aaa;
}

.wf-canvas-page__centered--inline {
  position: absolute;
  inset: 0;
  z-index: 5;
}

.wf-canvas-page__empty-label {
  font-family: 'Cabin', sans-serif;
  font-size: 14px;
  color: #b0a8a0;
}

/* ── Body ─────────────────────────────────────────────────────── */
.wf-canvas-page__body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── Canvas wrap ──────────────────────────────────────────────── */
.wf-canvas-page__canvas-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.wf-canvas-page__hint {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #ddd4ca;
  border-radius: 20px;
  padding: 5px 16px;
  font-family: 'Cabin', sans-serif;
  font-size: 11px;
  color: #7a6e67;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.wf-canvas {
  width: 100%;
  height: 100%;
  background: #faf5ef;
}

.wf-canvas__minimap {
  border: 1px solid #ddd4ca;
  border-radius: 8px;
  overflow: hidden;
}

/* ── Panel slide ──────────────────────────────────────────────── */
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

/* ── States sidebar (left) ────────────────────────────────────── */
.wf-canvas-page__states-panel {
  width: 210px;
  flex-shrink: 0;
  border-right: 2px solid #7a1836;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #2a0e1c !important;
}

.wf-states__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 14px 10px;
  font-family: 'Cabin', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.wf-states__filter {
  padding: 8px 10px 0;
  flex-shrink: 0;
}

.wf-states__filter-input {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 2px 8px;
}

:deep(.wf-states__filter-input .q-field__native) {
  color: #fff;
  font-family: 'Cabin', sans-serif;
  font-size: 12px;
}

:deep(.wf-states__filter-input .q-field__native::placeholder) {
  color: rgba(255, 255, 255, 0.35);
}

.wf-states__hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin: 10px 12px 6px;
  line-height: 1.4;
  flex-shrink: 0;
}

.wf-states__list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.wf-states__chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-left: 3px solid #a57f2c;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0 7px 7px 0;
  background-color: rgba(255, 255, 255, 0.09);
  cursor: grab;
  font-family: 'Cabin', sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  transition: background-color 0.12s, border-left-color 0.12s;
  user-select: none;
}

.wf-states__chip:hover {
  background-color: rgba(255, 255, 255, 0.16);
  border-left-color: #e6d194;
}

.wf-states__chip:active {
  cursor: grabbing;
}

.wf-states__chip-icon {
  font-size: 15px;
  flex-shrink: 0;
  filter: brightness(1.4);
}

.wf-states__chip-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wf-states__chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wf-states__chip-desc {
  font-size: 10px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.wf-states__chip--en-canvas {
  opacity: 0.5;
  cursor: default;
  border-left-color: #1e5b4f;
}

.wf-states__chip--en-canvas:hover {
  background-color: rgba(255, 255, 255, 0.09);
  border-left-color: #1e5b4f;
}

.wf-states__chip-check {
  color: #4aba8a;
  flex-shrink: 0;
}

.wf-states__chip-drag {
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.wf-states__all-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 24px 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
}

/* ── Right panel (transición) ─────────────────────────────────── */
.wf-canvas-page__panel {
  width: 268px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #e6ddd4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  background: #9b2247;
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
  background: #faf5ef;
  border: 1px solid #e0d5cc;
  border-radius: 4px;
  padding: 3px 10px;
  font-family: 'Cabin', sans-serif;
  font-size: 11px;
  font-weight: 700;
  color: #1e0c14;
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
  color: #4a3e38;
  padding: 0 16px;
  flex-shrink: 0;
}

.wf-panel__field-hint {
  font-size: 11px;
  color: #aaa;
  padding: 2px 16px 0;
  margin: 0;
  line-height: 1.4;
  flex-shrink: 0;
}

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
  color: #9b2247;
  padding: 8px 12px;
  transition: background 0.12s;
  flex-shrink: 0;
}

.wf-panel__delete-btn:hover {
  background: #fdf0f4;
}
</style>
