# Spec — Generador IA de flujos

**Fecha:** 2026-05-17
**Sub-proyecto:** D (último de A→B→C→D; C se fusionó con B)
**Estado:** Aprobado por el usuario en alcance, pendiente review del spec escrito

## Contexto

Los sub-proyectos A (botón "+" en panel), B (reglas por transición + requisitos) y la integración del schema v0.2 (S27.x) cierran la edición manual del workflow. Falta el último: que un usuario pueda **describir en lenguaje natural el flujo que quiere y obtener una propuesta de JSON v0.2 lista para aplicar**.

Hoy el designer es 100% client-side (Vue/Quasar + localStorage). No hay backend de LLM ni env vars de AI. `syncService.js` es stub. Ni sinpapel ni sinpapel-drf tienen integración LLM.

## Objetivo

Permitir generar un flujo completo (estados, etapas, grupos, tipos_documento, transiciones con grupos_permitidos y condiciones, requisitos documentales) a partir de un prompt en español, previsualizar el resultado, y aplicarlo como un nuevo flujo en el localStorage del designer.

## Decisiones clave (alineadas con el usuario)

- **D1**: Browser-direct. El usuario pega su propia API key en una pantalla de settings; se guarda en localStorage. Sin backend.
- **D2**: Multi-provider con selector (Anthropic + OpenAI en v1). Adapters thin con interfaz común.
- **D3**: Input UX = textarea libre con prompt + placeholder con ejemplos.
- **D4**: Output UX = preview con resumen + JSON expandible + botón "Aplicar" + botón "Descartar".
- **D5**: Aplicar siempre crea un flujo nuevo (no sobre-escribe el activo). Reutiliza `store.loadFromFile`.
- **D6**: Generación cubre TODO: catálogos + transiciones + grupos_permitidos + condiciones + requisitos. La validación cliente avisa pero no bloquea cuando hay configs sospechosas.
- **D7**: Single-shot (sin chat iteración). Loading state durante la llamada.

## Out of scope (v1)

- Streaming de respuesta.
- Iteración tipo chat ("ahora añade un paso de revisión legal").
- Edit del prompt-template desde la UI.
- Soporte para modelos locales (Ollama).
- Backend proxy / key compartida entre usuarios.
- Generación parcial (sólo estados, sólo transiciones).
- Templates predefinidos / wizard estructurado.

## Arquitectura

100% client-side. Cada generación es una request HTTP directa desde el browser al provider seleccionado.

```
┌─────────────────────────────────────────────────────────────┐
│  AiGeneratorPage (nueva ruta /ai-generator)                 │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ AiSettingsDialog (key + provider + model)           │   │
│   └─────────────────────────────────────────────────────┘   │
│   ┌────────────────────────┐  ┌──────────────────────┐      │
│   │ Prompt input           │  │ AiGeneratorPreview   │      │
│   │ (textarea + Generar)   │  │ (counts + warnings   │      │
│   └────────────────────────┘  │  + JSON expandible)  │      │
│                               │ Aplicar / Descartar  │      │
│                               └──────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
  llmService.generate(userPrompt) → JSON string
         │
    ┌────┴────┐
    ▼         ▼
anthropic   openai     (adapters, interfaz común)
  api        api
```

## Componentes

### 1. `src/stores/aiSettings.js` (Pinia)

State:
- `provider: 'anthropic' | 'openai'` (default `'anthropic'`).
- `model: string` (default `'claude-sonnet-4-6'` cuando provider=anthropic, `'gpt-5'` cuando openai).
- `apiKeys: { anthropic: string, openai: string }`.

Acciones:
- `setProvider(p)`, `setModel(m)`, `setApiKey(provider, key)`.
- `hasApiKey()` → bool sobre el provider actual.
- `currentApiKey()` → string del provider activo.

Persistencia: localStorage key `sinpapel-designer/ai-settings` (JSON). Carga al instanciar el store.

### 2. `src/services/llmService.js`

Entry point único:

```js
async function generate(userPrompt: string, opts?: { signal? }): Promise<string>
```

Comportamiento:
1. Lee `aiSettings` store.
2. Si `!hasApiKey()` → lanza `MissingApiKeyError`.
3. Construye prompt (system + few-shot + user) vía `buildPrompt(userPrompt)`.
4. Despacha al adapter correspondiente (`anthropic` o `openai`).
5. Devuelve el contenido raw (string) del primer mensaje del LLM.
6. Errores normalizados: `MissingApiKeyError`, `ApiAuthError` (401), `ApiRateLimitError` (429), `ApiNetworkError`, `ApiResponseError` (otros).

### 3. Adapters

#### `src/services/llmAdapters/anthropic.js`

```js
async function call({ apiKey, model, system, messages, signal }): Promise<{ text: string }>
```

POST a `https://api.anthropic.com/v1/messages` con headers:
- `x-api-key: ${apiKey}`
- `anthropic-version: 2023-06-01`
- `anthropic-dangerous-direct-browser-access: true`
- `content-type: application/json`

Body: `{ model, max_tokens: 4096, system, messages: [{role: 'user', content}] }`.

Parsea `response.content[0].text`. Maneja errores HTTP con `status` mapping.

#### `src/services/llmAdapters/openai.js`

```js
async function call({ apiKey, model, system, messages, signal }): Promise<{ text: string }>
```

POST a `https://api.openai.com/v1/chat/completions` con `Authorization: Bearer ${apiKey}`.

Body: `{ model, max_tokens: 4096, messages: [{role:'system', content: system}, {role:'user', content}] }`.

Parsea `response.choices[0].message.content`. Misma mapping de errores.

### 4. `src/services/llmPrompts/workflowGenerator.js`

Export `buildPrompt(userDescription)` que devuelve `{ system, userMessage }`.

**System prompt** (esquema completo + reglas + few-shot):
- Rol y objetivo.
- Schema v0.2 documentado (catalogos, flujo, transiciones, condiciones por tipo, requisitos).
- Reglas: devolver SÓLO un objeto JSON; sin markdown; sin explicaciones.
- Reglas semánticas:
  - `estados[*].nombre` único, UPPER_SNAKE.
  - `transiciones[*].estado_origen/destino` referencian `nombres` existentes.
  - `transiciones[*].grupos_permitidos[*]` referencian `catalogos.grupos[*].name`.
  - `condiciones[*].tipo ∈ {'python_path','json_logic','django_orm'}`.
  - `requisitos[*].tipo_documento` ∈ `catalogos.tipos_documento[*].nombre`.
  - Si no necesita un tipo, omite la condición (no rellenar con placeholders).
- 1 ejemplo few-shot completo (flujo de aprobación con 3 estados, 2 grupos, 1 condición json_logic, 1 requisito documental). Pequeño pero completo.

**User message**: `"Genera el JSON v0.2 para el siguiente flujo:\n\n${userDescription}"`.

### 5. `src/components/AiSettingsDialog.vue`

Props: `modelValue` (boolean).
Form:
- `q-select` provider (Anthropic / OpenAI).
- `q-select` model (lista por provider: Anthropic = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'], OpenAI = ['gpt-5', 'gpt-4-turbo']).
- `q-input` "Anthropic API key" (`type="password"` con toggle show/hide).
- `q-input` "OpenAI API key" (idem).
- Warning visible: "Tu API key se almacena localmente en este navegador. No la compartas."

Botones: Cancelar, Guardar.

Al guardar: llama al store, cierra dialog.

### 6. `src/components/AiGeneratorPreview.vue`

Props: `result: ParsedV0_2 | null`, `validationWarnings: string[]`.

Muestra:
- Resumen tarjetas: # estados, # etapas, # grupos, # tipos_documento, # transiciones, # condiciones (sumadas), # requisitos.
- Lista colapsada de cada catálogo (primeros 5 + "ver más").
- Warnings con icono ⚠ si los hay.
- JSON crudo en un `<details>` colapsado.

Slots: `#actions` para botones (Aplicar / Descartar) que la página pasa.

### 7. `src/pages/AiGeneratorPage.vue`

Layout:
- Header: "Generador IA" + botón "⚙ Settings" abre `AiSettingsDialog`.
- Columna izquierda: textarea grande con placeholder "Describe el flujo... Ejemplo: trámite de afiliación al IMSS con 4 estados...", botón "Generar" (disabled si textarea vacío o si genera).
- Columna derecha: estado vacío / loading spinner / `AiGeneratorPreview` con resultado.
- Estado:
  - `prompt: ref('')`
  - `loading: ref(false)`
  - `error: ref(null)`
  - `rawResponse: ref(null)`
  - `parsed: ref(null)` (resultado de parseV0_2)
  - `warnings: ref([])`
- Al click Generar:
  1. Si `!aiSettings.hasApiKey()` → abre Settings dialog.
  2. Else: `loading = true`, llama `llmService.generate(prompt)`.
  3. Recibe string → intenta extraer JSON (regex `/{[\s\S]*}/` por si viene en markdown), `JSON.parse`, `validateSchema`, `parseV0_2`.
  4. Si falla cualquier paso → `error = ...`, `rawResponse = string` para debugging.
  5. Si ok → `parsed = state`, `warnings = computeWarnings(state)`.
- Al click Aplicar:
  1. Construye un `Blob` con `JSON.stringify(serialized)`.
  2. Construye un `File` desde el Blob.
  3. Llama `store.loadFromFile(file)` (path existente que valida + crea flujo + persiste).
  4. `router.push({ name: 'workflow-canvas', params: { id: newId }})`.

Función `computeWarnings(state)`:
- Para cada `transicion.condiciones[*]`:
  - tipo desconocido → warning "Condición {idx}: tipo '{x}' no es soportado por el designer."
  - `json_logic` con `configuracion.rule` no parseable → warning.
  - `python_path` con path vacío → warning.
  - `django_orm` con lookup vacío → warning.
- Para cada `requisitos[*]`:
  - `tipo_documento` no presente en `catalogos.tipos_documento` → warning.

### 8. Rutas + navegación

- `src/router/routes.js` añade `{ path: 'ai-generator', name: 'ai-generator', component: () => import('pages/AiGeneratorPage.vue') }` dentro del layout existente.
- `src/layouts/MainLayout.vue` añade entry de navegación (botón o item de menú) con icon `auto_awesome` y label "Generador IA".

## Data flow

```
User en /ai-generator
  ▼
Sin API key → AiSettingsDialog auto-abre con mensaje
  ▼
User configura provider + key → Guardar
  ▼
User escribe descripción → clic "Generar"
  ▼
loading = true
  ▼
llmService.generate(prompt)
  → buildPrompt(prompt) → { system, userMessage }
  → adapter.call(...) → POST a API → text response
  ▼
Try extract JSON → JSON.parse → validateSchema → parseV0_2
  ├─ fail: error = '...', rawResponse expuesto, botón "Reintentar"
  └─ ok: parsed + warnings calculadas
  ▼
Preview muestra: resumen + warnings + JSON expandible
  ▼
User clic "Aplicar"
  ▼
new Blob([JSON.stringify(serializeV0_2(parsed))]) → new File(...)
  ▼
store.loadFromFile(file) → genera id nuevo, persiste, set current
  ▼
router.push({ name: 'workflow-canvas', params: { id: newId }})
```

## Errores

| Caso | UX |
|---|---|
| Sin API key | Settings dialog se abre con texto "Configura tu API key para usar el generador." |
| 401 del provider | Notify negativo "API key inválida o sin permisos." Settings dialog se abre. |
| 429 rate limit | Notify "Demasiadas requests, espera unos segundos." |
| Network error | Notify "Sin conexión al provider." |
| LLM devuelve no-JSON parseable | Mostrar mensaje en preview + rawResponse expandible + botón Reintentar. |
| JSON parsea pero no pasa validateSchema | Mensaje del validateSchema en preview + Reintentar. |
| Apply falla (localStorage lleno) | Notify negativo. JSON queda visible para copy/paste manual. |
| Condición / requisito inválido en preview | Warning amarillo, NO bloquea Aplicar. |

## Seguridad

- API keys nunca salen del cliente. Dos warnings visibles en `AiSettingsDialog`: "Tu API key se almacena localmente en este navegador (localStorage). No la compartas. No la uses en computadoras públicas."
- Tipo `password` con toggle "show/hide" en los inputs.
- El input del usuario se incluye textual en el prompt — no se sanitiza (es texto a LLM, no SQL/HTML).
- El JSON parseado se valida con `validateSchema` antes de cualquier persistencia.
- `dangerouslyAllowBrowser` (header equivalente Anthropic) y CORS abiertos de OpenAI son riesgos conocidos: la key viaja por TLS pero un script de tercero en la página podría leerla del localStorage. Mitigación: documentación; aceptado para herramienta interna.

## Testing

### Unit (vitest)

- `tests/ai-settings-store.test.js` (4-5 tests):
  - Default provider='anthropic', model coincide.
  - `setApiKey` actualiza por provider y persiste localStorage.
  - `hasApiKey()` true/false por provider.
  - `currentApiKey()` devuelve la del provider activo.
- `tests/llm-adapter-anthropic.test.js` (3-4 tests):
  - Mock fetch: verifica URL, headers (`x-api-key`, `anthropic-version`), body shape.
  - Parsea `content[0].text`.
  - Lanza error tipado por 401 / 429 / 5xx.
- `tests/llm-adapter-openai.test.js` (3-4 tests análogos).
- `tests/llm-prompt-builder.test.js` (2-3 tests):
  - `buildPrompt` incluye descripción del usuario en `userMessage`.
  - `system` incluye claves esperadas: "JSON v0.2", "catalogos", "transiciones", lista de tipos de condicion.
- `tests/llm-service.test.js` (3-4 tests):
  - Lanza `MissingApiKeyError` si no hay key.
  - Dispatcha al adapter correcto según provider.
  - Propaga errores tipados.
- `tests/ai-generator-preview.test.js` (3-4 tests):
  - Counts correctos para un parsed state dado.
  - Warnings render cuando se pasan.
- `tests/ai-generator-page.test.js` (3-4 tests integración):
  - Click Generar sin key → abre Settings dialog.
  - Generar con key y response válido → renderiza preview.
  - Click Aplicar → llama `store.loadFromFile` con blob equivalente.
  - Generar con response no-JSON → muestra error.

### Manual

1. Configurar API key real (Anthropic).
2. Prompt: "Trámite de afiliación al IMSS con 4 estados (inicio, validación, aprobación, completado), 2 grupos (validador, aprobador), un documento INE requerido al validar."
3. Verificar preview tiene los counts esperados, sin warnings.
4. Aplicar → confirma redirect al canvas con el flujo visible.
5. Repetir con prompt que provoque condiciones (e.g., "monto > 100,000 requiere VoBo extra") → verificar que se generan condiciones json_logic.

## Decisiones (resumen)

- **D1**: Browser-direct, no backend.
- **D2**: Multi-provider (Anthropic + OpenAI) con adapter pattern. Modelo default por provider.
- **D3**: Textarea libre, sin formulario estructurado.
- **D4**: Preview con counts + warnings + JSON crudo.
- **D5**: Aplicar = `store.loadFromFile` (siempre crea nuevo flujo).
- **D6**: Generar todo incluido. Validación cliente avisa pero no bloquea.
- **D7**: Single-shot, sin chat iteración.

## Riesgos

- **Alto**: LLM produce condiciones inválidas (python_path inexistente, json_logic mal formado). Mitigado con: system prompt explícito, few-shot, validación cliente con warnings, posibilidad de Aplicar igual.
- **Medio**: respuesta no-JSON (LLM ignora instrucción). Mitigado con: extracción tolerante (regex `/{[\s\S]*}/`), botón Reintentar, rawResponse visible.
- **Medio**: cost / tokens. System prompt ~3-5k tokens + few-shot ~1k + response ~1-3k. ~$0.01-0.05 por generación según provider. Aceptable en uso interno.
- **Medio**: CORS / `dangerouslyAllowBrowser`. Mitigado con warning visible en Settings.
- **Bajo**: localStorage quota si el usuario aplica muchos flujos generados. `store.loadFromFile` ya maneja QuotaExceeded con notify.

## Componentes nuevos vs. modificados

**Nuevos:**
- `src/stores/aiSettings.js`
- `src/services/llmService.js`
- `src/services/llmAdapters/anthropic.js`
- `src/services/llmAdapters/openai.js`
- `src/services/llmPrompts/workflowGenerator.js`
- `src/components/AiSettingsDialog.vue`
- `src/components/AiGeneratorPreview.vue`
- `src/pages/AiGeneratorPage.vue`
- 7 archivos de tests (uno por unidad)

**Modificados:**
- `src/router/routes.js` (añadir ruta).
- `src/layouts/MainLayout.vue` (añadir entry de nav).

**Sin cambios:**
- Schema v0.2 (ya cubre todo lo que el LLM puede generar).
- Store de workflow (reutiliza `loadFromFile`).
- Backend (no se toca).
