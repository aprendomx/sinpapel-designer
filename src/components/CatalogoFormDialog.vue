<template>
  <q-dialog v-model="open" persistent>
    <q-card style="min-width: 480px">
      <q-card-section>
        <div class="text-h6">{{ isEdit ? 'Editar' : 'Nuevo' }} {{ config.label }}</div>
      </q-card-section>
      <q-card-section>
        <q-form @submit.prevent="onSave" class="q-gutter-sm">
          <template v-for="f in config.fields" :key="f.name">
            <q-input
              v-if="f.type === 'text'"
              v-model="form[f.name]"
              :label="f.label"
              :rules="f.required ? [(v) => !!v || `${f.label} es requerido`] : []"
              dense
            />
            <q-input
              v-else-if="f.type === 'textarea'"
              v-model="form[f.name]"
              :label="f.label"
              type="textarea"
              autogrow
              dense
            />
            <q-input
              v-else-if="f.type === 'number'"
              v-model.number="form[f.name]"
              :label="f.label"
              type="number"
              dense
            />
            <div v-else-if="f.type === 'color'" class="row items-center q-gutter-sm">
              <label class="text-caption">{{ f.label }}</label>
              <input type="color" v-model="form[f.name]" />
              <span class="text-caption">{{ form[f.name] }}</span>
            </div>
            <q-toggle
              v-else-if="f.type === 'toggle'"
              v-model="form[f.name]"
              :label="f.label"
            />
            <q-select
              v-else-if="f.type === 'select-etapa'"
              v-model="form[f.name]"
              :label="f.label"
              :options="etapaOptions"
              emit-value
              map-options
              clearable
              dense
              :hint="etapaOptions.length === 0 ? 'Crear Etapa primero (opcional)' : ''"
            />
          </template>
          <div class="row q-gutter-sm justify-end">
            <q-btn flat label="Cancelar" v-close-popup />
            <q-btn color="primary" label="Guardar" type="submit" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useWorkflowStore } from 'src/stores/workflow.js'
import { CATALOGO_CONFIGS, defaultsFor } from 'src/data/catalogo-fields.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  catalogKey: { type: String, required: true },
  editing: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const store = useWorkflowStore()
const config = computed(() => CATALOGO_CONFIGS[props.catalogKey])
const isEdit = computed(() => !!props.editing)

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const form = ref({})

watch(
  () => [props.modelValue, props.editing, props.catalogKey],
  ([modelValue]) => {
    if (modelValue) {
      form.value = props.editing
        ? { ...props.editing }
        : defaultsFor(props.catalogKey)
    }
  },
  { immediate: true },
)

const etapaOptions = computed(() =>
  (store.current?.etapas || []).map((e) => ({ label: e.nombre, value: e.nombre })),
)

function onSave() {
  const cfg = config.value
  const nameField = cfg.nameField
  if (!form.value[nameField]) return
  if (isEdit.value) {
    store[cfg.updateAction](props.editing.id, { ...form.value })
  } else {
    store[cfg.addAction]({ ...form.value })
  }
  emit('saved')
  emit('update:modelValue', false)
}
</script>
