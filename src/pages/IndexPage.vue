<template>
  <q-page class="q-pa-md smoke-page">
    <h1 class="text-h5 q-mb-md">Sinpapel Designer — Smoke Test</h1>

    <p class="text-body2 q-mb-sm">
      Stack: Vue 3 + Quasar 2 + Vue Flow loaded.
    </p>

    <p class="text-caption text-grey q-mb-md">
      S27.1 T2 — valida coexistencia Vue Flow + Quasar. Branding visual diferido a S27.4.
    </p>

    <div data-testid="smoke-btn-wrap" class="q-mb-md">
      <q-btn label="Quasar OK" color="primary" icon="check" />
    </div>

    <div
      data-testid="smoke-canvas-wrap"
      class="smoke-canvas-wrap"
      style="height: 360px; border: 1px solid #ddd; border-radius: 6px;"
    >
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :default-viewport="{ x: 0, y: 0, zoom: 1 }"
        fit-view-on-init
      >
        <Background pattern-color="#aaa" :gap="20" />
        <Controls />
        <MiniMap />
      </VueFlow>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'

const nodes = ref([
  { id: '1', type: 'default', position: { x: 50, y: 50 }, data: { label: 'Estado A' } },
  { id: '2', type: 'default', position: { x: 300, y: 200 }, data: { label: 'Estado B' } },
])

const edges = ref([
  { id: 'e1-2', source: '1', target: '2', label: 'transición demo' },
])
</script>

<style scoped>
.smoke-page {
  max-width: 900px;
}

.smoke-canvas-wrap {
  background: #fafafa;
}
</style>
