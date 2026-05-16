<template>
  <q-page class="wf-canvas-page">

    <!-- Header -->
    <WorkflowCanvasToolbar
      :flujo="flujo"
      v-model:edit-mode="editMode"
      :is-dirty="store.isDirty"
      :saving="saving"
      :can-undo="store.canUndo"
      :can-redo="store.canRedo"
      @discard="discardChanges"
      @save="saveChanges"
      @undo="store.undo()"
      @redo="store.redo()"
    />

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
      <WorkflowCanvasStatesPanel
        :estados="todosEstatuses"
        :ids-en-canvas="idsEnCanvas"
        :edit-mode="editMode"
        @drag-start="onSidebarDragStart"
      />

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
      <WorkflowCanvasTransitionPanel
        :selected-edge="selectedEdge"
        :grupos-options="gruposOptions"
        :edit-mode="editMode"
        @grupos-change="onEdgeGruposChange"
        @delete-edge="eliminarEdge"
      />

    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
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
import WorkflowCanvasToolbar from 'src/components/WorkflowCanvasToolbar.vue'
import WorkflowCanvasStatesPanel from 'src/components/WorkflowCanvasStatesPanel.vue'
import WorkflowCanvasTransitionPanel from 'src/components/WorkflowCanvasTransitionPanel.vue'
import { useCanvasKeyboard } from 'src/composables/useCanvasKeyboard.js'

// ── Page logic ───────────────────────────────────────────────────────────────

const route = useRoute()
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
const saving = ref(false)

// Panel lateral (edge)
const selectedEdge = ref(null)
const selectedEdgeGrupos = ref([])
const gruposOptions = ref([])

// Estados sidebar
const todosEstatuses = ref([])
const draggedEstado = ref(null)

const idsEnCanvas = computed(() => new Set(nodes.value.map(n => n.id)))

// Snapshot for discard
let snapshotNodes = []
let snapshotEdges = []

useCanvasKeyboard({
  editMode,
  selectedEdge,
  onSave: saveChanges,
  onUndo: () => store.undo(),
  onRedo: () => store.redo(),
  onDeleteEdge: eliminarEdge,
  onEscape: (action) => {
    if (action === 'close-panel') {
      selectedEdge.value = null
      selectedEdgeGrupos.value = []
    } else if (action === 'exit-edit') {
      editMode.value = false
    }
  },
})

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
  store.isDirty = true
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
    store.isDirty = true
  }
}

function onNodeDragStop({ node }) {
  const idx = nodes.value.findIndex(n => n.id === node.id)
  if (idx !== -1) {
    nodes.value[idx] = { ...nodes.value[idx], position: { ...node.position } }
    store.isDirty = true
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
  store.isDirty = true
}

function eliminarEdge(edge) {
  edges.value = edges.value.filter(e => e.id !== edge.id)
  selectedEdge.value = null
  selectedEdgeGrupos.value = []
  store.isDirty = true
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
    store.isDirty = false
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
  store.isDirty = false
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

</style>
