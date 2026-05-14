<template>
  <q-dialog v-model="open" persistent>
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">Eliminar {{ config.label }}</div>
      </q-card-section>
      <q-card-section>
        <p>
          ¿Eliminar <strong>{{ name }}</strong>?
        </p>
        <p class="text-caption">{{ refsLabel }}</p>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancelar" v-close-popup />
        <q-btn color="negative" label="Eliminar" @click="onDelete" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { useWorkflowStore } from 'src/stores/workflow.js'
import { CATALOGO_CONFIGS } from 'src/data/catalogo-fields.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  catalogKey: { type: String, required: true },
  target: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'deleted'])

const store = useWorkflowStore()
const config = computed(() => CATALOGO_CONFIGS[props.catalogKey])

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const name = computed(() =>
  props.target ? props.target[config.value.nameField] : '',
)

const refsLabel = computed(() => {
  if (!props.target) return ''
  const refs = store[config.value.findRefs](name.value)
  return config.value.refLabel(refs)
})

function onDelete() {
  store[config.value.removeAction](props.target.id)
  emit('deleted')
  emit('update:modelValue', false)
}
</script>
