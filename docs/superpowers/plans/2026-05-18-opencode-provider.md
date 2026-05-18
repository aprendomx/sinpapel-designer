# Provider OpenCode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir OpenCode (`opencode serve`) como tercer provider del generador IA del designer, reutilizando la infraestructura existente (`llmService.generate`, `buildPrompt`, `AiGeneratorPage`).

**Architecture:** Nuevo adapter thin `opencode.js` que hace 2 round-trips HTTP (POST /session → POST /session/:id/prompt) contra una instancia local/remota de OpenCode. Settings extiende provider list + model list + 2 campos nuevos (URL + password basic-auth). Sin cambios al backend ni al schema v0.2.

**Tech Stack:** Vue 3 `<script setup>`, Quasar, Pinia, vitest. APIs: `fetch` nativo + `btoa` para basic auth header. Sin nuevas dependencias.

**Spec:** `docs/superpowers/specs/2026-05-18-opencode-provider-design.md`

---

## File Structure

**Create:**
- `src/services/llmAdapters/opencode.js` — adapter de 2 calls (session create + prompt).
- `tests/llm-adapter-opencode.test.js` — 8 tests del adapter.

**Modify:**
- `src/stores/aiSettings.js` — DEFAULT_MODELS para opencode, apiKeys.opencode, opencodeUrl ref, setOpencodeUrl, persist/load extended.
- `src/services/llmService.js` — registrar opencode adapter, pasar opencodeUrl en el call.
- `src/components/AiSettingsDialog.vue` — opcion OpenCode en provider, lista de modelos, 2 inputs condicionales (URL + password), wiring en form/watch/onSave.
- `tests/ai-settings-store.test.js` — cobertura provider=opencode + setOpencodeUrl.
- `tests/llm-service.test.js` — dispatch opencode.
- `tests/ai-settings-dialog.test.js` — render condicional de campos opencode.

**Sin cambios:** prompt builder, preview, page, anthropic/openai adapters, schema v0.2, backend.

---

## Task 1: Extender aiSettings store

**Files:**
- Modify: `src/stores/aiSettings.js`
- Modify: `tests/ai-settings-store.test.js` (extender, NO reescribir)

- [ ] **Step 1.1: Añadir tests que fallen**

Anexar al final del `describe('aiSettings store', ...)` en `tests/ai-settings-store.test.js` (antes del cierre `})`):

```javascript
  it('setProvider opencode usa default anthropic/claude-sonnet-4-6', () => {
    const store = useAiSettingsStore()
    store.setProvider('opencode')
    expect(store.provider).toBe('opencode')
    expect(store.model).toBe('anthropic/claude-sonnet-4-6')
  })

  it('apiKeys.opencode existe por default vacío', () => {
    const store = useAiSettingsStore()
    expect(store.apiKeys.opencode).toBe('')
    store.setApiKey('opencode', 'mypassword')
    expect(store.apiKeys.opencode).toBe('mypassword')
  })

  it('opencodeUrl default es http://localhost:4096 y setOpencodeUrl persiste', () => {
    const store = useAiSettingsStore()
    expect(store.opencodeUrl).toBe('http://localhost:4096')
    store.setOpencodeUrl('http://opencode.lan:9000')
    expect(store.opencodeUrl).toBe('http://opencode.lan:9000')
    const raw = localStorage.getItem('sinpapel-designer/ai-settings')
    expect(JSON.parse(raw).opencodeUrl).toBe('http://opencode.lan:9000')
  })

  it('rehidrata opencodeUrl y apiKeys.opencode desde localStorage', () => {
    localStorage.setItem('sinpapel-designer/ai-settings', JSON.stringify({
      provider: 'opencode',
      model: 'anthropic/claude-opus-4-7',
      apiKeys: { anthropic: '', openai: '', opencode: 'pw' },
      opencodeUrl: 'http://other:5000',
    }))
    const store = useAiSettingsStore()
    expect(store.provider).toBe('opencode')
    expect(store.opencodeUrl).toBe('http://other:5000')
    expect(store.apiKeys.opencode).toBe('pw')
    expect(store.currentApiKey()).toBe('pw')
  })
```

- [ ] **Step 1.2: Correr y verificar que fallan**

```bash
npm test -- --run tests/ai-settings-store.test.js
```

Expected: 4 tests nuevos FAIL (los previos siguen verdes), suite total muestra 4 fallos.

- [ ] **Step 1.3: Modificar `src/stores/aiSettings.js`**

Reemplazar el contenido completo del archivo por:

```javascript
// Sub-proyecto D — Pinia store para settings del generador IA.
// Persiste a localStorage. API keys son del usuario (browser-direct).

import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'sinpapel-designer/ai-settings'

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5',
  opencode: 'anthropic/claude-sonnet-4-6',
}

const DEFAULT_OPENCODE_URL = 'http://localhost:4096'

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
  const apiKeys = ref({
    anthropic: stored?.apiKeys?.anthropic || '',
    openai: stored?.apiKeys?.openai || '',
    opencode: stored?.apiKeys?.opencode || '',
  })
  const opencodeUrl = ref(stored?.opencodeUrl || DEFAULT_OPENCODE_URL)

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          provider: provider.value,
          model: model.value,
          apiKeys: apiKeys.value,
          opencodeUrl: opencodeUrl.value,
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

  function setOpencodeUrl(url) {
    opencodeUrl.value = url
    persist()
  }

  function hasApiKey() {
    // Para opencode, la "key" (password) es opcional — el provider funciona sin auth.
    // Tener el provider seleccionado es suficiente; el hasApiKey() de los demás sigue
    // requiriendo string no vacío.
    if (provider.value === 'opencode') return true
    return Boolean(apiKeys.value[provider.value])
  }

  function currentApiKey() {
    return apiKeys.value[provider.value] || ''
  }

  // persist() debe llamarse desde cada acción que muta state.
  // No usamos watch para evitar persistencia silenciosa cuando
  // consumidores bypassan las actions (e.g. store.provider = 'x'
  // no resetea model al default del nuevo provider).

  return {
    provider, model, apiKeys, opencodeUrl,
    setProvider, setModel, setApiKey, setOpencodeUrl,
    hasApiKey, currentApiKey,
  }
})
```

NOTA importante sobre `hasApiKey()`: el password de OpenCode es OPCIONAL (sólo necesario si el servidor está corriendo con `OPENCODE_SERVER_PASSWORD`). Devolvemos `true` para opencode siempre — `AiGeneratorPage` sólo usa `hasApiKey()` para decidir si abrir el settings dialog automáticamente. Para opencode, no queremos forzar password.

- [ ] **Step 1.4: Correr tests, verificar PASS**

```bash
npm test -- --run tests/ai-settings-store.test.js
```

Expected: 9 PASS (5 originales + 4 nuevos).

- [ ] **Step 1.5: Suite completa + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan. NOTA: el cambio a `hasApiKey()` puede afectar los tests existentes de `tests/llm-service.test.js` (uno que verifica `MissingApiKeyError` cuando no hay key). Verifica que ese test sigue verde — debería, porque su provider default es `'anthropic'` y la key inicial es vacía.

- [ ] **Step 1.6: Commit**

```bash
git add src/stores/aiSettings.js tests/ai-settings-store.test.js
git commit -m "$(cat <<'EOF'
feat(ai): extender aiSettings store para opencode

OpenCode como tercer provider. apiKeys.opencode (password
opcional para HTTP basic), opencodeUrl (default http://localhost:4096),
setOpencodeUrl action, default model anthropic/claude-sonnet-4-6.
hasApiKey() devuelve true para opencode siempre (auth opcional).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: opencode adapter

**Files:**
- Create: `src/services/llmAdapters/opencode.js`
- Test: `tests/llm-adapter-opencode.test.js`

- [ ] **Step 2.1: Crear test que falla**

Crear `tests/llm-adapter-opencode.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { call } from '../src/services/llmAdapters/opencode.js'
import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../src/services/llmService.js'

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

describe('opencode adapter', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('happy path: crea sesión y envía prompt con shape correcto', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-1' }))
      .mockResolvedValueOnce(jsonResponse(200, {
        info: { id: 'msg-1' },
        parts: [{ type: 'text', text: 'hola mundo' }],
      }))

    const result = await call({
      apiKey: '',
      model: 'anthropic/claude-sonnet-4-6',
      system: 'SYS',
      userMessage: 'USER',
      opencodeUrl: 'http://localhost:4096',
    })

    expect(result.text).toBe('hola mundo')
    expect(global.fetch).toHaveBeenCalledTimes(2)

    // primer call: session create
    expect(global.fetch.mock.calls[0][0]).toBe('http://localhost:4096/session')
    expect(global.fetch.mock.calls[0][1].method).toBe('POST')
    const sessionBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(sessionBody).toEqual({ title: 'sinpapel-designer' })
    expect(global.fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization')

    // segundo call: prompt
    expect(global.fetch.mock.calls[1][0]).toBe('http://localhost:4096/session/sess-1/prompt')
    expect(global.fetch.mock.calls[1][1].method).toBe('POST')
    const promptBody = JSON.parse(global.fetch.mock.calls[1][1].body)
    expect(promptBody).toEqual({
      model: { providerID: 'anthropic', modelID: 'claude-sonnet-4-6' },
      parts: [{ type: 'text', text: 'USER' }],
      system: 'SYS',
      tools: [],
    })
  })

  it('con password: incluye Authorization: Basic en ambos POSTs', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-2' }))
      .mockResolvedValueOnce(jsonResponse(200, { parts: [{ type: 'text', text: 'ok' }] }))

    await call({
      apiKey: 'secretpw',
      model: 'anthropic/claude-sonnet-4-6',
      system: 'S',
      userMessage: 'U',
      opencodeUrl: 'http://localhost:4096',
    })

    const expectedHeader = 'Basic ' + btoa('opencode:secretpw')
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe(expectedHeader)
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe(expectedHeader)
  })

  it('split de model: anthropic/claude-sonnet-4-6 -> providerID + modelID', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-3' }))
      .mockResolvedValueOnce(jsonResponse(200, { parts: [{ type: 'text', text: 'x' }] }))

    await call({
      apiKey: '',
      model: 'openai/gpt-4-turbo',
      system: 'S',
      userMessage: 'U',
      opencodeUrl: 'http://localhost:4096',
    })

    const promptBody = JSON.parse(global.fetch.mock.calls[1][1].body)
    expect(promptBody.model).toEqual({ providerID: 'openai', modelID: 'gpt-4-turbo' })
  })

  it('lanza ApiAuthError con 401 en session create', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(401, { error: { message: 'auth' } }))
    await expect(call({
      apiKey: 'bad', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })).rejects.toBeInstanceOf(ApiAuthError)
    expect(global.fetch).toHaveBeenCalledTimes(1) // no llega al segundo POST
  })

  it('lanza ApiRateLimitError con 429 en prompt', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-4' }))
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: 'rate' } }))
    await expect(call({
      apiKey: '', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })).rejects.toBeInstanceOf(ApiRateLimitError)
  })

  it('lanza ApiNetworkError si fetch lanza (server down)', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('failed to fetch'))
    await expect(call({
      apiKey: '', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })).rejects.toBeInstanceOf(ApiNetworkError)
  })

  it('propaga AbortError sin envolverlo', async () => {
    const abortErr = new DOMException('aborted', 'AbortError')
    global.fetch.mockRejectedValueOnce(abortErr)
    await expect(call({
      apiKey: '', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })).rejects.toBe(abortErr)
  })

  it('filtra parts a sólo type=text y concatena (ignora tool calls u otros)', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-5' }))
      .mockResolvedValueOnce(jsonResponse(200, {
        parts: [
          { type: 'text', text: 'parte1 ' },
          { type: 'tool_use', name: 'shell' },
          { type: 'text', text: 'parte2' },
        ],
      }))
    const result = await call({
      apiKey: '', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })
    expect(result.text).toBe('parte1 parte2')
  })
})
```

- [ ] **Step 2.2: Test debe fallar (archivo no existe)**

```bash
npm test -- --run tests/llm-adapter-opencode.test.js
```

Expected: import error o 8 FAIL.

- [ ] **Step 2.3: Crear `src/services/llmAdapters/opencode.js`**

```javascript
// Sub-proyecto D — OpenCode HTTP server adapter (opencode serve).
// Browser-direct: requiere `opencode serve --cors` para CORS.
// Auth opcional via HTTP basic (username fijo 'opencode' + password = apiKey).
// Flujo de 2 round-trips: POST /session (crea sesión efímera) + POST /session/:id/prompt.

import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../llmService.js'

function buildHeaders(apiKey) {
  const headers = { 'content-type': 'application/json' }
  if (apiKey) {
    headers.Authorization = 'Basic ' + btoa('opencode:' + apiKey)
  }
  return headers
}

async function postJson(url, body, apiKey, signal) {
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      signal,
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    throw new ApiNetworkError(e.message || 'Falla de red')
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
      throw new ApiAuthError(detail || 'Password OpenCode inválido')
    }
    if (response.status === 429) {
      throw new ApiRateLimitError(detail || 'Rate limit excedido')
    }
    throw new ApiResponseError(detail || `Error HTTP ${response.status}`, response.status)
  }

  return response.json()
}

function splitModel(model) {
  const sepIdx = (model || '').indexOf('/')
  if (sepIdx === -1) return { providerID: model || '', modelID: '' }
  return {
    providerID: model.slice(0, sepIdx),
    modelID: model.slice(sepIdx + 1),
  }
}

function extractText(parts) {
  if (!Array.isArray(parts)) return ''
  return parts.filter((p) => p?.type === 'text').map((p) => p.text || '').join('')
}

export async function call({ apiKey, model, system, userMessage, opencodeUrl, signal }) {
  const baseUrl = opencodeUrl || 'http://localhost:4096'

  // 1. Crear sesión efímera
  const session = await postJson(
    `${baseUrl}/session`,
    { title: 'sinpapel-designer' },
    apiKey,
    signal,
  )
  const sessionId = session?.id
  if (!sessionId) {
    throw new ApiResponseError('OpenCode session sin id en la respuesta')
  }

  // 2. Enviar prompt
  const { providerID, modelID } = splitModel(model)
  const data = await postJson(
    `${baseUrl}/session/${sessionId}/prompt`,
    {
      model: { providerID, modelID },
      parts: [{ type: 'text', text: userMessage }],
      system,
      tools: [],
    },
    apiKey,
    signal,
  )

  return { text: extractText(data?.parts) }
}
```

- [ ] **Step 2.4: Correr y verificar PASS**

```bash
npm test -- --run tests/llm-adapter-opencode.test.js
```

Expected: 8 PASS.

- [ ] **Step 2.5: Suite + lint**

```bash
npm test -- --run && npm run lint
```

- [ ] **Step 2.6: Commit**

```bash
git add src/services/llmAdapters/opencode.js tests/llm-adapter-opencode.test.js
git commit -m "$(cat <<'EOF'
feat(ai): OpenCode adapter (HTTP server local)

Adapter para opencode serve. 2 round-trips: POST /session
(efímera, title 'sinpapel-designer') + POST /session/:id/prompt
con model {providerID, modelID} parseado por split en '/'. Auth
HTTP basic opcional (username fijo 'opencode'). tools=[] para
forzar respuesta de texto. Filtra parts a type=text. Misma
maquinaria de errores tipados que anthropic/openai.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Registrar opencode en llmService dispatcher

**Files:**
- Modify: `src/services/llmService.js`
- Modify: `tests/llm-service.test.js`

- [ ] **Step 3.1: Añadir test que falla**

Anexar al final del `describe('llmService.generate', ...)` en `tests/llm-service.test.js` (antes del cierre `})`):

```javascript
  it('despacha al adapter OpenCode cuando provider=opencode y pasa opencodeUrl', async () => {
    const opencodeMock = vi.fn().mockResolvedValue({ text: 'r3' })
    vi.doMock('../src/services/llmAdapters/anthropic.js', () => ({ call: vi.fn() }))
    vi.doMock('../src/services/llmAdapters/openai.js', () => ({ call: vi.fn() }))
    vi.doMock('../src/services/llmAdapters/opencode.js', () => ({ call: opencodeMock }))
    const { generate } = await import('../src/services/llmService.js')
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')
    const store = useAiSettingsStore()
    store.setProvider('opencode')
    store.setOpencodeUrl('http://localhost:9999')

    const result = await generate('descripcion')
    expect(result).toBe('r3')
    expect(opencodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: '',
        model: 'anthropic/claude-sonnet-4-6',
        opencodeUrl: 'http://localhost:9999',
      }),
    )
  })
```

NOTA: el test no setea apiKey de opencode porque ahora `hasApiKey()` devuelve `true` para opencode siempre (cambio de Task 1).

- [ ] **Step 3.2: Test debe fallar**

```bash
npm test -- --run tests/llm-service.test.js
```

Expected: 4 PASS + 1 FAIL (el nuevo, porque el adapter no está registrado y opencodeUrl no se pasa).

- [ ] **Step 3.3: Modificar `src/services/llmService.js`**

Reemplazar el bloque de imports + `ADAPTERS` + `generate()`. El archivo completo debe quedar:

```javascript
// Sub-proyecto D — LLM Service entry point + error classes + dispatcher.

import { useAiSettingsStore } from '../stores/aiSettings.js'
import { call as anthropicCall } from './llmAdapters/anthropic.js'
import { call as openaiCall } from './llmAdapters/openai.js'
import { call as opencodeCall } from './llmAdapters/opencode.js'
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
  opencode: opencodeCall,
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
    opencodeUrl: store.opencodeUrl,
  })
  return result.text
}
```

NOTA: `opencodeUrl` se pasa SIEMPRE como prop extra. Los adapters de anthropic/openai lo reciben pero lo ignoran (sus signatures usan destructuring de campos específicos). El opencode adapter lo lee.

- [ ] **Step 3.4: Correr y verificar PASS**

```bash
npm test -- --run tests/llm-service.test.js
```

Expected: 5 PASS.

- [ ] **Step 3.5: Suite + lint**

```bash
npm test -- --run && npm run lint
```

- [ ] **Step 3.6: Commit**

```bash
git add src/services/llmService.js tests/llm-service.test.js
git commit -m "$(cat <<'EOF'
feat(ai): registrar opencode adapter en dispatcher

llmService.generate ahora despacha a opencode cuando
provider=opencode. opencodeUrl se pasa siempre en las opciones
del adapter (los demás lo ignoran via destructuring).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extender AiSettingsDialog

**Files:**
- Modify: `src/components/AiSettingsDialog.vue`
- Modify: `tests/ai-settings-dialog.test.js`

- [ ] **Step 4.1: Añadir test que falla**

Anexar al final del `describe('AiSettingsDialog', ...)` en `tests/ai-settings-dialog.test.js` (antes del cierre `})`):

```javascript
  it('cuando provider=opencode muestra inputs URL y password', async () => {
    const AiSettingsDialog = (await import('../src/components/AiSettingsDialog.vue')).default

    const wrapper = mount(AiSettingsDialog, {
      props: { modelValue: true },
      global: { stubs: COMMON_STUBS },
    })

    await wrapper.find('select[data-field="Provider"]').setValue('opencode')
    await flushPromises()

    expect(wrapper.find('input[data-field="URL del servidor OpenCode"]').exists()).toBe(true)
    expect(wrapper.find('input[data-field="Password OpenCode (opcional)"]').exists()).toBe(true)
  })

  it('Guardar con provider=opencode persiste opencodeUrl y password al store', async () => {
    const AiSettingsDialog = (await import('../src/components/AiSettingsDialog.vue')).default
    const { useAiSettingsStore } = await import('../src/stores/aiSettings.js')

    const wrapper = mount(AiSettingsDialog, {
      props: { modelValue: true },
      global: { stubs: COMMON_STUBS },
    })

    await wrapper.find('select[data-field="Provider"]').setValue('opencode')
    await flushPromises()
    await wrapper.find('input[data-field="URL del servidor OpenCode"]').setValue('http://opencode.lan:5000')
    await wrapper.find('input[data-field="Password OpenCode (opcional)"]').setValue('pw123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const store = useAiSettingsStore()
    expect(store.provider).toBe('opencode')
    expect(store.opencodeUrl).toBe('http://opencode.lan:5000')
    expect(store.apiKeys.opencode).toBe('pw123')
  })
```

- [ ] **Step 4.2: Test debe fallar**

```bash
npm test -- --run tests/ai-settings-dialog.test.js
```

Expected: 2 PASS (originales) + 2 FAIL (nuevos).

- [ ] **Step 4.3: Reemplazar `src/components/AiSettingsDialog.vue`**

Contenido completo del archivo:

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

          <!-- Campos extra cuando provider=opencode -->
          <template v-if="form.provider === 'opencode'">
            <q-input
              v-model="form.opencodeUrl"
              label="URL del servidor OpenCode"
              placeholder="http://localhost:4096"
              dense
            />
            <q-input
              v-model="form.apiKeys.opencode"
              label="Password OpenCode (opcional)"
              :type="showOpencode ? 'text' : 'password'"
              dense
            >
              <template #append>
                <q-btn flat dense round :icon="showOpencode ? 'visibility_off' : 'visibility'" @click="showOpencode = !showOpencode" />
              </template>
            </q-input>
            <div class="text-caption text-grey-7">
              OpenCode debe estar corriendo con <code>opencode serve --cors</code>.
              Si configuraste <code>OPENCODE_SERVER_PASSWORD</code>, ponlo en el campo Password.
            </div>
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
import { useAiSettingsStore } from 'src/stores/aiSettings.js'

const PROVIDER_OPTIONS = [
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'OpenCode', value: 'opencode' },
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
  opencode: [
    { label: 'Anthropic / Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4-6' },
    { label: 'Anthropic / Claude Opus 4.7', value: 'anthropic/claude-opus-4-7' },
    { label: 'OpenAI / GPT-5', value: 'openai/gpt-5' },
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
const showOpencode = ref(false)

const form = ref({
  provider: store.provider,
  model: store.model,
  apiKeys: { ...store.apiKeys },
  opencodeUrl: store.opencodeUrl,
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
        opencodeUrl: store.opencodeUrl,
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
  store.setApiKey('opencode', form.value.apiKeys.opencode || '')
  store.setOpencodeUrl(form.value.opencodeUrl)
  emit('update:modelValue', false)
}
</script>
```

- [ ] **Step 4.4: Correr y verificar PASS**

```bash
npm test -- --run tests/ai-settings-dialog.test.js
```

Expected: 4 PASS (2 originales + 2 nuevos).

- [ ] **Step 4.5: Suite + lint**

```bash
npm test -- --run && npm run lint
```

Expected: todos pasan.

- [ ] **Step 4.6: Commit**

```bash
git add src/components/AiSettingsDialog.vue tests/ai-settings-dialog.test.js
git commit -m "$(cat <<'EOF'
feat(ai): AiSettingsDialog soporta OpenCode

Tercera opción 'OpenCode' en provider select + lista de modelos
formato 'providerID/modelID'. Cuando provider=opencode aparecen
2 inputs extra: URL del servidor (default localhost:4096) y
password opcional con show/hide. Hint visible recordando los
flags necesarios (--cors, OPENCODE_SERVER_PASSWORD).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Verificación end-to-end + push

- [ ] **Step 5.1: Arrancar dev server**

```bash
npm run dev
```

Abrir browser en la URL impresa.

- [ ] **Step 5.2: Recorrer el flujo dorado con OpenCode local**

Pre-requisito: tener OpenCode instalado y al menos un provider configurado del lado del CLI (Anthropic o OpenAI key en `~/.config/opencode` o env).

1. En otra terminal: `opencode serve --cors`. Esperar mensaje `Server listening on http://127.0.0.1:4096`.
2. En el browser, drawer → Generador IA → Settings.
3. Provider = OpenCode. Verificar que aparecen los 2 campos extra (URL + Password).
4. Dejar URL `http://localhost:4096`, password vacío. Model `anthropic/claude-sonnet-4-6`.
5. Guardar.
6. Textarea: "Flujo simple de aprobación con 3 estados (inicio, revisión, aprobado), 2 grupos (revisor, aprobador)."
7. Generar. Esperar (puede tardar 5-30s, 2 round-trips + LLM).
8. Verificar Preview muestra los counts esperados (3 estados, 2 grupos, 2 transiciones).
9. Aplicar → redirect al canvas con el flujo.

- [ ] **Step 5.3: Recorrer caso de error: server no corriendo**

1. Detener `opencode serve`.
2. Click Generar otra vez.
3. Verificar error en preview: "Sin conexión al provider."

- [ ] **Step 5.4: Recorrer caso de error: password incorrecta**

1. Iniciar `OPENCODE_SERVER_PASSWORD=secret opencode serve --cors`.
2. En Settings, dejar password vacío. Guardar.
3. Generar → error "Password OpenCode inválido" / "API key inválida o sin permisos."
4. Editar password = `secret`, Guardar, Generar de nuevo → debe funcionar.

- [ ] **Step 5.5: Cambiar entre providers**

1. Cambiar provider a Anthropic en Settings (verificar que los campos extra de OpenCode desaparecen).
2. Cambiar a OpenAI (mismo behavior).
3. Volver a OpenCode (los campos aparecen con los valores persistidos).

- [ ] **Step 5.6: Push**

```bash
git push
```

Expected: 4 commits pusheados a `origin/develop`.
