<template>
  <div class="catalogo-editor">
    <div class="row items-center q-mb-md">
      <div class="text-h6">{{ config.labelPlural }}</div>
      <q-space />
      <q-btn
        color="primary"
        icon="add"
        :label="`Nuevo ${config.label}`"
        @click="openCreate"
      />
    </div>
    <q-table
      :rows="rows"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :pagination="{ rowsPerPage: 10 }"
      :no-data-label="`Sin ${config.labelPlural.toLowerCase()}`"
    >
      <template #body-cell-actions="props">
        <q-td :props="props" class="q-gutter-xs">
          <q-btn flat dense icon="edit" @click="openEdit(props.row)" />
          <q-btn flat dense icon="delete" color="negative" @click="openDelete(props.row)" />
        </q-td>
      </template>
      <template #body-cell-color="props">
        <q-td :props="props">
          <div class="row items-center q-gutter-xs">
            <div
              :style="{ background: props.value, width: '20px', height: '20px', borderRadius: '4px', border: '1px solid #ccc' }"
            />
            <span class="text-caption">{{ props.value }}</span>
          </div>
        </q-td>
      </template>
      <template #body-cell-etapa="props">
        <q-td :props="props">
          <q-chip
            v-if="props.value"
            dense
            square
            color="grey-3"
            text-color="grey-9"
            :label="props.value"
          />
          <span v-else class="text-grey-6">—</span>
        </q-td>
      </template>
    </q-table>
    <CatalogoFormDialog
      v-model="formOpen"
      :catalog-key="catalogKey"
      :editing="editing"
    />
    <CatalogoDeleteDialog
      v-model="deleteOpen"
      :catalog-key="catalogKey"
      :target="deleting"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useWorkflowStore } from 'src/stores/workflow.js'
import { CATALOGO_CONFIGS } from 'src/data/catalogo-fields.js'
import CatalogoFormDialog from './CatalogoFormDialog.vue'
import CatalogoDeleteDialog from './CatalogoDeleteDialog.vue'

const props = defineProps({
  catalogKey: { type: String, required: true },
})

const store = useWorkflowStore()
const config = computed(() => CATALOGO_CONFIGS[props.catalogKey])
const rows = computed(() => store.current?.[config.value.storeKey] || [])

const columns = computed(() => {
  const cols = config.value.fields
    .filter((f) => ['text', 'color', 'number', 'toggle', 'select-etapa'].includes(f.type))
    .map((f) => ({
      name: f.name,
      label: f.label,
      field: f.name,
      align: 'left',
      sortable: f.type !== 'toggle',
    }))
  cols.push({ name: 'actions', label: 'Acciones', align: 'right' })
  return cols
})

const formOpen = ref(false)
const editing = ref(null)
const deleteOpen = ref(false)
const deleting = ref(null)

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(row) {
  editing.value = row
  formOpen.value = true
}
function openDelete(row) {
  deleting.value = row
  deleteOpen.value = true
}
</script>
