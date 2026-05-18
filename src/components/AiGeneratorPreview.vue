<template>
  <q-card v-if="result" class="ai-preview">
    <q-card-section>
      <div class="text-h6">{{ result.flujo?.nombre || '(sin nombre)' }}</div>
      <div class="text-caption text-grey-7">{{ result.flujo?.descripcion || '' }}</div>
    </q-card-section>

    <q-card-section>
      <div class="row q-gutter-md">
        <div class="ai-preview__stat"><strong>{{ counts.estados }}</strong> estados</div>
        <div class="ai-preview__stat"><strong>{{ counts.etapas }}</strong> etapas</div>
        <div class="ai-preview__stat"><strong>{{ counts.grupos }}</strong> grupos</div>
        <div class="ai-preview__stat"><strong>{{ counts.tipos_documento }}</strong> tipos doc</div>
        <div class="ai-preview__stat"><strong>{{ counts.transiciones }}</strong> transiciones</div>
        <div class="ai-preview__stat"><strong>{{ counts.condiciones }}</strong> condiciones</div>
        <div class="ai-preview__stat"><strong>{{ counts.requisitos }}</strong> requisito{{ counts.requisitos === 1 ? '' : 's' }}</div>
      </div>
    </q-card-section>

    <q-card-section v-if="validationWarnings.length > 0" class="ai-preview__warnings">
      <div class="text-subtitle2 q-mb-xs">
        <q-icon name="warning" size="16px" /> Avisos
      </div>
      <ul>
        <li v-for="(w, idx) in validationWarnings" :key="idx">{{ w }}</li>
      </ul>
    </q-card-section>

    <q-card-section>
      <div class="text-subtitle2">Tipos de documento</div>
      <div class="row q-gutter-xs">
        <q-chip v-for="t in (result.tipos_documento || [])" :key="t.id" dense square>{{ t.nombre }}</q-chip>
      </div>
    </q-card-section>

    <q-card-section>
      <details>
        <summary class="text-caption">Ver JSON completo</summary>
        <pre class="ai-preview__json">{{ JSON.stringify(result, null, 2) }}</pre>
      </details>
    </q-card-section>

    <q-card-section>
      <slot name="actions" />
    </q-card-section>
  </q-card>
  <div v-else class="ai-preview__empty">
    Sin resultado todavía. Escribe una descripción y genera.
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  result: { type: Object, default: null },
  validationWarnings: { type: Array, default: () => [] },
})

const counts = computed(() => {
  const r = props.result || {}
  const transiciones = r.transiciones || []
  return {
    estados: (r.estados || []).length,
    etapas: (r.etapas || []).length,
    grupos: (r.grupos || []).length,
    tipos_documento: (r.tipos_documento || []).length,
    transiciones: transiciones.length,
    condiciones: transiciones.reduce((acc, t) => acc + (t.condiciones?.length || 0), 0),
    requisitos: (r.requisitos || []).length,
  }
})
</script>

<style scoped>
.ai-preview {
  font-family: 'Cabin', sans-serif;
}

.ai-preview__stat {
  background: #faf5ef;
  border: 1px solid #e8e0d8;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #6b5e56;
}

.ai-preview__warnings {
  background: #fff7e0;
  border-left: 3px solid #c89000;
}

.ai-preview__warnings ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #7a5a00;
}

.ai-preview__json {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  font-size: 11px;
  font-family: monospace;
  max-height: 360px;
  overflow: auto;
}

.ai-preview__empty {
  padding: 40px 24px;
  text-align: center;
  font-size: 13px;
  color: #aaa;
  font-style: italic;
}
</style>
