# Spec — Provider OpenCode para Generador IA

**Fecha:** 2026-05-18
**Sub-proyecto:** extensión de D (generador IA). Añade un tercer provider al stack existente Anthropic + OpenAI.
**Estado:** Aprobado por el usuario en alcance, pendiente review del spec escrito

## Contexto

El sub-proyecto D (commits `9e57980..5c7e95c` en `develop`) entregó el generador IA con dos providers (Anthropic, OpenAI), arquitectura browser-direct, prompt builder con schema v0.2, preview con warnings, y aplicación vía `store.loadFromFile`.

El usuario pide ampliar a un tercer provider: **OpenCode CLI** (`opencode.ai`), que es un agente CLI con modo servidor HTTP. La integración no es OpenAI-compatible; OpenCode expone su propia API REST con flujo de sesión.

## Objetivo

Permitir al usuario seleccionar OpenCode como provider en el dialog de settings y generar workflows usando una instancia local (o remota) de `opencode serve`. El path debe reutilizar al máximo la infraestructura existente (`generate()`, `buildPrompt()`, `AiGeneratorPage`, `AiGeneratorPreview`).

## Decisiones clave (alineadas con el usuario)

- **D1**: `model` se almacena como string compuesto `'providerID/modelID'` (ej. `'anthropic/claude-sonnet-4-6'`). El adapter hace split en el primer `/`.
- **D2**: URL del servidor OpenCode es configurable (default `http://localhost:4096`).
- **D3**: Password (HTTP basic) opcional. Username fijo `'opencode'` per documentación.
- **D4**: `tools: []` en el request para forzar respuesta de texto sin acciones.
- **D5**: Sesión fresca por generación (single-shot consistente con D7 del sub-D original).
- **D6**: Parsing manual de la respuesta (no usamos `structured_output` con JSON schema en v1).

## Out of scope (v1)

- Reuso de sesiones entre generaciones.
- `structured_output` con JSON-schema constraint.
- Auto-detección de OpenCode corriendo en localhost.
- Soporte para agent presets de OpenCode (`plan`, etc.) — usamos default.
- UI para crear/listar/borrar sesiones (single-shot, sesiones son efímeras).

## Arquitectura

100% client-side, mismo modelo que los otros providers. Diferencia clave: dos round-trips HTTP por generación (crear sesión + enviar prompt).

```
generate(prompt)
  ▼
llmService.generate (existing)
  ▼
Lee aiSettings: { provider: 'opencode', model: 'anthropic/claude-sonnet-4-6', opencodeUrl: 'http://localhost:4096', apiKeys.opencode: '<password|''>' }
  ▼
buildPrompt(prompt) → { system, userMessage }   (existing)
  ▼
opencodeAdapter.call({
  apiKey: password,        // '' si no hay
  model: 'anthropic/claude-sonnet-4-6',
  system, userMessage,
  opencodeUrl,
  signal,
})
  │
  ├── POST {opencodeUrl}/session
  │     headers: Authorization: Basic base64('opencode:password') si apiKey
  │     body: { title: 'sinpapel-designer' }
  │     → { id: 'sess-xxx' }
  │
  └── POST {opencodeUrl}/session/sess-xxx/prompt
        body: {
          model: { providerID: 'anthropic', modelID: 'claude-sonnet-4-6' },
          parts: [{ type: 'text', text: userMessage }],
          system,
          tools: [],
        }
        → { info: AssistantMessage, parts: Part[] }
        text = parts.filter(p => p.type === 'text').map(p => p.text).join('')
        → { text }
```

## Componentes

### 1. `src/services/llmAdapters/opencode.js` (nuevo)

```js
export async function call({ apiKey, model, system, userMessage, opencodeUrl, signal })
```

Lógica:
1. Build basic-auth header si `apiKey` no vacío: `'Basic ' + btoa('opencode:' + apiKey)`.
2. Split `model` en el primer `/`: `[providerID, ...rest] = model.split('/')`; `modelID = rest.join('/')` (por si modelID contiene `/`).
3. `POST {opencodeUrl}/session` con `{ title: 'sinpapel-designer' }`.
4. Extrae `sessionId = response.id`.
5. `POST {opencodeUrl}/session/{sessionId}/prompt` con body completo.
6. Filtra `data.parts.filter(p => p.type === 'text').map(p => p.text).join('')`.
7. Misma maquinaria de errores que los otros adapters: AbortError passthrough, 401/403 → ApiAuthError, 429 → ApiRateLimitError, fetch throw → ApiNetworkError, otros → ApiResponseError.

Cualquier error en cualquiera de los 2 POST sale por el mismo path de error tipado.

### 2. `src/stores/aiSettings.js` (modificar)

Añadir a `DEFAULT_MODELS`:
```js
const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5',
  opencode: 'anthropic/claude-sonnet-4-6',
}
```

Añadir nuevo state:
- `opencodeUrl: ref(stored?.opencodeUrl || 'http://localhost:4096')`.
- `apiKeys.opencode: ''` (default vacío = sin auth).

Añadir nueva acción:
- `setOpencodeUrl(url)` → muta + `persist()`.

`persist()` ahora también guarda `opencodeUrl`. `loadFromStorage()` rehidrata `opencodeUrl` también. Defaults garantizan retrocompatibilidad con localStorage anterior.

### 3. `src/services/llmService.js` (modificar)

Añadir `opencode: opencodeCall` al map `ADAPTERS`:
```js
import { call as opencodeCall } from './llmAdapters/opencode.js'
const ADAPTERS = { anthropic: anthropicCall, openai: openaiCall, opencode: opencodeCall }
```

En `generate()`, pasar `opencodeUrl` cuando provider=opencode:
```js
const result = await adapter({
  apiKey: store.currentApiKey(),
  model: store.model,
  system, userMessage,
  signal: opts.signal,
  opencodeUrl: store.opencodeUrl,   // los otros adapters lo ignoran (extra prop)
})
```

### 4. `src/components/AiSettingsDialog.vue` (modificar)

Añadir a `PROVIDER_OPTIONS`:
```js
{ label: 'OpenCode', value: 'opencode' }
```

Añadir a `MODEL_OPTIONS`:
```js
opencode: [
  { label: 'Anthropic / Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4-6' },
  { label: 'Anthropic / Claude Opus 4.7', value: 'anthropic/claude-opus-4-7' },
  { label: 'OpenAI / GPT-5', value: 'openai/gpt-5' },
],
```

Nuevos campos visibles SÓLO cuando `form.provider === 'opencode'`:
- `q-input` "URL del servidor OpenCode" con default `http://localhost:4096`.
- `q-input` "Password (opcional)" type=password con toggle show/hide.

Texto de hint visible:
> OpenCode debe estar corriendo con `opencode serve --cors`. Si configuraste `OPENCODE_SERVER_PASSWORD`, ponlo aquí.

Cuando se guarda con provider=opencode:
- `store.setOpencodeUrl(form.opencodeUrl)` adicionalmente a los 3 setters existentes.
- `store.setApiKey('opencode', form.apiKeys.opencode)` se llama también para los otros providers (mantener simetría).

### 5. Sin cambios

- `src/services/llmPrompts/workflowGenerator.js` — el prompt es agnóstico al provider.
- `src/components/AiGeneratorPreview.vue` — recibe el state parseado.
- `src/pages/AiGeneratorPage.vue` — usa `generate()` que ya despacha por provider.
- Backend — no se toca.

## Errores

| Caso | Comportamiento |
|---|---|
| `opencodeUrl` no responde (server no corriendo) | Adapter throw → fetch fail → `ApiNetworkError`. Page muestra "Sin conexión al provider." |
| CORS bloqueado | Mismo path que arriba: `ApiNetworkError`. Hint en settings ya advierte sobre `--cors`. |
| 401 (password incorrecta o requerida) | `ApiAuthError` → page abre Settings dialog. |
| Session create devuelve no-JSON / no `id` | `ApiResponseError` con detalle. |
| Prompt endpoint devuelve sin parts text (sólo tool calls u otros) | `text = ''` → `extractJson` en page falla → flujo de error existente muestra rawResponse vacío + reintentar. |
| AbortError (cancel del caller) | Re-thrown como los otros adapters. |
| Model string sin `/` | Adapter usa `providerID = model`, `modelID = ''`. OpenCode rechazará en runtime → `ApiResponseError`. |

## Seguridad

- Password OpenCode vive en localStorage como las demás keys.
- Si OpenCode corre en `localhost`, no sale del equipo del usuario — más seguro que Anthropic/OpenAI directos.
- HTTP basic en `localhost` no es problema; en remoto (LAN) sí debería ir sobre TLS. El campo URL acepta `http://` o `https://`. Documentamos en hint que para acceso remoto se use https + proxy con TLS.
- `--cors` permite cualquier origen — restricción a desarrollador, no nuestra responsabilidad.

## Testing

### Unit

Nuevo archivo `tests/llm-adapter-opencode.test.js` con ~7 tests:

1. Happy path completo: 2 fetch calls, primer call sin auth (apiKey vacía), URL `http://localhost:4096/session`, body `{title:'sinpapel-designer'}`; segundo call URL `/session/sess-1/prompt`, body con `model: {providerID, modelID}`, `parts`, `system`, `tools: []`; response parseado de `parts` filtrando type=text.
2. Auth basic: con apiKey, ambos POSTs incluyen header `Authorization: Basic <base64>`.
3. 401 en session create → ApiAuthError.
4. 429 en prompt → ApiRateLimitError.
5. fetch throw genérico → ApiNetworkError con mensaje 'Falla de red'.
6. AbortError propagated as-is (no envuelto).
7. 500 → ApiResponseError(status=500).
8. Response con mix de parts (text + otro tipo) → sólo concatena los text.

Extender tests existentes:
- `tests/ai-settings-store.test.js`: añadir 1-2 tests cubriendo `provider=opencode` default model y `setOpencodeUrl`.
- `tests/ai-settings-dialog.test.js`: añadir 1 test cubriendo el render de los 2 campos extra cuando provider=opencode.
- `tests/llm-service.test.js`: añadir 1 test "dispatcha al opencode adapter cuando provider=opencode" y verificar que `opencodeUrl` se pasa.

### Manual

1. Iniciar OpenCode local: `opencode serve --cors`.
2. En settings del designer, elegir provider OpenCode, dejar URL `http://localhost:4096`, password vacío.
3. Elegir model `anthropic/claude-sonnet-4-6` (requiere que OpenCode esté configurado con key Anthropic).
4. Generar un flujo simple desde el textarea.
5. Verificar preview con counts esperados.
6. Aplicar → confirma redirect al canvas.

## Componentes nuevos vs. modificados

**Nuevos:**
- `src/services/llmAdapters/opencode.js`
- `tests/llm-adapter-opencode.test.js`

**Modificados:**
- `src/stores/aiSettings.js` (default model + opencodeUrl + setOpencodeUrl + persist).
- `src/services/llmService.js` (registrar opencode adapter + pasar opencodeUrl).
- `src/components/AiSettingsDialog.vue` (provider option + model options + 2 campos extra condicionales + save handler).
- `tests/ai-settings-store.test.js` (cobertura opencode).
- `tests/ai-settings-dialog.test.js` (render condicional).
- `tests/llm-service.test.js` (dispatch opencode).

**Sin cambios:**
- `src/services/llmPrompts/workflowGenerator.js`.
- `src/components/AiGeneratorPreview.vue`.
- `src/pages/AiGeneratorPage.vue`.
- Anthropic/OpenAI adapters.
- Schema v0.2, store de workflow, backend.

## Riesgos

- **Medio**: CORS. Si el usuario olvida `--cors`, fallará silenciosamente como network error. El hint del settings lo dice, pero podemos sumar nota en el error toast cuando provider=opencode y hay network error.
- **Medio**: latencia 2× vs Anthropic/OpenAI (1 round-trip extra). Aceptable para uso interno.
- **Bajo**: el formato `providerID/modelID` asume `/` como separador. Si en el futuro algún modelID contiene `/`, el split en el PRIMER `/` lo maneja.
- **Bajo**: respuesta con `tools` calls a pesar de `tools: []`. Filtramos por `type === 'text'`, así que en el peor caso obtenemos string vacío → flujo de error existente.
