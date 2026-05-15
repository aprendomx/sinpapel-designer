# Sinpapel Designer

> **English** | [Español](#sinpapel-designer-es)

Visual workflow designer for the [sinpapel](https://github.com/aprendomx/sinpapel) framework. Standalone Vue 3 app, no auth, JSON round-trip via `sinpapel_import_flujo` / `sinpapel_export_flujo`.

## Status

**Current**: S27.8+ complete — all core features implemented including undo/redo, keyboard shortcuts, theme system, and security hardening.

## Quick Start

```bash
git clone git@github.com:aprendomx/sinpapel-designer.git
cd sinpapel-designer
npm install        # Node 20+ (^22 || ^20)
npm run dev        # http://localhost:5173 (or :5174 if 5173 occupied)
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Quasar CLI dev server (Vite mode, HMR) |
| `npm run build` | Production bundle (`dist/spa/`) |
| `npm run test` | Vitest unit tests (jsdom) — 44 tests passing |
| `npm run lint` | ESLint check (`src/**/*.{js,vue}`) |
| `npm run format` | Prettier write |

## Architecture

- **Stack**: Vue 3.5 + Quasar 2 + Quasar CLI Vite mode + Vue Flow 1.48 + Pinia 3
- **Persistence**: localStorage (autosave 500ms debounce) + JSON file save/load. **No backend in this app.**
- **Auth**: none (admin tool, embed en creditos via iframe)
- **JSON schema**: v0.2 portable (extends sinpapel `flujo_export.py` v0.1 — see ADR-017 in repo `creditos`)
- **Theme**: CSS custom properties (`src/css/theme.scss`) with Sinpapel brand palette
- **Security**: JSON input sanitization against prototype pollution (`__proto__`, `constructor`)

## Features

### Canvas (Workflow Editor)
- Visual node-based workflow editor with Vue Flow
- Drag-and-drop states from sidebar
- Connect nodes to create transitions
- Edit transition permissions (groups)
- Auto-layout + manual positioning with minimap
- **Undo/Redo**: Full history stack (max 50 states)
- **Keyboard shortcuts**: Ctrl+S (save), Ctrl+Z (undo), Ctrl+Shift+Z (redo), Delete (remove edge), Escape (close panel/exit edit)

### Catalog Management
- CRUD for 4 catalogs: Estados, Etapas, Grupos, Tipos de Documento
- Config-driven editor (`catalogo-fields.js`) — adding a new catalog = adding a config entry
- Duplicate name validation
- Cascade delete/update references

### Import/Export
- Export workflow to JSON v0.2 (download)
- Import workflow from JSON file (drag & drop or file picker)
- Schema validation with version migration (0.1 → 0.2)
- Round-trip integration tests with backend-generated fixtures

### Persistence
- localStorage with index tracking
- Autosave debounce (500ms)
- QuotaExceededError fallback (auto-download backup)
- Snapshot/discard changes

## Roadmap

| Story | Scope | Status |
|-------|-------|--------|
| S27.1 | Bootstrap: Vue 3 + Quasar + Vue Flow + smoke test | ✅ |
| S27.4 | Port WorkflowCanvas + EstadoNode | ✅ |
| S27.5 | JSON data layer + localStorage (Pinia store) | ✅ |
| S27.6 | WorkflowList page (browser-side) | ✅ |
| S27.7 | CRUD inline catalogos | ✅ |
| S27.8 | Round-trip end-to-end con sinpapel backend | ✅ |
| S27.9 | Embed wrapper iframe en creditos | 🔜 |
| S28.x | TypeScript migration, E2E tests (Playwright) | 🔜 |

## File Structure

```
src/
├── components/
│   ├── WorkflowCanvasToolbar.vue      # Header with undo/redo/save
│   ├── WorkflowCanvasStatesPanel.vue  # Left sidebar (draggable states)
│   ├── WorkflowCanvasTransitionPanel.vue # Right panel (transition editor)
│   ├── EstadoNode.vue                 # Custom Vue Flow node
│   ├── CatalogoEditor.vue             # Config-driven catalog CRUD
│   └── ...
├── composables/
│   └── useCanvasKeyboard.js           # Keyboard shortcuts handler
├── css/
│   ├── app.scss
│   └── theme.scss                     # CSS design tokens
├── data/
│   ├── schema-v0_2.js                 # JSON schema serialize/parse/validate
│   └── catalogo-fields.js             # Field configs for catalogs
├── pages/
│   ├── WorkflowCanvasPage.vue         # Main canvas (refactored from ~1000 lines)
│   ├── WorkflowListPage.vue           # Workflow listing with DnD import
│   ├── CatalogosPage.vue              # Catalog management tabs
│   └── IndexPage.vue                  # Landing page
├── services/
│   └── syncService.js                 # Backend sync stubs (S27.9)
├── stores/
│   └── workflow.js                    # Pinia store with undo/redo history
├── utils/
│   ├── hash-id.js                     # Shared hash utility
│   └── sanitize.js                    # JSON sanitization
└── ...
```

## Related repos

- `aprendomx/sinpapel` (develop) — framework + schema portable
- `creditos` (consumer) — governance, ADRs, embed wrapper

## ADRs

ADRs live in `creditos/dev/decisions/`:
- ADR-016 — sinpapel-designer stack & embed strategy
- ADR-017 — Schema v0.2 portable extension con catalogos inline opcional

## Linting & testing with `rai-frontend-gates`

This project integrates [`rai-frontend-gates`](https://github.com/aprendomx/rai-frontend-gates) — a Python wrapper that extends the [`rai-cli`](https://github.com/humansys/raise) `gate check` UX to npm-based stacks (vitest, eslint, build).

```bash
pip install "rai-frontend-gates @ git+ssh://git@github.com/aprendomx/rai-frontend-gates.git@v0.1.0"

rai-frontend gate check gate-tests    # npm run test
rai-frontend gate check gate-lint     # npm run lint
rai-frontend gate check gate-build    # npm run build
```

See ADR-019 in `creditos` for full rationale.

---

---

# Sinpapel Designer

> [English](#sinpapel-designer) | **Español**

Diseñador visual de flujos de trabajo para el framework [sinpapel](https://github.com/aprendomx/sinpapel). Aplicación Vue 3 standalone, sin autenticación, round-trip JSON vía `sinpapel_import_flujo` / `sinpapel_export_flujo`.

## Estado actual

**Versión**: S27.8+ completo — todas las funcionalidades core implementadas incluyendo undo/redo, atajos de teclado, sistema de temas y endurecimiento de seguridad.

## Inicio rápido

```bash
git clone git@github.com:aprendomx/sinpapel-designer.git
cd sinpapel-designer
npm install        # Node 20+ (^22 || ^20)
npm run dev        # http://localhost:5173 (o :5174 si 5173 está ocupado)
```

## Scripts

| Comando | Propósito |
|---------|-----------|
| `npm run dev` | Servidor Quasar CLI (modo Vite, HMR) |
| `npm run build` | Bundle de producción (`dist/spa/`) |
| `npm run test` | Tests unitarios Vitest (jsdom) — 44 tests pasando |
| `npm run lint` | ESLint (`src/**/*.{js,vue}`) |
| `npm run format` | Prettier write |

## Arquitectura

- **Stack**: Vue 3.5 + Quasar 2 + Quasar CLI Vite mode + Vue Flow 1.48 + Pinia 3
- **Persistencia**: localStorage (autosave con debounce 500ms) + archivo JSON. **Sin backend.**
- **Auth**: ninguna (herramienta admin, embed en creditos vía iframe)
- **Schema JSON**: v0.2 portable (extiende `flujo_export.py` v0.1 de sinpapel — ver ADR-017 en repo `creditos`)
- **Temas**: Propiedades CSS (`src/css/theme.scss`) con paleta de marca Sinpapel
- **Seguridad**: Sanitización de JSON contra prototype pollution (`__proto__`, `constructor`)

## Funcionalidades

### Canvas (Editor de flujos)
- Editor visual basado en nodos con Vue Flow
- Drag-and-drop de estados desde sidebar
- Conexión de nodos para crear transiciones
- Edición de permisos de transición (grupos)
- Auto-layout + posicionamiento manual con minimapa
- **Undo/Redo**: Stack completo de historial (máx. 50 estados)
- **Atajos de teclado**: Ctrl+S (guardar), Ctrl+Z (deshacer), Ctrl+Shift+Z (rehacer), Delete (eliminar transición), Escape (cerrar panel/salir edición)

### Gestión de catálogos
- CRUD para 4 catálogos: Estados, Etapas, Grupos, Tipos de Documento
- Editor config-driven (`catalogo-fields.js`) — agregar un catálogo = agregar una entrada de config
- Validación de nombres duplicados
- Eliminación/actualización en cascada de referencias

### Importar/Exportar
- Exportar workflow a JSON v0.2 (descarga)
- Importar workflow desde archivo JSON (drag & drop o selector de archivo)
- Validación de schema con migración de versiones (0.1 → 0.2)
- Tests de integración round-trip con fixtures generados por backend

### Persistencia
- localStorage con índice de tracking
- Autosave con debounce (500ms)
- Fallback QuotaExceededError (descarga automática de respaldo)
- Snapshot/descartar cambios

## Roadmap

| Story | Alcance | Estado |
|-------|---------|--------|
| S27.1 | Bootstrap: Vue 3 + Quasar + Vue Flow + smoke test | ✅ |
| S27.4 | Port WorkflowCanvas + EstadoNode | ✅ |
| S27.5 | Capa de datos JSON + localStorage (Pinia store) | ✅ |
| S27.6 | WorkflowList page (browser-side) | ✅ |
| S27.7 | CRUD inline catálogos | ✅ |
| S27.8 | Round-trip end-to-end con backend sinpapel | ✅ |
| S27.9 | Embed wrapper iframe en creditos | 🔜 |
| S28.x | Migración TypeScript, tests E2E (Playwright) | 🔜 |

## Estructura de archivos

```
src/
├── components/
│   ├── WorkflowCanvasToolbar.vue      # Header con undo/redo/guardar
│   ├── WorkflowCanvasStatesPanel.vue  # Sidebar izquierdo (estados arrastrables)
│   ├── WorkflowCanvasTransitionPanel.vue # Panel derecho (editor de transición)
│   ├── EstadoNode.vue                 # Nodo custom de Vue Flow
│   ├── CatalogoEditor.vue             # CRUD config-driven de catálogos
│   └── ...
├── composables/
│   └── useCanvasKeyboard.js           # Handler de atajos de teclado
├── css/
│   ├── app.scss
│   └── theme.scss                     # Tokens de diseño CSS
├── data/
│   ├── schema-v0_2.js                 # Schema JSON serialize/parse/validate
│   └── catalogo-fields.js             # Configs de campos para catálogos
├── pages/
│   ├── WorkflowCanvasPage.vue         # Canvas principal (refactorizado de ~1000 líneas)
│   ├── WorkflowListPage.vue           # Listado con import DnD
│   ├── CatalogosPage.vue              # Tabs de gestión de catálogos
│   └── IndexPage.vue                  # Página de inicio
├── services/
│   └── syncService.js                 # Stubs de sync con backend (S27.9)
├── stores/
│   └── workflow.js                    # Pinia store con historial undo/redo
├── utils/
│   ├── hash-id.js                     # Utilidad de hash compartida
│   └── sanitize.js                    # Sanitización de JSON
└── ...
```

## Repos relacionados

- `aprendomx/sinpapel` (develop) — framework + schema portable
- `creditos` (consumer) — gobernanza, ADRs, embed wrapper

## ADRs

Los ADRs viven en `creditos/dev/decisions/`:
- ADR-016 — Estrategia de stack y embed de sinpapel-designer
- ADR-017 — Extensión portable schema v0.2 con catálogos inline opcional

## Linting y testing con `rai-frontend-gates`

Este proyecto integra [`rai-frontend-gates`](https://github.com/aprendomx/rai-frontend-gates) — un wrapper Python que extiende el UX de `gate check` de [`rai-cli`](https://github.com/humansys/raise) a stacks npm (vitest, eslint, build).

```bash
pip install "rai-frontend-gates @ git+ssh://git@github.com/aprendomx/rai-frontend-gates.git@v0.1.0"

rai-frontend gate check gate-tests    # npm run test
rai-frontend gate check gate-lint     # npm run lint
rai-frontend gate check gate-build    # npm run build
```

Ver ADR-019 en `creditos` para la justificación completa.
