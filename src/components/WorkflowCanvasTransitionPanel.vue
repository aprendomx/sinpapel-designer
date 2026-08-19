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

      <!-- Firma electrónica (sinpapel 0.8.x: ConfiguracionTransicion.requiere_firma) -->
      <div class="wf-panel__section-header" data-testid="firma-section">
        <span class="wf-panel__field-label">Firma electrónica</span>
        <q-toggle
          :model-value="requiereFirma"
          size="sm"
          data-testid="requiere-firma-toggle"
          aria-label="Requiere firma electrónica"
          @update:model-value="$emit('requiere-firma-change', $event)"
        />
      </div>
      <p class="wf-panel__field-hint">
        {{ requiereFirma
          ? 'El motor exigirá firma_payload para ejecutar esta transición.'
          : 'La transición no exige firma electrónica.' }}
      </p>

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
        <!-- TODO drag-to-reorder pendiente (spec §3a). v1 sólo permite reorden vía borrar+recrear. -->
        <div
          v-for="(c, idx) in condiciones"
          :key="`${c.tipo}-${c.orden}-${idx}`"
          class="wf-panel__row"
          @click="openCondicionDialog(c, idx)"
        >
          <q-chip dense square :class="tipoClass(c.tipo)">{{ c.tipo }}</q-chip>
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
      <div class="wf-panel__section-header" data-testid="requisitos-section">
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
  'requiere-firma-change',
])

const store = useWorkflowStore()

const localGrupos = computed({
  get: () => props.selectedEdge?.data?.grupos_ids ?? [],
  set: (val) => emit('update:selected-edge-grupos', val),
})

const condiciones = computed(() => props.selectedEdge?.data?.condiciones ?? [])

const requiereFirma = computed(
  () => props.selectedEdge?.data?.requiere_firma ?? false,
)

const requisitos = computed(() => {
  const destino = props.selectedEdge?.data?.destino_nombre
  if (!destino) return []
  return store.getRequisitosForEstado(destino)
})

const KNOWN_TIPOS = new Set(['python_path', 'json_logic', 'django_orm'])

function tipoClass(tipo) {
  return KNOWN_TIPOS.has(tipo) ? `wf-panel__tipo-${tipo}` : 'wf-panel__tipo-unknown'
}

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
  // Store autosalva; nada que propagar.
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
.wf-panel__tipo-unknown { background: #eee !important; color: #666 !important; }

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
