<template>
  <q-dialog v-model="open" persistent>
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">{{ isEdit ? 'Editar' : 'Nuevo' }} requisito documental</div>
        <div class="text-caption text-grey-7">Estado destino: <strong>{{ estadoNombre }}</strong></div>
      </q-card-section>
      <q-card-section>
        <q-form @submit.prevent="onSave" class="q-gutter-sm">
          <q-select
            v-model="form.tipo_documento"
            label="Tipo Documento"
            :options="tipoDocOptions"
            emit-value
            map-options
            :disable="isEdit"
            dense
          />
          <q-input
            v-model.number="form.porcentaje"
            label="Porcentaje (0-100)"
            type="number"
            min="0"
            max="100"
            dense
          />
          <q-toggle v-model="form.auto_carga" label="Auto carga" />
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
import { useQuasar } from 'quasar'
import { useWorkflowStore } from 'src/stores/workflow.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  editing: { type: Object, default: null },
  estadoNombre: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const store = useWorkflowStore()
const $q = useQuasar()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const isEdit = computed(() => !!props.editing)

const tipoDocOptions = computed(() =>
  (store.current?.tipos_documento || []).map((t) => ({ label: t.nombre, value: t.nombre })),
)

const form = ref({ tipo_documento: '', porcentaje: 100, auto_carga: false })

watch(
  () => [props.modelValue, props.editing],
  ([modelValue, editing]) => {
    if (!modelValue) return
    form.value = editing
      ? {
          tipo_documento: editing.tipo_documento,
          porcentaje: editing.porcentaje,
          auto_carga: editing.auto_carga,
        }
      : { tipo_documento: '', porcentaje: 100, auto_carga: false }
  },
  { immediate: true },
)

function onSave() {
  if (!form.value.tipo_documento) return
  const porcentaje = Math.max(0, Math.min(100, Number(form.value.porcentaje) || 0))
  try {
    if (isEdit.value) {
      store.updateRequisito(props.estadoNombre, props.editing.tipo_documento, {
        porcentaje,
        auto_carga: form.value.auto_carga,
      })
    } else {
      store.addRequisito(props.estadoNombre, {
        tipo_documento: form.value.tipo_documento,
        porcentaje,
        auto_carga: form.value.auto_carga,
      })
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) {
    $q?.notify({
      type: 'negative',
      message: e?.message || 'No se pudo guardar el requisito',
      position: 'top',
    })
  }
}
</script>
