<template>
  <q-dialog v-model="open" persistent>
    <q-card style="min-width: 480px">
      <q-card-section>
        <div class="text-h6">{{ isEdit ? 'Editar' : 'Nueva' }} condición</div>
      </q-card-section>
      <q-card-section>
        <q-form @submit.prevent="onSave" class="q-gutter-sm">
          <q-select
            v-model="form.tipo"
            label="Tipo"
            :options="TIPO_OPTIONS"
            emit-value
            map-options
            dense
          />

          <q-input
            v-if="form.tipo === 'python_path'"
            v-model="form.path"
            label="Python path"
            placeholder="modulo.submodulo.funcion"
            hint="Función con firma (instance, user) → (bool, str|None)"
            dense
          />

          <q-input
            v-else-if="form.tipo === 'json_logic'"
            v-model="form.rule_json"
            label="Regla JSON Logic"
            type="textarea"
            autogrow
            placeholder='{"==":[1,1]}'
            hint="Ver jsonlogic.com — JSON parseable, sin trailing commas"
            dense
          />

          <div v-else-if="form.tipo === 'django_orm'" class="column q-gutter-xs">
            <div class="text-caption">Lookup ORM (par campo__lookup → valor)</div>
            <div v-for="(pair, idx) in form.lookupPairs" :key="idx" class="row q-gutter-xs items-center">
              <q-input
                v-model="pair.key"
                label="campo__lookup"
                placeholder="monto__gte"
                dense
                style="flex: 1"
              />
              <q-input
                v-model="pair.value"
                label="valor"
                placeholder="100000"
                dense
                style="flex: 1"
              />
              <q-btn flat dense round icon="close" @click="removePair(idx)" />
            </div>
            <q-btn flat dense no-caps icon="add" label="Agregar par" @click="addPair" />
          </div>

          <q-input
            v-model="form.mensaje_error"
            label="Mensaje de error"
            placeholder="No cumple con las condiciones requeridas."
            dense
          />
          <q-toggle v-model="form.activo" label="Activo" />

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

const TIPO_OPTIONS = [
  { label: 'Python path', value: 'python_path' },
  { label: 'JSON Logic', value: 'json_logic' },
  { label: 'Django ORM', value: 'django_orm' },
]

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  editing: { type: Object, default: null },
  existing: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const $q = useQuasar()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const isEdit = computed(() => !!props.editing)

const form = ref(emptyForm())

// Factory (not a module-level constant) so each call returns a fresh
// lookupPairs array — avoids shared-reference bugs across dialog opens.
function emptyForm() {
  return {
    tipo: '',
    path: '',
    rule_json: '',
    lookupPairs: [{ key: '', value: '' }],
    mensaje_error: '',
    activo: true,
  }
}

watch(
  () => [props.modelValue, props.editing],
  ([modelValue, editing]) => {
    if (!modelValue) return
    if (editing) {
      const cfg = editing.configuracion || {}
      form.value = {
        tipo: editing.tipo,
        path: cfg.path ?? '',
        rule_json: cfg.rule != null ? JSON.stringify(cfg.rule, null, 2) : '',
        lookupPairs: cfg.lookup
          ? Object.entries(cfg.lookup).map(([k, v]) => ({ key: k, value: String(v) }))
          : [{ key: '', value: '' }],
        mensaje_error: editing.mensaje_error ?? '',
        activo: editing.activo ?? true,
      }
    } else {
      form.value = emptyForm()
    }
  },
  { immediate: true },
)

function addPair() {
  form.value.lookupPairs.push({ key: '', value: '' })
}

function removePair(idx) {
  form.value.lookupPairs.splice(idx, 1)
  // Keep at least one empty pair visible so the section never collapses.
  if (form.value.lookupPairs.length === 0) addPair()
}

function buildConfiguracion() {
  if (form.value.tipo === 'python_path') {
    return { path: form.value.path }
  }
  if (form.value.tipo === 'json_logic') {
    return { rule: JSON.parse(form.value.rule_json) }
  }
  if (form.value.tipo === 'django_orm') {
    const lookup = {}
    for (const p of form.value.lookupPairs) {
      // Filter out pairs missing key OR value; empty-string queries are rare
      // and almost always indicate an incomplete edit in v1 UX.
      if (p.key && p.value !== '') lookup[p.key] = p.value
    }
    return { lookup }
  }
  // Forward-compat: tipos desconocidos (futuro backend) preservan la
  // configuracion original sin alterarla.
  return props.editing?.configuracion ?? {}
}

function onSave() {
  if (!form.value.tipo) return
  let configuracion
  try {
    configuracion = buildConfiguracion()
  } catch (e) {
    $q?.notify({
      type: 'negative',
      message: `JSON inválido: ${e.message}`,
      position: 'top',
    })
    return
  }
  const condicion = {
    tipo: form.value.tipo,
    configuracion,
    mensaje_error: form.value.mensaje_error,
    orden: props.editing?.orden ?? props.existing.length,
    activo: form.value.activo,
  }
  emit('saved', condicion)
  emit('update:modelValue', false)
}
</script>
