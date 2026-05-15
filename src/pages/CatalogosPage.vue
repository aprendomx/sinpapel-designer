<template>
  <q-page class="catalogos-page">
    <div class="catalogos-page__header">
      <h1 class="catalogos-page__title">Catálogos del Workflow</h1>
      <p class="catalogos-page__subtitle">
        <template v-if="workflowName">
          Edita catálogos del flujo activo: <strong>{{ workflowName }}</strong>
        </template>
        <template v-else>
          Sin flujo activo. Crea o abre un workflow para editar catálogos.
        </template>
      </p>
    </div>

    <div v-if="workflowName" class="catalogos-page__body">
      <q-tabs
        v-model="activeTab"
        class="text-primary"
        active-color="primary"
        indicator-color="primary"
        align="left"
      >
        <q-tab name="estados" label="Estados" />
        <q-tab name="etapas" label="Etapas" />
        <q-tab name="grupos" label="Grupos" />
        <q-tab name="tipos_documento" label="Tipos Documento" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="activeTab" animated>
        <q-tab-panel name="estados">
          <CatalogoEditor catalog-key="estados" />
        </q-tab-panel>
        <q-tab-panel name="etapas">
          <CatalogoEditor catalog-key="etapas" />
        </q-tab-panel>
        <q-tab-panel name="grupos">
          <CatalogoEditor catalog-key="grupos" />
        </q-tab-panel>
        <q-tab-panel name="tipos_documento">
          <CatalogoEditor catalog-key="tipos_documento" />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <div v-else class="catalogos-page__empty">
      <q-btn
        color="primary"
        icon="account_tree"
        label="Ir a Workflows"
        @click="router.push({ name: 'workflows' })"
      />
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkflowStore } from 'src/stores/workflow.js'
import CatalogoEditor from 'src/components/CatalogoEditor.vue'

const router = useRouter()
const store = useWorkflowStore()
const activeTab = ref('estados')
const workflowName = computed(() => store.current?.flujo?.nombre || null)
</script>

<style scoped>
.catalogos-page {
  padding: 32px;
  background: #f7f3ef;
  min-height: 100vh;
  font-family: 'Cabin', sans-serif;
}
.catalogos-page__header {
  margin-bottom: 24px;
}
.catalogos-page__title {
  font-size: 24px;
  font-weight: 700;
  color: var(--sp-primary);
  margin: 0 0 6px;
}
.catalogos-page__subtitle {
  font-size: 13px;
  color: #666;
  margin: 0;
}
.catalogos-page__body {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e8e0d8;
  padding: 8px 16px 16px;
}
.catalogos-page__empty {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}
</style>
