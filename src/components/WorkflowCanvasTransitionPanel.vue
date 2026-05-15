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

      <button class="wf-panel__delete-btn" @click="$emit('delete-edge', selectedEdge)">
        <q-icon name="delete_outline" size="15px" />
        Eliminar transición
      </button>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  selectedEdge: { type: Object, default: null },
  gruposOptions: { type: Array, default: () => [] },
  editMode: { type: Boolean, default: false },
})

const emit = defineEmits(['update:selected-edge-grupos', 'grupos-change', 'delete-edge'])

const localGrupos = computed({
  get: () => props.selectedEdge?.data?.grupos_ids ?? [],
  set: (val) => emit('update:selected-edge-grupos', val),
})
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
  width: 268px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid var(--sp-border);
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
  padding: 0 16px;
  flex-shrink: 0;
}

.wf-panel__field-hint {
  font-size: 11px;
  color: var(--sp-text-placeholder);
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
  color: var(--sp-primary);
  padding: 8px 12px;
  transition: background 0.12s;
  flex-shrink: 0;
}

.wf-panel__delete-btn:hover {
  background: #fdf0f4;
}
</style>
