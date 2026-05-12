<template>
  <q-page class="wf-list">

    <!-- Hero header -->
    <div class="wf-list__hero">
      <div class="wf-list__hero-inner">
        <div>
          <span class="wf-list__eyebrow">Módulo Diseñador</span>
          <h1 class="wf-list__title">Flujos de Trabajo</h1>
          <p class="wf-list__subtitle">Configuración de workflows de aprobación crediticia</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <q-btn
            icon="upload_file"
            label="Importar"
            no-caps
            outline
            class="wf-list__import-btn"
            @click="triggerFileInput"
          />
          <q-btn
            icon="add"
            label="Nuevo flujo"
            no-caps
            unelevated
            class="wf-list__new-btn"
            @click="dialogVisible = true"
          />
          <input
            ref="fileInputRef"
            type="file"
            accept=".json,application/json"
            style="display: none"
            @change="onFileSelected"
          />
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="wf-list__content">

      <!-- Loading skeletons -->
      <div v-if="loading" class="wf-list__table">
        <div v-for="n in 3" :key="n" class="wf-list__skeleton-row">
          <div class="wf-list__skeleton-num"></div>
          <div class="wf-list__skeleton-body">
            <div class="wf-list__skeleton-line wf-list__skeleton-line--title"></div>
            <div class="wf-list__skeleton-line wf-list__skeleton-line--sub"></div>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="wf-list__empty-state">
        <q-icon name="error_outline" size="40px" class="wf-list__empty-icon wf-list__empty-icon--error" />
        <span class="wf-list__empty-label">Error al cargar flujos</span>
      </div>

      <!-- Empty state -->
      <div v-else-if="flujos.length === 0" class="wf-list__empty-state">
        <q-icon name="account_tree" size="40px" class="wf-list__empty-icon" />
        <span class="wf-list__empty-label">No hay flujos configurados</span>
        <p class="wf-list__empty-hint">Crea el primer flujo de trabajo con el botón de arriba</p>
      </div>

      <!-- Rows -->
      <div v-else class="wf-list__table">
        <div
          v-for="(flujo, idx) in flujos"
          :key="flujo.id"
          class="wf-list__row"
          @click="abrirCanvas(flujo.id)"
        >
          <div class="wf-list__row-num">{{ String(idx + 1).padStart(2, '0') }}</div>

          <div class="wf-list__row-body">
            <div class="wf-list__row-top">
              <span class="wf-list__row-name">{{ flujo.nombre }}</span>
              <span
                class="wf-list__row-badge"
                :class="flujo.activo ? 'wf-list__row-badge--on' : 'wf-list__row-badge--off'"
              >{{ flujo.activo ? 'Activo' : 'Inactivo' }}</span>
            </div>
            <p v-if="flujo.descripcion" class="wf-list__row-desc">{{ flujo.descripcion }}</p>
            <div class="wf-list__row-meta">
              <q-icon name="swap_horiz" size="12px" />
              {{ flujo.transiciones_count }}
              {{ flujo.transiciones_count === 1 ? 'transición' : 'transiciones' }}
            </div>
          </div>

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
          </div>
        </div>
      </div>

    </div>

    <!-- Diálogo: Nuevo flujo -->
    <q-dialog v-model="dialogVisible" persistent>
      <q-card class="wf-list__dialog">
        <q-card-section class="wf-list__dialog-header">
          <span class="wf-list__dialog-title">Nuevo flujo de trabajo</span>
          <q-btn flat dense round icon="close" class="wf-list__dialog-close" @click="cerrarDialogo" />
        </q-card-section>
        <q-card-section class="wf-list__dialog-body q-pt-none">
          <q-input
            v-model="nuevoFlujo.nombre"
            label="Nombre *"
            autofocus
            outlined
            dense
            class="wf-list__dialog-field"
            :rules="[v => !!v || 'El nombre es obligatorio']"
            lazy-rules
          />
          <q-input
            v-model="nuevoFlujo.descripcion"
            label="Descripción"
            type="textarea"
            rows="2"
            outlined
            dense
            class="q-mt-sm wf-list__dialog-field"
          />
        </q-card-section>
        <q-card-actions align="right" class="wf-list__dialog-footer">
          <q-btn flat label="Cancelar" color="grey" no-caps @click="cerrarDialogo" />
          <q-btn
            label="Crear flujo"
            no-caps
            unelevated
            class="wf-list__dialog-submit"
            :loading="creando"
            :disable="!nuevoFlujo.nombre.trim()"
            @click="crearFlujo"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useWorkflowStore } from 'src/stores/workflow.js'

const router = useRouter()
const $q = useQuasar()
const store = useWorkflowStore()
const fileInputRef = ref(null)

const flujos = ref([])
const loading = ref(true)
const error = ref(false)

// Nuevo flujo dialog
const dialogVisible = ref(false)
const creando = ref(false)
const nuevoFlujo = ref({ nombre: '', descripcion: '' })

// Toggle activo
const togglingId = ref(null)

onMounted(async () => {
  try {
    flujos.value = await store.getFlujos()
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})

function abrirCanvas(id) {
  router.push({ name: 'workflow-canvas', params: { id } })
}

function cerrarDialogo() {
  dialogVisible.value = false
  nuevoFlujo.value = { nombre: '', descripcion: '' }
}

async function crearFlujo() {
  if (!nuevoFlujo.value.nombre.trim()) return
  creando.value = true
  try {
    const flujo = await store.createFlujo({
      nombre: nuevoFlujo.value.nombre.trim(),
      descripcion: nuevoFlujo.value.descripcion.trim(),
    })
    flujos.value.push(flujo)
    cerrarDialogo()
    $q.notify({ type: 'positive', message: 'Flujo creado', position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: 'Error al crear flujo', position: 'top' })
  } finally {
    creando.value = false
  }
}

async function toggleActivo(flujo) {
  togglingId.value = flujo.id
  try {
    const actualizado = await store.updateFlujo(flujo.id, { activo: !flujo.activo })
    const idx = flujos.value.findIndex(f => f.id === flujo.id)
    if (idx !== -1) flujos.value[idx] = { ...flujos.value[idx], activo: actualizado.activo }
  } catch {
    $q.notify({ type: 'negative', message: 'Error al actualizar flujo', position: 'top' })
  } finally {
    togglingId.value = null
  }
}

// S27.5 — File import UX
function triggerFileInput() {
  fileInputRef.value?.click()
}

async function onFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const state = await store.loadFromFile(file)
    $q.notify({
      type: 'positive',
      message: `Importado: ${state.flujo.nombre}`,
      position: 'top',
    })
    // Navigate to canvas con el flujo importado
    router.push({ name: 'workflow-canvas', params: { id: state.flujo.id } })
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: `Error al importar: ${e.message}`,
      position: 'top',
    })
  } finally {
    // Reset input para permitir re-select same file
    event.target.value = ''
  }
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Cabin:wght@400;700&display=swap');
</style>

<style scoped>
.wf-list {
  background: #f2ece5;
  min-height: 100vh;
  font-family: 'Cabin', sans-serif;
}

/* ── Hero ─────────────────────────────────────────────────────── */
.wf-list__hero {
  background: #9b2247;
  padding: 44px 48px 40px;
}

.wf-list__hero-inner {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.wf-list__eyebrow {
  display: block;
  font-family: 'Cabin', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
}

.wf-list__title {
  font-family: 'Cabin', sans-serif;
  font-size: 30px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 4px;
  line-height: 1.1;
}

.wf-list__subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.wf-list__new-btn {
  background: #a57f2c !important;
  color: #fff !important;
  font-family: 'Cabin', sans-serif;
  font-weight: 700;
  font-size: 13px;
  padding: 10px 22px;
  border-radius: 5px;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

/* ── Content ──────────────────────────────────────────────────── */
.wf-list__content {
  max-width: 900px;
  margin: 0 auto;
  padding: 36px 48px;
}

/* ── Table ────────────────────────────────────────────────────── */
.wf-list__table {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #d5cbc0;
  background: #d5cbc0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* ── Row ──────────────────────────────────────────────────────── */
.wf-list__row {
  display: flex;
  align-items: stretch;
  background: #fff;
  cursor: pointer;
  transition: background 0.12s;
}

.wf-list__row:hover {
  background: #fdf8f3;
}

.wf-list__row-num {
  width: 68px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cabin', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #a57f2c;
  background: #faf4ed;
  border-right: 1px solid #e6ddd4;
}

.wf-list__row-body {
  flex: 1;
  padding: 16px 20px;
  min-width: 0;
}

.wf-list__row-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 3px;
}

.wf-list__row-name {
  font-family: 'Cabin', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: #1e0c14;
}

.wf-list__row-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 3px;
  flex-shrink: 0;
}

.wf-list__row-badge--on {
  background: #e4f3ec;
  color: #1e5b4f;
}

.wf-list__row-badge--off {
  background: #eeebe7;
  color: #999;
}

.wf-list__row-desc {
  font-size: 12px;
  color: #8a7e76;
  margin: 0 0 5px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wf-list__row-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #9b2247;
}

.wf-list__row-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  border-left: 1px solid #e6ddd4;
}

.wf-list__row-link {
  color: #266cb4 !important;
  font-size: 12px;
  font-weight: 600;
  font-family: 'Cabin', sans-serif;
}

/* ── Skeleton ─────────────────────────────────────────────────── */
.wf-list__skeleton-row {
  display: flex;
  align-items: stretch;
  background: #fff;
  height: 76px;
}

.wf-list__skeleton-num {
  width: 68px;
  background: #f0e8e0;
}

.wf-list__skeleton-body {
  flex: 1;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
}

.wf-list__skeleton-line {
  background: linear-gradient(90deg, #ece5de 25%, #e0d8d0 50%, #ece5de 75%);
  background-size: 200% 100%;
  border-radius: 3px;
  animation: shimmer 1.4s infinite;
}

.wf-list__skeleton-line--title {
  height: 13px;
  width: 38%;
}

.wf-list__skeleton-line--sub {
  height: 10px;
  width: 20%;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* ── Empty / Error ────────────────────────────────────────────── */
.wf-list__empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 0;
  text-align: center;
}

.wf-list__empty-icon {
  color: #a57f2c;
}

.wf-list__empty-icon--error {
  color: #9b2247;
}

.wf-list__empty-label {
  font-family: 'Cabin', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: #6b5e56;
}

.wf-list__empty-hint {
  font-size: 12px;
  color: #aaa;
  margin: 0;
}

/* ── Dialog ───────────────────────────────────────────────────── */
.wf-list__dialog {
  min-width: 400px;
  border-radius: 10px;
  overflow: hidden;
  font-family: 'Cabin', sans-serif;
}

.wf-list__dialog-header {
  background: #9b2247;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px !important;
}

.wf-list__dialog-title {
  font-family: 'Cabin', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}

.wf-list__dialog-close {
  color: rgba(255, 255, 255, 0.65) !important;
}

.wf-list__dialog-body {
  padding: 20px !important;
}

.wf-list__dialog-footer {
  padding: 12px 20px !important;
  border-top: 1px solid #e8ddd2;
}

.wf-list__dialog-submit {
  background: #9b2247 !important;
  color: #fff !important;
  font-family: 'Cabin', sans-serif;
  font-weight: 700;
}
</style>
