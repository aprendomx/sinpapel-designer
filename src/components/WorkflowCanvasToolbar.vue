<template>
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
          @click="$emit('discard')"
        />
        <q-btn
          unelevated no-caps
          label="Guardar"
          icon="save"
          class="wf-canvas-page__btn-save"
          :loading="saving"
          @click="$emit('save')"
        />
      </template>
      <q-toggle
        v-model="localEditMode"
        label="Editar"
        color="primary"
        left-label
        class="wf-canvas-page__edit-toggle"
        :disable="saving"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  flujo: { type: Object, default: null },
  editMode: { type: Boolean, default: false },
  isDirty: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['update:editMode', 'discard', 'save'])

const router = useRouter()

const localEditMode = computed({
  get: () => props.editMode,
  set: (val) => emit('update:editMode', val),
})
</script>

<style scoped>
.wf-canvas-page__header {
  padding: 14px 28px;
  background: #fff;
  border-bottom: 2px solid var(--sp-border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  transition: border-color 0.2s;
}

.wf-canvas-page__header--edit {
  border-bottom-color: var(--sp-primary);
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
  color: var(--sp-primary);
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
  color: var(--sp-text);
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
  background: var(--sp-success-bg);
  color: var(--sp-success);
}

.wf-canvas-page__status-badge--off {
  background: #eeebe7;
  color: #999;
}

.wf-canvas-page__desc {
  font-size: 11px;
  color: var(--sp-text-muted);
  margin: 2px 0 0;
}

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
  background: var(--sp-warn);
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
  background: var(--sp-primary) !important;
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
</style>
