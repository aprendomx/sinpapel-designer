<template>
  <q-page class="ai-page">
    <div class="ai-page__header">
      <h1 class="ai-page__title">Generador IA</h1>
      <p class="ai-page__subtitle">Describe el flujo en lenguaje natural y obtén un JSON v0.2 listo para aplicar.</p>
      <q-btn flat dense icon="settings" aria-label="Configurar IA" label="Settings" @click="settingsOpen = true" />
    </div>

    <div class="ai-page__body">
      <div class="ai-page__input">
        <q-input
          v-model="prompt"
          label="Describe el flujo a generar"
          type="textarea"
          rows="10"
          outlined
          placeholder="Ejemplo: Trámite de afiliación al IMSS con 4 estados (inicio, validación, aprobación, completado), 2 grupos (validador, aprobador), un documento INE requerido al validar."
        />
        <q-btn
          color="primary"
          icon="auto_awesome"
          label="Generar"
          aria-label="Generar"
          :loading="loading"
          :disable="!prompt.trim() || loading"
          @click="onGenerate"
        />
      </div>

      <div class="ai-page__output">
        <div v-if="loading" class="ai-page__loading">
          <q-spinner-dots color="primary" size="32px" />
          <span>Generando…</span>
        </div>
        <div v-else-if="error" class="ai-page__error">
          <q-icon name="error_outline" size="22px" />
          <span>{{ error }}</span>
          <pre v-if="rawResponse" class="ai-page__raw">{{ rawResponse }}</pre>
          <q-btn flat label="Reintentar" @click="onGenerate" />
        </div>
        <AiGeneratorPreview
          v-else
          :result="parsed"
          :validation-warnings="warnings"
        >
          <template #actions>
            <div v-if="parsed" class="row q-gutter-sm justify-end">
              <q-btn flat label="Descartar" aria-label="Descartar" @click="onDiscard" />
              <q-btn color="primary" icon="check" label="Aplicar" aria-label="Aplicar" @click="onApply" />
            </div>
          </template>
        </AiGeneratorPreview>
      </div>
    </div>

    <AiSettingsDialog v-model="settingsOpen" />
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import {
  generate,
  MissingApiKeyError,
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from 'src/services/llmService.js'
import { validateSchema, parseV0_2, serializeV0_2 } from 'src/data/schema-v0_2.js'
import { useWorkflowStore } from 'src/stores/workflow.js'
import { useAiSettingsStore } from 'src/stores/aiSettings.js'
import AiSettingsDialog from 'src/components/AiSettingsDialog.vue'
import AiGeneratorPreview from 'src/components/AiGeneratorPreview.vue'

const router = useRouter()
const $q = useQuasar()
const store = useWorkflowStore()
const aiSettings = useAiSettingsStore()

const prompt = ref('')
const loading = ref(false)
const error = ref(null)
const rawResponse = ref(null)
const parsed = ref(null)
const warnings = ref([])
const settingsOpen = ref(false)

function extractJson(text) {
  if (!text) return null
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

function computeWarnings(state) {
  const out = []
  const tipoDocs = new Set((state.tipos_documento || []).map((t) => t.nombre))
  const knownTipos = new Set(['python_path', 'json_logic', 'django_orm'])

  state.transiciones?.forEach((t, ti) => {
    t.condiciones?.forEach((c, ci) => {
      if (!knownTipos.has(c.tipo)) {
        out.push(`Transición ${ti + 1}, condición ${ci + 1}: tipo '${c.tipo}' no soportado por el designer.`)
      }
      if (c.tipo === 'json_logic') {
        try {
          if (typeof c.configuracion?.rule === 'string') JSON.parse(c.configuracion.rule)
        } catch {
          out.push(`Transición ${ti + 1}, condición ${ci + 1}: regla json_logic no parseable.`)
        }
      }
      if (c.tipo === 'python_path' && !c.configuracion?.path) {
        out.push(`Transición ${ti + 1}, condición ${ci + 1}: python_path con path vacío.`)
      }
      if (c.tipo === 'django_orm' && !Object.keys(c.configuracion?.lookup || {}).length) {
        out.push(`Transición ${ti + 1}, condición ${ci + 1}: django_orm sin lookup.`)
      }
    })
  })

  state.requisitos?.forEach((r, ri) => {
    if (!tipoDocs.has(r.tipo_documento)) {
      out.push(`Requisito ${ri + 1}: tipo_documento '${r.tipo_documento}' no existe en catálogos.`)
    }
  })

  return out
}

async function onGenerate() {
  error.value = null
  rawResponse.value = null
  parsed.value = null
  warnings.value = []
  loading.value = true
  try {
    if (!aiSettings.hasApiKey()) {
      throw new MissingApiKeyError(aiSettings.provider)
    }
    const text = await generate(prompt.value)
    rawResponse.value = text
    const jsonStr = extractJson(text)
    if (!jsonStr) {
      throw new Error('La respuesta no contiene un objeto JSON reconocible.')
    }
    const json = JSON.parse(jsonStr)
    validateSchema(json)
    const state = parseV0_2(json)
    parsed.value = state
    warnings.value = computeWarnings(state)
  } catch (e) {
    if (e instanceof MissingApiKeyError) {
      settingsOpen.value = true
      $q?.notify({ type: 'warning', message: 'Configura tu API key primero.', position: 'top' })
    } else if (e instanceof ApiAuthError) {
      error.value = 'API key inválida o sin permisos.'
      settingsOpen.value = true
    } else if (e instanceof ApiRateLimitError) {
      error.value = 'Demasiadas requests al provider. Espera unos segundos.'
    } else if (e instanceof ApiNetworkError) {
      error.value = 'Sin conexión al provider.'
    } else if (e instanceof ApiResponseError) {
      error.value = `Error del provider (${e.status || 'desconocido'}): ${e.message}`
    } else {
      error.value = e.message || 'Error al procesar la respuesta del LLM.'
    }
  } finally {
    loading.value = false
  }
}

function onDiscard() {
  parsed.value = null
  warnings.value = []
  rawResponse.value = null
  error.value = null
}

async function onApply() {
  if (!parsed.value) return
  try {
    // Reconstruir el JSON v0.2 desde el state interno y pasarlo como File a loadFromFile
    const json = serializeV0_2(parsed.value)
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
    const file = new File([blob], 'ai-generated.json', { type: 'application/json' })
    const newState = await store.loadFromFile(file)
    $q?.notify({ type: 'positive', message: 'Flujo aplicado', position: 'top' })
    router.push({ name: 'workflow-canvas', params: { id: newState.flujo.id } })
  } catch (e) {
    $q?.notify({ type: 'negative', message: e?.message || 'No se pudo aplicar el flujo', position: 'top' })
  }
}
</script>

<style scoped>
.ai-page {
  padding: 24px;
  background: #f7f3ef;
  min-height: 100vh;
  font-family: 'Cabin', sans-serif;
}

.ai-page__header {
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-page__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--sp-primary);
  margin: 0;
  flex: 1;
}

.ai-page__subtitle {
  font-size: 12px;
  color: #888;
  margin: 0;
  flex: 1;
}

.ai-page__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.ai-page__input {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-page__output {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e8e0d8;
  min-height: 300px;
}

.ai-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  gap: 12px;
  color: #888;
}

.ai-page__error {
  padding: 18px;
  color: var(--sp-primary);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-page__raw {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  font-size: 11px;
  max-height: 240px;
  overflow: auto;
}
</style>
