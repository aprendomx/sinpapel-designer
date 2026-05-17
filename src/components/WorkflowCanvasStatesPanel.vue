<template>
  <transition name="panel-slide">
    <div v-if="editMode" class="wf-canvas-page__states-panel">
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
      <div class="wf-states__filter">
        <q-input
          v-model="filtro"
          dense
          borderless
          placeholder="Filtrar estados…"
          class="wf-states__filter-input"
        >
          <template #prepend>
            <q-icon name="search" size="14px" style="color: rgba(255,255,255,0.4)" />
          </template>
          <template v-if="filtro" #append>
            <q-icon
              name="close"
              size="14px"
              style="color: rgba(255,255,255,0.4); cursor: pointer"
              @click="filtro = ''"
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
          @dragstart="onDragStart($event, estado)"
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
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  estados: { type: Array, default: () => [] },
  idsEnCanvas: { type: Set, default: () => new Set() },
  editMode: { type: Boolean, default: false },
})

const emit = defineEmits(['drag-start', 'create'])

const filtro = ref('')

const estadosFiltrados = computed(() => {
  const termino = filtro.value.toLowerCase().trim()
  let lista = props.estados
  if (termino) {
    lista = lista.filter(e =>
      e.nombre.toLowerCase().includes(termino) ||
      (e.descripcion && e.descripcion.toLowerCase().includes(termino))
    )
  }
  return lista
})

function onDragStart(event, estado) {
  if (props.idsEnCanvas.has(String(estado.id))) {
    event.preventDefault()
    return
  }
  emit('drag-start', event, estado)
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

.wf-canvas-page__states-panel {
  width: 210px;
  flex-shrink: 0;
  border-right: 2px solid var(--sp-primary-dark);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--sp-sidebar-bg) !important;
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
  color: var(--sp-sidebar-text);
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
  border-left: 3px solid var(--sp-secondary);
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
  border-left-color: var(--sp-secondary-light);
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
  border-left-color: var(--sp-success);
}

.wf-states__chip--en-canvas:hover {
  background-color: rgba(255, 255, 255, 0.09);
  border-left-color: var(--sp-success);
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

.wf-states__create-btn {
  color: rgba(255, 255, 255, 0.7) !important;
}

.wf-states__create-btn:hover {
  color: #fff !important;
}
</style>
