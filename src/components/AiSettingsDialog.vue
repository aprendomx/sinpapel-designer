<template>
  <q-dialog v-model="open" persistent>
    <q-card style="min-width: 460px">
      <q-card-section>
        <div class="text-h6">Configurar generador IA</div>
        <div class="text-caption text-grey-7">
          Tu API key se almacena localmente en este navegador. No la compartas.
          No la uses en computadoras públicas.
        </div>
      </q-card-section>
      <q-card-section>
        <q-form @submit.prevent="onSave" class="q-gutter-sm">
          <q-select
            v-model="form.provider"
            label="Provider"
            :options="PROVIDER_OPTIONS"
            emit-value
            map-options
            dense
          />
          <q-select
            v-model="form.model"
            label="Modelo"
            :options="modelOptionsForProvider"
            emit-value
            map-options
            dense
          />
          <q-input
            v-model="form.apiKeys.anthropic"
            label="Anthropic API key"
            :type="showAnthropic ? 'text' : 'password'"
            dense
          >
            <template #append>
              <q-btn flat dense round :icon="showAnthropic ? 'visibility_off' : 'visibility'" @click="showAnthropic = !showAnthropic" />
            </template>
          </q-input>
          <q-input
            v-model="form.apiKeys.openai"
            label="OpenAI API key"
            :type="showOpenai ? 'text' : 'password'"
            dense
          >
            <template #append>
              <q-btn flat dense round :icon="showOpenai ? 'visibility_off' : 'visibility'" @click="showOpenai = !showOpenai" />
            </template>
          </q-input>
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
import { useAiSettingsStore } from 'src/stores/aiSettings.js'

const PROVIDER_OPTIONS = [
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
]

const MODEL_OPTIONS = {
  anthropic: [
    { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
    { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
  ],
  openai: [
    { label: 'GPT-5', value: 'gpt-5' },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  ],
}

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const store = useAiSettingsStore()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const showAnthropic = ref(false)
const showOpenai = ref(false)

const form = ref({
  provider: store.provider,
  model: store.model,
  apiKeys: { ...store.apiKeys },
})

const modelOptionsForProvider = computed(() => MODEL_OPTIONS[form.value.provider] || [])

watch(
  () => props.modelValue,
  (modelValue) => {
    if (modelValue) {
      form.value = {
        provider: store.provider,
        model: store.model,
        apiKeys: { ...store.apiKeys },
      }
    }
  },
)

watch(
  () => form.value.provider,
  (newProvider) => {
    const opts = MODEL_OPTIONS[newProvider] || []
    if (opts.length > 0 && !opts.some((o) => o.value === form.value.model)) {
      form.value.model = opts[0].value
    }
  },
)

function onSave() {
  store.setProvider(form.value.provider)
  store.setModel(form.value.model)
  store.setApiKey('anthropic', form.value.apiKeys.anthropic)
  store.setApiKey('openai', form.value.apiKeys.openai)
  emit('update:modelValue', false)
}
</script>
