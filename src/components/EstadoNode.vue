<template>
  <Handle type="target" :position="Position.Top" />
  <div class="estado-node" :style="{ '--node-accent': data?.color || '#9b2247' }">
    <div class="estado-node__bar" :style="{ background: data?.color || '#9b2247' }"></div>
    <div class="estado-node__inner">
      <span
        class="material-icons estado-node__icon"
        :style="{ color: data?.color || '#9b2247' }"
      >{{ data?.icono || 'circle' }}</span>
      <span class="estado-node__label">{{ label }}</span>
    </div>
  </div>
  <Handle type="source" :position="Position.Bottom" />
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'

defineProps(['data', 'label'])
</script>

<style scoped>
.estado-node {
  background: #fff;
  border: 1.5px solid #e0d5cc;
  border-radius: 8px;
  min-width: 152px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  font-family: 'Cabin', sans-serif;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.estado-node__bar {
  height: 4px;
  width: 100%;
}

.estado-node__inner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  justify-content: center;
}

.estado-node__icon {
  font-size: 16px;
  flex-shrink: 0;
}

.estado-node__label {
  font-family: 'Cabin', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #1e0c14;
  white-space: nowrap;
  letter-spacing: 0.01em;
}
</style>

<!-- Global styles: handle visibility + node overflow fix -->
<style>
.vue-flow__node-estado {
  overflow: visible !important;
}

.vue-flow__node-estado .vue-flow__handle {
  width: 14px !important;
  height: 14px !important;
  background: #e6d194 !important;
  border: 3px solid #9b2247 !important;
  border-radius: 50% !important;
  opacity: 1 !important;
  visibility: visible !important;
  z-index: 100 !important;
  cursor: crosshair !important;
}

.vue-flow__node-estado .vue-flow__handle:hover {
  background: #f08217 !important;
  border-color: #7a1836 !important;
  transform: scale(1.25);
  transition: transform 0.12s, background 0.12s;
}
</style>
