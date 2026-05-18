# Generador IA de flujos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir al usuario describir en lenguaje natural un flujo y obtener un JSON v0.2 generado por LLM (Anthropic u OpenAI), previsualizarlo con validación, y aplicarlo como un flujo nuevo en el designer.

**Architecture:** 100% client-side. Pinia store guarda settings (provider, model, API keys) en localStorage. `llmService` despacha a adapters thin (`anthropic`, `openai`) que llaman directo a la API REST desde el browser. `AiGeneratorPage` orquesta el flujo: prompt → llmService → validación schema → preview → `store.loadFromFile`.

**Tech Stack:** Vue 3 `<script setup>`, Quasar, Pinia, vitest + `@vue/test-utils`. APIs: `fetch` nativo. Sin nuevas dependencias.

**Spec:** `docs/superpowers/specs/2026-05-17-generador-ia-design.md`

---

## File Structure

**Create:**
- `src/stores/aiSettings.js` — store con provider/model/apiKeys.
- `src/services/llmService.js` — entry point + clases de error.
- `src/services/llmAdapters/anthropic.js` — adapter Anthropic Messages API.
- `src/services/llmAdapters/openai.js` — adapter OpenAI Chat Completions API.
- `src/services/llmPrompts/workflowGenerator.js` — prompt builder con schema + few-shot.
- `src/components/AiSettingsDialog.vue` — dialog config keys/provider/model.
- `src/components/AiGeneratorPreview.vue` — preview con counts + warnings + JSON.
- `src/pages/AiGeneratorPage.vue` — page orquestadora.
- 8 archivos de tests (uno por unidad).

**Modify:**
- `src/router/routes.js` — añadir ruta `ai-generator`.
- `src/layouts/MainLayout.vue` — añadir entry de nav.

**Sin cambios:** schema v0.2, store de workflow, backend.

---

## Task 1: aiSettings store

**Files:**
- Create: `src/stores/aiSettings.js`
- Test: `tests/ai-settings-store.test.js`

- [ ] **Step 1.1: Test que falla**

Crear `tests/ai-settings-store.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAiSettingsStore } from '../src/stores/aiSettings.js'

describe('aiSettings store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('default provider es anthropic con modelo claude-sonnet-4-6', () => {
    const store = useAiSettingsStore()
    expect(store.provider).toBe('anthropic')
    expect(store.model).toBe('claude-sonnet-4-6')
    expect(store.apiKeys).toEqual({ anthropic: '', openai: '' })
  })

  it('setApiKey actualiza por provider y persiste a localStorage', () => {
    const store = useAiSettingsStore()
    store.setApiKey('anthropic', 'sk-ant-XXX')
    expect(store.apiKeys.anthropic).toBe('sk-ant-XXX')
    const raw = localStorage.getItem('sinpapel-designer/ai-settings')
    expect(JSON.parse(raw).apiKeys.anthropic).toBe('sk-ant-XXX')
  })

  it('setProvider cambia y resetea model al default del provider', () => {
    const store = useAiSettingsStore()
    store.setProvider('openai')
    expect(store.provider).toBe('openai')
    expect(store.model).toBe('gpt-5')
    store.setProvider('anthropic')
    expect(store.model).toBe('claude-sonnet-4-6')
  })

  it('hasApiKey y currentApiKey reflejan el provider activo', () => {
    const store = useAiSettingsStore()
    expect(store.hasApiKey()).toBe(false)
    store.setApiKey('anthropic', 'sk-ant')
    expect(store.hasApiKey()).toBe(true)
    expect(store.currentApiKey()).toBe('sk-ant')
    store.setProvider('openai')
    expect(store.hasApiKey()).toBe(false)
    store.setApiKey('openai', 'sk-openai')
    expect(store.currentApiKey()).toBe('sk-openai')
  })

  it('rehidrata desde localStorage al instanciar', () => {
    localStorage.setItem('sinpapel-designer/ai-settings', JSON.stringify({
      provider: 'openai',
      model: 'gpt-4-turbo',
      apiKeys: { anthropic: 'anth-x', openai: 'oai-y' },
    }))
    const store = useAiSettingsStore()
    expect(store.provider).toBe('openai')
    expect(store.model).toBe('gpt-4-turbo')
    expect(store.apiKeys.openai).toBe('oai-y')
  })
})
```

- [ ] **Step 1.2: Correr y verificar que falla**

```bash
npm test -- --run tests/ai-settings-store.test.js
```

Expected: 5 FAIL (store no existe).

- [ ] **Step 1.3: Implementar store**

Crear `src/stores/aiSettings.js`:

```javascript
// Sub-proyecto D — Pinia store para settings del generador IA.
// Persiste a localStorage. API keys son del usuario (browser-direct).

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'sinpapel-designer/ai-settings'

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5',
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const useAiSettingsStore = defineStore('aiSettings', () => {
  const stored = loadFromStorage()

  const provider = ref(stored?.provider || 'anthropic')
  const model = ref(stored?.model || DEFAULT_MODELS[provider.value])
  const apiKeys = ref(stored?.apiKeys || { anthropic: '', openai: '' })

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          provider: provider.value,
          model: model.value,
          apiKeys: apiKeys.value,
        }),
      )
    } catch {
      // localStorage lleno o bloqueado: ignorar en silencio (no es crítico)
    }
  }

  function setProvider(p) {
    provider.value = p
    model.value = DEFAULT_MODELS[p] || ''
    persist()
  }

  function setModel(m) {
    model.value = m
    persist()
  }

  function setApiKey(p, key) {
    apiKeys.value = { ...apiKeys.value, [p]: key }
    persist()
  }

  function hasApiKey() {
    return Boolean(apiKeys.value[provider.value])
  }

  function currentApiKey() {
    return apiKeys.value[provider.value] || ''
  }

  // Autopersist defensivo en cambios externos (e.g., devtools mutation)
  watch([provider, model, apiKeys], persist, { deep: true })

  return {
    provider, model, apiKeys,
    setProvider, setModel, setApiKey,
    hasApiKey, currentApiKey,
  }
})
```

- [ ] **Step 1.4: Correr y verificar PASS**

```bash
npm test -- --run tests/ai-settings-store.test.js
```

Expected: 5 PASS.

- [ ] **Step 1.5: Suite completa + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan.

- [ ] **Step 1.6: Commit**

```bash
git add src/stores/aiSettings.js tests/ai-settings-store.test.js
git commit -m "$(cat <<'EOF'
feat(ai): Pinia store de settings para generador IA

Sub-proyecto D paso 1: provider/model/apiKeys con persistencia
localStorage. Default Anthropic + claude-sonnet-4-6. setProvider
resetea el model al default del provider.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Anthropic adapter

**Files:**
- Create: `src/services/llmAdapters/anthropic.js`
- Test: `tests/llm-adapter-anthropic.test.js`

- [ ] **Step 2.1: Test que falla**

Crear `tests/llm-adapter-anthropic.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { call } from '../src/services/llmAdapters/anthropic.js'
import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../src/services/llmService.js'

describe('anthropic adapter', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('POST con headers correctos y body shape Anthropic', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'hola' }] }),
    })
    const result = await call({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-6',
      system: 'SYS',
      userMessage: 'USER',
    })
    expect(result.text).toBe('hola')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        }),
      }),
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.model).toBe('claude-sonnet-4-6')
    expect(body.system).toBe('SYS')
    expect(body.messages).toEqual([{ role: 'user', content: 'USER' }])
    expect(body.max_tokens).toBeGreaterThan(0)
  })

  it('lanza ApiAuthError con status 401', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid key' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiAuthError)
  })

  it('lanza ApiRateLimitError con status 429', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ error: { message: 'rate' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiRateLimitError)
  })

  it('lanza ApiNetworkError si fetch falla', async () => {
    global.fetch.mockRejectedValue(new TypeError('network'))
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiNetworkError)
  })

  it('lanza ApiResponseError genérico con otros status', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: { message: 'boom' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiResponseError)
  })
})
```

- [ ] **Step 2.2: Test debe fallar (los archivos no existen)**

```bash
npm test -- --run tests/llm-adapter-anthropic.test.js
```

Expected: import errors / fail (anthropic.js y llmService.js no existen).

- [ ] **Step 2.3: Crear `src/services/llmService.js` con sólo las clases de error**

(El service completo viene en Task 5; ahora sólo las clases para que el adapter pueda importarlas.)

Crear `src/services/llmService.js`:

```javascript
// Sub-proyecto D — LLM Service entry point + error classes.
// Despacha al adapter según aiSettings.provider.
// La implementación de generate() viene en Task 5.

export class MissingApiKeyError extends Error {
  constructor(provider) {
    super(`API key no configurada para provider '${provider}'`)
    this.name = 'MissingApiKeyError'
    this.provider = provider
  }
}

export class ApiAuthError extends Error {
  constructor(message = 'API key inválida o sin permisos') {
    super(message)
    this.name = 'ApiAuthError'
  }
}

export class ApiRateLimitError extends Error {
  constructor(message = 'Demasiadas requests, espera unos segundos') {
    super(message)
    this.name = 'ApiRateLimitError'
  }
}

export class ApiNetworkError extends Error {
  constructor(message = 'Sin conexión al provider') {
    super(message)
    this.name = 'ApiNetworkError'
  }
}

export class ApiResponseError extends Error {
  constructor(message = 'Error en la respuesta del provider', status) {
    super(message)
    this.name = 'ApiResponseError'
    this.status = status
  }
}
```

- [ ] **Step 2.4: Crear `src/services/llmAdapters/anthropic.js`**

```javascript
// Sub-proyecto D — Anthropic Messages API adapter.
// Browser-direct con anthropic-dangerous-direct-browser-access.

import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../llmService.js'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MAX_TOKENS = 4096

export async function call({ apiKey, model, system, userMessage, signal }) {
  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
  } catch (e) {
    throw new ApiNetworkError(e.message || 'Network failure')
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = body?.error?.message || ''
    } catch {
      // ignore
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiAuthError(detail || 'API key inválida o sin permisos')
    }
    if (response.status === 429) {
      throw new ApiRateLimitError(detail || 'Rate limit excedido')
    }
    throw new ApiResponseError(detail || `Error HTTP ${response.status}`, response.status)
  }

  const data = await response.json()
  const text = data?.content?.[0]?.text ?? ''
  return { text }
}
```

- [ ] **Step 2.5: Correr y verificar PASS**

```bash
npm test -- --run tests/llm-adapter-anthropic.test.js
```

Expected: 5 PASS.

- [ ] **Step 2.6: Suite + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan.

- [ ] **Step 2.7: Commit**

```bash
git add src/services/llmService.js src/services/llmAdapters/anthropic.js tests/llm-adapter-anthropic.test.js
git commit -m "$(cat <<'EOF'
feat(ai): Anthropic adapter + error classes en llmService

Sub-proyecto D paso 2: adapter thin que llama
https://api.anthropic.com/v1/messages con el header
dangerous-direct-browser-access. Clases de error tipadas en
llmService (MissingApiKey, Auth, RateLimit, Network, Response).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: OpenAI adapter

**Files:**
- Create: `src/services/llmAdapters/openai.js`
- Test: `tests/llm-adapter-openai.test.js`

- [ ] **Step 3.1: Test que falla**

Crear `tests/llm-adapter-openai.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { call } from '../src/services/llmAdapters/openai.js'
import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../src/services/llmService.js'

describe('openai adapter', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('POST con headers Bearer y body shape OpenAI', async () => {
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: 'hola' } }] }),
    })
    const result = await call({
      apiKey: 'sk-test',
      model: 'gpt-5',
      system: 'SYS',
      userMessage: 'USER',
    })
    expect(result.text).toBe('hola')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer sk-test',
          'content-type': 'application/json',
        }),
      }),
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.model).toBe('gpt-5')
    expect(body.messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USER' },
    ])
    expect(body.max_tokens).toBeGreaterThan(0)
  })

  it('lanza ApiAuthError con status 401', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ error: { message: 'invalid' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiAuthError)
  })

  it('lanza ApiRateLimitError con status 429', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ error: { message: 'rate' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiRateLimitError)
  })

  it('lanza ApiNetworkError si fetch lanza', async () => {
    global.fetch.mockRejectedValue(new TypeError('network'))
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiNetworkError)
  })

  it('lanza ApiResponseError genérico con 500', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: { message: 'boom' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiResponseError)
  })
})
```

- [ ] **Step 3.2: Test debe fallar**

```bash
npm test -- --run tests/llm-adapter-openai.test.js
```

Expected: import errors.

- [ ] **Step 3.3: Crear `src/services/llmAdapters/openai.js`**

```javascript
// Sub-proyecto D — OpenAI Chat Completions adapter.

import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../llmService.js'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const MAX_TOKENS = 4096

export async function call({ apiKey, model, system, userMessage, signal }) {
  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMessage },
        ],
      }),
    })
  } catch (e) {
    throw new ApiNetworkError(e.message || 'Network failure')
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = body?.error?.message || ''
    } catch {
      // ignore
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiAuthError(detail || 'API key inválida o sin permisos')
    }
    if (response.status === 429) {
      throw new ApiRateLimitError(detail || 'Rate limit excedido')
    }
    throw new ApiResponseError(detail || `Error HTTP ${response.status}`, response.status)
  }

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content ?? ''
  return { text }
}
```

- [ ] **Step 3.4: Correr y verificar PASS**

```bash
npm test -- --run tests/llm-adapter-openai.test.js
```

Expected: 5 PASS.

- [ ] **Step 3.5: Suite + lint**

```bash
npm test -- --run && npm run lint
```

- [ ] **Step 3.6: Commit**

```bash
git add src/services/llmAdapters/openai.js tests/llm-adapter-openai.test.js
git commit -m "$(cat <<'EOF'
feat(ai): OpenAI adapter (chat completions)

Sub-proyecto D paso 3: adapter análogo al de Anthropic, llamando
a https://api.openai.com/v1/chat/completions con Bearer auth.
Mismo shape de errores tipados.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Prompt builder

**Files:**
- Create: `src/services/llmPrompts/workflowGenerator.js`
- Test: `tests/llm-prompt-builder.test.js`

- [ ] **Step 4.1: Test que falla**

Crear `tests/llm-prompt-builder.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../src/services/llmPrompts/workflowGenerator.js'

describe('workflowGenerator prompt builder', () => {
  it('userMessage incluye la descripción del usuario', () => {
    const { userMessage } = buildPrompt('Trámite IMSS con 4 estados')
    expect(userMessage).toContain('Trámite IMSS con 4 estados')
  })

  it('system prompt documenta el schema v0.2 y los 3 tipos de condicion', () => {
    const { system } = buildPrompt('x')
    expect(system).toContain('schema_version')
    expect(system).toContain('0.2')
    expect(system).toContain('catalogos')
    expect(system).toContain('estados')
    expect(system).toContain('etapas')
    expect(system).toContain('grupos')
    expect(system).toContain('tipos_documento')
    expect(system).toContain('transiciones')
    expect(system).toContain('python_path')
    expect(system).toContain('json_logic')
    expect(system).toContain('django_orm')
    expect(system).toContain('requisitos')
  })

  it('system prompt impone devolver SÓLO JSON sin markdown', () => {
    const { system } = buildPrompt('x')
    expect(system).toMatch(/sólo|solo/i)
    expect(system).toMatch(/JSON/)
    expect(system).toMatch(/sin markdown|sin explicaciones/i)
  })

  it('system prompt incluye un ejemplo few-shot con shape v0.2', () => {
    const { system } = buildPrompt('x')
    expect(system).toContain('"schema_version": "0.2"')
    expect(system).toContain('"flujo"')
    expect(system).toContain('"transiciones"')
  })
})
```

- [ ] **Step 4.2: Test debe fallar**

```bash
npm test -- --run tests/llm-prompt-builder.test.js
```

Expected: 4 FAIL.

- [ ] **Step 4.3: Implementar prompt builder**

Crear `src/services/llmPrompts/workflowGenerator.js`:

```javascript
// Sub-proyecto D — System prompt + user message builder para el generador IA.
// Documenta el schema v0.2 e incluye un ejemplo few-shot.

const SCHEMA_DOCS = `
Schema JSON v0.2:

{
  "schema_version": "0.2",
  "exported_at": "<ISO 8601 datetime>",
  "catalogos": {
    "estados": [
      { "nombre": "STR_UNIQUE_UPPER_SNAKE", "color": "#hex", "icono": "material_icon_name",
        "descripcion": "str", "orden": int, "activo": bool,
        "etapa": "STR_O_NULL", "permite_expediente": bool, "expediente_obligatorio": bool }
    ],
    "etapas": [
      { "nombre": "STR_UNIQUE", "color": "#hex", "descripcion": "str", "orden": int, "activo": bool }
    ],
    "grupos": [ { "name": "str_kebab_o_snake" } ],
    "tipos_documento": [
      { "nombre": "STR_UNIQUE", "color": "#hex", "descripcion": "str", "orden": int, "activo": bool }
    ]
  },
  "flujo": {
    "nombre": "str",
    "descripcion": "str",
    "activo": bool,
    "metadatos": null,
    "transiciones": [
      {
        "estado_origen": "<nombre estado>",
        "estado_destino": "<nombre estado>",
        "grupos_permitidos": ["<grupo.name>"],
        "condiciones": [
          {
            "tipo": "python_path" | "json_logic" | "django_orm",
            "configuracion": <shape depende de tipo>,
            "mensaje_error": "str",
            "orden": int,
            "activo": bool
          }
        ]
      }
    ],
    "requisitos": [
      { "estado": "<nombre estado destino>",
        "tipo_documento": "<nombre tipo_documento>",
        "porcentaje": int_0_100,
        "auto_carga": bool }
    ]
  }
}

Shapes de configuracion por tipo:
- python_path: { "path": "modulo.submodulo.funcion" } (función f(instance, user) -> (bool, str|None))
- json_logic: { "rule": <regla JSON Logic, ej. {">=": [{"var": "monto"}, 100000]}> }
- django_orm: { "lookup": { "campo__lookup": valor, ... } }
`.trim()

const RULES = `
REGLAS OBLIGATORIAS:
1. Devuelve SÓLO un objeto JSON. No incluyas markdown (sin \`\`\`), sin explicaciones, sin prefacios.
2. \`estados[*].nombre\` debe ser UNIQUE y en UPPER_SNAKE_CASE.
3. \`transiciones[*].estado_origen\` y \`estado_destino\` deben referenciar \`nombres\` que existan en catalogos.estados.
4. \`transiciones[*].grupos_permitidos[*]\` deben referenciar \`name\` que exista en catalogos.grupos.
5. \`condiciones[*].tipo\` SÓLO puede ser uno de: python_path, json_logic, django_orm.
6. \`requisitos[*].tipo_documento\` debe existir en catalogos.tipos_documento.
7. Si no hay condiciones para una transición, OMITE el campo (no rellenes con []).
8. Si no estás seguro de una condición, NO la inventes. Es mejor un flujo sin condiciones que con configuraciones bogus.
9. \`metadatos\` siempre null en la salida (el designer asigna posiciones después).
10. \`exported_at\` debe ser un ISO 8601 datetime válido.
`.trim()

const FEW_SHOT_EXAMPLE = `
EJEMPLO de salida válida para un flujo simple de aprobación con condición:

{
  "schema_version": "0.2",
  "exported_at": "2026-05-17T00:00:00Z",
  "catalogos": {
    "estados": [
      { "nombre": "INICIO", "color": "#9b2247", "icono": "play_circle", "descripcion": "Solicitud creada", "orden": 0, "activo": true, "etapa": null, "permite_expediente": true, "expediente_obligatorio": false },
      { "nombre": "EN_REVISION", "color": "#a57f2c", "icono": "fact_check", "descripcion": "Revisión documental", "orden": 1, "activo": true, "etapa": null, "permite_expediente": true, "expediente_obligatorio": true },
      { "nombre": "APROBADO", "color": "#1e5b4f", "icono": "check_circle", "descripcion": "Aprobado", "orden": 2, "activo": true, "etapa": null, "permite_expediente": false, "expediente_obligatorio": false }
    ],
    "etapas": [],
    "grupos": [ { "name": "revisor" }, { "name": "aprobador" } ],
    "tipos_documento": [ { "nombre": "INE", "color": "#666", "descripcion": "Identificación oficial", "orden": 0, "activo": true } ]
  },
  "flujo": {
    "nombre": "Aprobación simple",
    "descripcion": "Flujo demo con un nivel de aprobación",
    "activo": false,
    "metadatos": null,
    "transiciones": [
      {
        "estado_origen": "INICIO",
        "estado_destino": "EN_REVISION",
        "grupos_permitidos": ["revisor"]
      },
      {
        "estado_origen": "EN_REVISION",
        "estado_destino": "APROBADO",
        "grupos_permitidos": ["aprobador"],
        "condiciones": [
          { "tipo": "json_logic", "configuracion": { "rule": { ">=": [{"var": "monto"}, 0] } }, "mensaje_error": "Monto inválido", "orden": 0, "activo": true }
        ]
      }
    ],
    "requisitos": [
      { "estado": "EN_REVISION", "tipo_documento": "INE", "porcentaje": 100, "auto_carga": false }
    ]
  }
}
`.trim()

const SYSTEM = `Eres un generador de workflows administrativos en formato JSON v0.2 del proyecto Sinpapel.

${SCHEMA_DOCS}

${RULES}

${FEW_SHOT_EXAMPLE}
`

export function buildPrompt(userDescription) {
  return {
    system: SYSTEM,
    userMessage: `Genera el JSON v0.2 para el siguiente flujo:\n\n${userDescription}`,
  }
}
```

- [ ] **Step 4.4: Correr y verificar PASS**

```bash
npm test -- --run tests/llm-prompt-builder.test.js
```

Expected: 4 PASS.

- [ ] **Step 4.5: Suite + lint**

```bash
npm test -- --run && npm run lint
```

- [ ] **Step 4.6: Commit**

```bash
git add src/services/llmPrompts/workflowGenerator.js tests/llm-prompt-builder.test.js
git commit -m "$(cat <<'EOF'
feat(ai): prompt builder con schema v0.2 + few-shot

Sub-proyecto D paso 4: system prompt documenta el schema v0.2
completo, reglas semánticas (UPPER_SNAKE en estados, referencias
válidas, no inventar condiciones bogus) y un ejemplo few-shot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: llmService.generate (dispatcher)

**Files:**
- Modify: `src/services/llmService.js` (añadir `generate()`)
- Test: `tests/llm-service.test.js`

- [ ] **Step 5.1: Test que falla**

Crear `tests/llm-service.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

describe('llmService.generate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.resetModules()
  })

  it('lanza MissingApiKeyError si no hay key para el provider activo', async () => {
    const { generate, MissingApiKeyError } = await import('../src/services/llmService.js')
    await expect(generate('hola')).rejects.toBeInstanceOf(MissingApiKeyError)
  })

  it('despacha al adapter Anthropic cuando provider=anthropic', async () => {
    const anthropicMock = vi.fn().mockResolvedValue({ text: 'respuesta' })
    vi.doMock('../src/services/llmAdapters/anthropic.js', () => ({ call: anthropicMock }))
    vi.doMock('../src/services/llmAdapters/openai.js', () => ({ call: vi.fn() }))
    const { generate } = await import('../src/services/llmService.js')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    const store = useAiSettingsStore()
    store.setApiKey('anthropic', 'sk-ant')

    const result = await generate('descripcion del flujo')
    expect(result).toBe('respuesta')
    expect(anthropicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-ant',
        model: 'claude-sonnet-4-6',
        system: expect.stringContaining('schema_version'),
        userMessage: expect.stringContaining('descripcion del flujo'),
      }),
    )
  })

  it('despacha al adapter OpenAI cuando provider=openai', async () => {
    const openaiMock = vi.fn().mockResolvedValue({ text: 'r2' })
    vi.doMock('../src/services/llmAdapters/anthropic.js', () => ({ call: vi.fn() }))
    vi.doMock('../src/services/llmAdapters/openai.js', () => ({ call: openaiMock }))
    const { generate } = await import('../src/services/llmService.js')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    const store = useAiSettingsStore()
    store.setProvider('openai')
    store.setApiKey('openai', 'sk-oai')

    const result = await generate('x')
    expect(result).toBe('r2')
    expect(openaiMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-oai', model: 'gpt-5' }),
    )
  })

  it('propaga errores tipados del adapter', async () => {
    const failMock = vi.fn().mockRejectedValue(new Error('boom'))
    vi.doMock('../src/services/llmAdapters/anthropic.js', () => ({ call: failMock }))
    vi.doMock('../src/services/llmAdapters/openai.js', () => ({ call: vi.fn() }))
    const { generate } = await import('../src/services/llmService.js')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    useAiSettingsStore().setApiKey('anthropic', 'sk-ant')
    await expect(generate('x')).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 5.2: Test debe fallar (generate no existe)**

```bash
npm test -- --run tests/llm-service.test.js
```

Expected: 3 FAIL (1 puede pasar ya — MissingApiKey si está implementado, pero el dispatcher no).

- [ ] **Step 5.3: Añadir `generate()` a `src/services/llmService.js`**

Reemplazar el contenido de `src/services/llmService.js` por:

```javascript
// Sub-proyecto D — LLM Service entry point + error classes + dispatcher.

import { useAiSettingsStore } from '../stores/aiSettings.js'
import { call as anthropicCall } from './llmAdapters/anthropic.js'
import { call as openaiCall } from './llmAdapters/openai.js'
import { buildPrompt } from './llmPrompts/workflowGenerator.js'

export class MissingApiKeyError extends Error {
  constructor(provider) {
    super(`API key no configurada para provider '${provider}'`)
    this.name = 'MissingApiKeyError'
    this.provider = provider
  }
}

export class ApiAuthError extends Error {
  constructor(message = 'API key inválida o sin permisos') {
    super(message)
    this.name = 'ApiAuthError'
  }
}

export class ApiRateLimitError extends Error {
  constructor(message = 'Demasiadas requests, espera unos segundos') {
    super(message)
    this.name = 'ApiRateLimitError'
  }
}

export class ApiNetworkError extends Error {
  constructor(message = 'Sin conexión al provider') {
    super(message)
    this.name = 'ApiNetworkError'
  }
}

export class ApiResponseError extends Error {
  constructor(message = 'Error en la respuesta del provider', status) {
    super(message)
    this.name = 'ApiResponseError'
    this.status = status
  }
}

const ADAPTERS = {
  anthropic: anthropicCall,
  openai: openaiCall,
}

export async function generate(userDescription, opts = {}) {
  const store = useAiSettingsStore()
  if (!store.hasApiKey()) {
    throw new MissingApiKeyError(store.provider)
  }
  const adapter = ADAPTERS[store.provider]
  if (!adapter) {
    throw new ApiResponseError(`Provider desconocido: ${store.provider}`)
  }
  const { system, userMessage } = buildPrompt(userDescription)
  const result = await adapter({
    apiKey: store.currentApiKey(),
    model: store.model,
    system,
    userMessage,
    signal: opts.signal,
  })
  return result.text
}
```

- [ ] **Step 5.4: Correr y verificar PASS**

```bash
npm test -- --run tests/llm-service.test.js
```

Expected: 4 PASS.

- [ ] **Step 5.5: Suite + lint**

```bash
npm test -- --run && npm run lint
```

- [ ] **Step 5.6: Commit**

```bash
git add src/services/llmService.js tests/llm-service.test.js
git commit -m "$(cat <<'EOF'
feat(ai): llmService.generate dispatcher (Anthropic/OpenAI)

Sub-proyecto D paso 5: generate() lee aiSettings, construye el
prompt vía buildPrompt, y despacha al adapter del provider activo.
Lanza MissingApiKeyError si no hay key.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: AiSettingsDialog

**Files:**
- Create: `src/components/AiSettingsDialog.vue`
- Test: `tests/ai-settings-dialog.test.js`

- [ ] **Step 6.1: Test que falla**

Crear `tests/ai-settings-dialog.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const COMMON_STUBS = {
  QDialog: { template: '<div><slot/></div>', props: ['modelValue'] },
  QCard: { template: '<div><slot/></div>' },
  QCardSection: { template: '<div><slot/></div>' },
  QForm: {
    template: '<form @submit.prevent="$emit(\'submit\', $event)"><slot/></form>',
    emits: ['submit'],
  },
  QInput: {
    template: '<input :data-field="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"/>',
    props: ['modelValue', 'label', 'type'],
    emits: ['update:modelValue'],
  },
  QSelect: {
    template: '<select :data-field="label" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.value || o" :value="o.value || o">{{ o.label || o }}</option></select>',
    props: ['modelValue', 'label', 'options'],
    emits: ['update:modelValue'],
  },
  QBtn: { template: '<button :type="type" @click="$emit(\'click\')"><slot/></button>', props: ['type'], emits: ['click'] },
}

describe('AiSettingsDialog', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('Guardar persiste provider, model y API keys al store', async () => {
    const AiSettingsDialog = (await import('../src/components/AiSettingsDialog.vue')).default
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')

    const wrapper = mount(AiSettingsDialog, {
      props: { modelValue: true },
      global: { stubs: COMMON_STUBS },
    })

    await wrapper.find('select[data-field="Provider"]').setValue('openai')
    await wrapper.find('input[data-field="OpenAI API key"]').setValue('sk-openai-test')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const store = useAiSettingsStore()
    expect(store.provider).toBe('openai')
    expect(store.apiKeys.openai).toBe('sk-openai-test')
  })

  it('emite update:modelValue=false al guardar', async () => {
    const AiSettingsDialog = (await import('../src/components/AiSettingsDialog.vue')).default
    const wrapper = mount(AiSettingsDialog, {
      props: { modelValue: true },
      global: { stubs: COMMON_STUBS },
    })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const closeEmits = (wrapper.emitted('update:modelValue') || []).filter(a => a[0] === false)
    expect(closeEmits.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 6.2: Test debe fallar**

```bash
npm test -- --run tests/ai-settings-dialog.test.js
```

Expected: 2 FAIL (componente no existe).

- [ ] **Step 6.3: Crear `src/components/AiSettingsDialog.vue`**

```vue
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

// Cuando el dialog abre, re-sincroniza con el store
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

// Cuando el usuario cambia provider en el form, ajustar model al primer option
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
```

- [ ] **Step 6.4: Correr y verificar PASS**

```bash
npm test -- --run tests/ai-settings-dialog.test.js
```

Expected: 2 PASS.

- [ ] **Step 6.5: Suite + lint**

```bash
npm test -- --run && npm run lint
```

- [ ] **Step 6.6: Commit**

```bash
git add src/components/AiSettingsDialog.vue tests/ai-settings-dialog.test.js
git commit -m "$(cat <<'EOF'
feat(ai): AiSettingsDialog (provider + model + API keys)

Sub-proyecto D paso 6: dialog para configurar el generador. Inputs
con toggle show/hide para las dos API keys. Provider select que
recalcula model al primer option válido cuando cambia.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: AiGeneratorPreview

**Files:**
- Create: `src/components/AiGeneratorPreview.vue`
- Test: `tests/ai-generator-preview.test.js`

- [ ] **Step 7.1: Test que falla**

Crear `tests/ai-generator-preview.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AiGeneratorPreview from '../src/components/AiGeneratorPreview.vue'

const STUBS = {
  QCard: { template: '<div><slot/></div>' },
  QCardSection: { template: '<div><slot/></div>' },
  QIcon: true,
  QChip: { template: '<span class="q-chip"><slot/></span>' },
}

const baseResult = {
  flujo: { id: 'x', nombre: 'Demo', descripcion: '', activo: false, metadatos: null, transiciones_count: 2 },
  estados: [{ id: 1, nombre: 'A' }, { id: 2, nombre: 'B' }, { id: 3, nombre: 'C' }],
  etapas: [],
  grupos: [{ id: 1, name: 'g1' }],
  tipos_documento: [{ id: 1, nombre: 'INE' }],
  transiciones: [
    { id: 1, condiciones: [{ tipo: 'json_logic' }, { tipo: 'python_path' }] },
    { id: 2, condiciones: [] },
  ],
  requisitos: [{ estado: 'B', tipo_documento: 'INE', porcentaje: 100, auto_carga: false }],
}

describe('AiGeneratorPreview', () => {
  it('muestra counts correctos', () => {
    const wrapper = mount(AiGeneratorPreview, {
      props: { result: baseResult, validationWarnings: [] },
      global: { stubs: STUBS },
    })
    const text = wrapper.text()
    expect(text).toContain('3') // estados
    expect(text).toContain('INE') // tipo_documento
    expect(text).toContain('2 transiciones')
    expect(text).toContain('2 condiciones') // sumadas
    expect(text).toContain('1 requisito')
  })

  it('renderiza warnings cuando se pasan', () => {
    const wrapper = mount(AiGeneratorPreview, {
      props: {
        result: baseResult,
        validationWarnings: ['Condición 0: tipo inválido', 'Requisito sin tipo_documento'],
      },
      global: { stubs: STUBS },
    })
    expect(wrapper.text()).toContain('Condición 0: tipo inválido')
    expect(wrapper.text()).toContain('Requisito sin tipo_documento')
  })

  it('muestra estado vacío cuando result es null', () => {
    const wrapper = mount(AiGeneratorPreview, {
      props: { result: null, validationWarnings: [] },
      global: { stubs: STUBS },
    })
    expect(wrapper.text()).toMatch(/sin resultado|nada generado/i)
  })
})
```

- [ ] **Step 7.2: Test debe fallar**

```bash
npm test -- --run tests/ai-generator-preview.test.js
```

Expected: 3 FAIL.

- [ ] **Step 7.3: Crear `src/components/AiGeneratorPreview.vue`**

```vue
<template>
  <q-card v-if="result" class="ai-preview">
    <q-card-section>
      <div class="text-h6">{{ result.flujo?.nombre || '(sin nombre)' }}</div>
      <div class="text-caption text-grey-7">{{ result.flujo?.descripcion || '' }}</div>
    </q-card-section>

    <q-card-section>
      <div class="row q-gutter-md">
        <div class="ai-preview__stat"><strong>{{ counts.estados }}</strong> estados</div>
        <div class="ai-preview__stat"><strong>{{ counts.etapas }}</strong> etapas</div>
        <div class="ai-preview__stat"><strong>{{ counts.grupos }}</strong> grupos</div>
        <div class="ai-preview__stat"><strong>{{ counts.tipos_documento }}</strong> tipos doc</div>
        <div class="ai-preview__stat"><strong>{{ counts.transiciones }}</strong> transiciones</div>
        <div class="ai-preview__stat"><strong>{{ counts.condiciones }}</strong> condiciones</div>
        <div class="ai-preview__stat"><strong>{{ counts.requisitos }}</strong> requisito{{ counts.requisitos === 1 ? '' : 's' }}</div>
      </div>
    </q-card-section>

    <q-card-section v-if="validationWarnings.length > 0" class="ai-preview__warnings">
      <div class="text-subtitle2 q-mb-xs">
        <q-icon name="warning" size="16px" /> Avisos
      </div>
      <ul>
        <li v-for="(w, idx) in validationWarnings" :key="idx">{{ w }}</li>
      </ul>
    </q-card-section>

    <q-card-section>
      <div class="text-subtitle2">Tipos de documento</div>
      <div class="row q-gutter-xs">
        <q-chip v-for="t in (result.tipos_documento || [])" :key="t.id" dense square>{{ t.nombre }}</q-chip>
      </div>
    </q-card-section>

    <q-card-section>
      <details>
        <summary class="text-caption">Ver JSON completo</summary>
        <pre class="ai-preview__json">{{ JSON.stringify(result, null, 2) }}</pre>
      </details>
    </q-card-section>

    <q-card-section>
      <slot name="actions" />
    </q-card-section>
  </q-card>
  <div v-else class="ai-preview__empty">
    Sin resultado todavía. Escribe una descripción y genera.
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  result: { type: Object, default: null },
  validationWarnings: { type: Array, default: () => [] },
})

const counts = computed(() => {
  const r = props.result || {}
  const transiciones = r.transiciones || []
  return {
    estados: (r.estados || []).length,
    etapas: (r.etapas || []).length,
    grupos: (r.grupos || []).length,
    tipos_documento: (r.tipos_documento || []).length,
    transiciones: transiciones.length,
    condiciones: transiciones.reduce((acc, t) => acc + (t.condiciones?.length || 0), 0),
    requisitos: (r.requisitos || []).length,
  }
})
</script>

<style scoped>
.ai-preview {
  font-family: 'Cabin', sans-serif;
}

.ai-preview__stat {
  background: #faf5ef;
  border: 1px solid #e8e0d8;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #6b5e56;
}

.ai-preview__warnings {
  background: #fff7e0;
  border-left: 3px solid #c89000;
}

.ai-preview__warnings ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #7a5a00;
}

.ai-preview__json {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  font-size: 11px;
  font-family: monospace;
  max-height: 360px;
  overflow: auto;
}

.ai-preview__empty {
  padding: 40px 24px;
  text-align: center;
  font-size: 13px;
  color: #aaa;
  font-style: italic;
}
</style>
```

- [ ] **Step 7.4: Correr y verificar PASS**

```bash
npm test -- --run tests/ai-generator-preview.test.js
```

Expected: 3 PASS.

- [ ] **Step 7.5: Suite + lint**

```bash
npm test -- --run && npm run lint
```

- [ ] **Step 7.6: Commit**

```bash
git add src/components/AiGeneratorPreview.vue tests/ai-generator-preview.test.js
git commit -m "$(cat <<'EOF'
feat(ai): AiGeneratorPreview con counts + warnings + JSON crudo

Sub-proyecto D paso 7: componente de preview. Counts por catálogo
+ suma de condiciones. Warnings amarillos si se pasan. JSON crudo
en <details> colapsado. Slot 'actions' para botones que la página
inyecta (Aplicar / Descartar).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: AiGeneratorPage (página orquestadora)

**Files:**
- Create: `src/pages/AiGeneratorPage.vue`
- Test: `tests/ai-generator-page.test.js`

- [ ] **Step 8.1: Test que falla**

Crear `tests/ai-generator-page.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const STUBS = {
  QPage: { template: '<div data-testid="ai-page"><slot/></div>' },
  QBtn: { template: '<button :aria-label="$attrs[`aria-label`]" @click="$emit(\'click\')"><slot/></button>', inheritAttrs: false, emits: ['click'] },
  QInput: {
    template: '<textarea :data-field="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>',
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
  },
  QIcon: true,
  QSpinnerDots: true,
  AiSettingsDialog: {
    template: '<div data-testid="settings-dialog" v-if="modelValue"/>',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },
  AiGeneratorPreview: {
    template: '<div data-testid="preview"><slot name="actions"/></div>',
    props: ['result', 'validationWarnings'],
  },
}

describe('AiGeneratorPage', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.resetModules()
  })

  it('clic Generar sin API key abre el Settings dialog', async () => {
    vi.doMock('src/services/llmService.js', () => ({
      generate: vi.fn(),
      MissingApiKeyError: class extends Error { constructor() { super('no key') ; this.name = 'MissingApiKeyError' } },
      ApiAuthError: class extends Error {},
      ApiRateLimitError: class extends Error {},
      ApiNetworkError: class extends Error {},
      ApiResponseError: class extends Error {},
    }))
    vi.doMock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

    const { default: AiGeneratorPage } = await import('../src/pages/AiGeneratorPage.vue')
    const wrapper = mount(AiGeneratorPage, {
      global: { stubs: STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('textarea[data-field="Describe el flujo a generar"]').setValue('Trámite IMSS')
    await wrapper.find('button[aria-label="Generar"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="settings-dialog"]').exists()).toBe(true)
  })

  it('generar exitoso muestra Preview con el parsed result', async () => {
    const validJson = JSON.stringify({
      schema_version: '0.2',
      exported_at: '2026-05-17T00:00:00Z',
      catalogos: {
        estados: [{ nombre: 'A', color: '#fff', icono: 'circle', descripcion: '', orden: 0, activo: true }],
        etapas: [], grupos: [], tipos_documento: [],
      },
      flujo: { nombre: 'Test', descripcion: '', activo: false, metadatos: null, transiciones: [], requisitos: [] },
    })
    const generateMock = vi.fn().mockResolvedValue(validJson)
    vi.doMock('src/services/llmService.js', () => ({
      generate: generateMock,
      MissingApiKeyError: class extends Error {},
      ApiAuthError: class extends Error {},
      ApiRateLimitError: class extends Error {},
      ApiNetworkError: class extends Error {},
      ApiResponseError: class extends Error {},
    }))
    vi.doMock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
    const { default: AiGeneratorPage } = await import('../src/pages/AiGeneratorPage.vue')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    useAiSettingsStore().setApiKey('anthropic', 'sk-ant')

    const wrapper = mount(AiGeneratorPage, {
      global: { stubs: STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('textarea[data-field="Describe el flujo a generar"]').setValue('x')
    await wrapper.find('button[aria-label="Generar"]').trigger('click')
    await flushPromises()
    expect(generateMock).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="preview"]').exists()).toBe(true)
  })

  it('Aplicar llama store.loadFromFile y redirige al canvas', async () => {
    const validJson = JSON.stringify({
      schema_version: '0.2',
      exported_at: '2026-05-17T00:00:00Z',
      catalogos: {
        estados: [{ nombre: 'A', color: '#fff', icono: 'circle', descripcion: '', orden: 0, activo: true }],
        etapas: [], grupos: [], tipos_documento: [],
      },
      flujo: { nombre: 'Test', descripcion: '', activo: false, metadatos: null, transiciones: [], requisitos: [] },
    })
    const generateMock = vi.fn().mockResolvedValue(validJson)
    const pushMock = vi.fn()
    const loadFromFileMock = vi.fn().mockResolvedValue({ flujo: { id: 'new-id' } })
    vi.doMock('src/services/llmService.js', () => ({
      generate: generateMock,
      MissingApiKeyError: class extends Error {},
      ApiAuthError: class extends Error {},
      ApiRateLimitError: class extends Error {},
      ApiNetworkError: class extends Error {},
      ApiResponseError: class extends Error {},
    }))
    vi.doMock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))
    vi.doMock('src/stores/workflow.js', () => ({
      useWorkflowStore: () => ({ loadFromFile: loadFromFileMock }),
    }))
    const { default: AiGeneratorPage } = await import('../src/pages/AiGeneratorPage.vue')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    useAiSettingsStore().setApiKey('anthropic', 'sk-ant')

    const wrapper = mount(AiGeneratorPage, {
      global: { stubs: STUBS, mocks: { $q: { notify: vi.fn() } } },
    })
    await wrapper.find('textarea[data-field="Describe el flujo a generar"]').setValue('x')
    await wrapper.find('button[aria-label="Generar"]').trigger('click')
    await flushPromises()
    await wrapper.find('button[aria-label="Aplicar"]').trigger('click')
    await flushPromises()

    expect(loadFromFileMock).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'workflow-canvas', params: { id: 'new-id' } }),
    )
  })
})
```

- [ ] **Step 8.2: Test debe fallar**

```bash
npm test -- --run tests/ai-generator-page.test.js
```

Expected: 3 FAIL (page no existe).

- [ ] **Step 8.3: Crear `src/pages/AiGeneratorPage.vue`**

```vue
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
import AiSettingsDialog from 'src/components/AiSettingsDialog.vue'
import AiGeneratorPreview from 'src/components/AiGeneratorPreview.vue'

const router = useRouter()
const $q = useQuasar()
const store = useWorkflowStore()

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
```

- [ ] **Step 8.4: Correr y verificar PASS**

```bash
npm test -- --run tests/ai-generator-page.test.js
```

Expected: 3 PASS.

- [ ] **Step 8.5: Suite + lint**

```bash
npm test -- --run && npm run lint
```

- [ ] **Step 8.6: Commit**

```bash
git add src/pages/AiGeneratorPage.vue tests/ai-generator-page.test.js
git commit -m "$(cat <<'EOF'
feat(ai): AiGeneratorPage orquestadora del generador

Sub-proyecto D paso 8: textarea + botón Generar. En error sin key
abre Settings dialog. En éxito muestra preview con warnings de
validación. Aplicar serializa de vuelta a JSON v0.2 y llama
store.loadFromFile, luego redirige al canvas con el flujo nuevo.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Ruta + navegación

**Files:**
- Modify: `src/router/routes.js`
- Modify: `src/layouts/MainLayout.vue`

- [ ] **Step 9.1: Añadir ruta**

En `src/router/routes.js`, dentro del array `children` del layout, añadir:

```javascript
      { path: 'ai-generator', name: 'ai-generator', component: () => import('pages/AiGeneratorPage.vue') },
```

El resultado completo del archivo:

```javascript
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('pages/IndexPage.vue') },
      { path: 'workflows', name: 'workflows', component: () => import('pages/WorkflowListPage.vue') },
      { path: 'workflow/:id', name: 'workflow-canvas', component: () => import('pages/WorkflowCanvasPage.vue') },
      { path: 'catalogos', name: 'catalogos', component: () => import('pages/CatalogosPage.vue') },
      { path: 'ai-generator', name: 'ai-generator', component: () => import('pages/AiGeneratorPage.vue') },
    ],
  },
  // Catch-all 404 handled by Quasar default error page.
]

export default routes
```

- [ ] **Step 9.2: Añadir entry de nav en `MainLayout.vue`**

En `src/layouts/MainLayout.vue`, dentro de `<div class="ds-drawer__nav">` (entre el link de Workflows y el de Catálogos, o después del de Catálogos — al final), añadir:

```vue
        <router-link :to="{ name: 'ai-generator' }" class="ds-nav-item" active-class="ds-nav-item--active">
          <div class="ds-nav-item__icon">
            <q-icon name="auto_awesome" size="20px" />
          </div>
          <div class="ds-nav-item__text">
            <span class="ds-nav-item__title">Generador IA</span>
            <span class="ds-nav-item__caption">Crear flujo desde descripción</span>
          </div>
        </router-link>
```

Insertar inmediatamente después del bloque `<router-link :to="{ name: 'catalogos' }">` (línea ~65).

- [ ] **Step 9.3: Suite + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan. No hay tests directos de routes/layout pero los tests existentes siguen verdes.

- [ ] **Step 9.4: Commit**

```bash
git add src/router/routes.js src/layouts/MainLayout.vue
git commit -m "$(cat <<'EOF'
feat(ai): ruta /ai-generator + entry de nav en drawer

Sub-proyecto D paso 9: registra la página AiGeneratorPage en el
router y añade el link en el drawer del layout principal con icon
auto_awesome.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Verificación end-to-end + push

- [ ] **Step 10.1: Arrancar dev server**

```bash
npm run dev
```

Abrir browser en la URL impresa.

- [ ] **Step 10.2: Recorrer el flujo dorado**

1. Click en "Generador IA" en el drawer → entra a `/ai-generator`.
2. Click en "Settings" → AiSettingsDialog se abre.
3. Provider = Anthropic (default), modelo = claude-sonnet-4-6 (default).
4. Pegar API key real de Anthropic en el campo correspondiente.
5. Guardar.
6. En el textarea: "Genera un flujo simple de aprobación de gastos con 3 estados (solicitado, revisión, aprobado), 2 grupos (solicitante, aprobador), un requisito de comprobante en el estado de revisión."
7. Click Generar.
8. Esperar respuesta (~5-20s).
9. Verificar Preview muestra: estados=3, grupos=2, requisitos=1, etc.
10. Click Aplicar.
11. Redirige al canvas con el flujo cargado.

- [ ] **Step 10.3: Recorrer caso sin API key**

1. Limpiar API key en Settings, Guardar.
2. Volver al generador, click Generar.
3. Verificar que se abre Settings dialog + notify amarillo "Configura tu API key primero."

- [ ] **Step 10.4: Recorrer caso de respuesta inválida**

1. Configurar Anthropic key inválida (e.g., `sk-ant-INVALID`).
2. Click Generar.
3. Verificar mensaje de error "API key inválida o sin permisos." + Settings dialog se abre.

- [ ] **Step 10.5: Cambiar provider**

1. En Settings, cambiar a OpenAI.
2. Verificar que el model select cambia a `gpt-5` automáticamente.
3. Si tienes key de OpenAI, repetir el flujo dorado para confirmar dispatch.

- [ ] **Step 10.6: Push**

```bash
git push
```

Expected: 9 commits pusheados a `origin/develop`.
