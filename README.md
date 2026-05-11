# Sinpapel Designer

Visual workflow designer for the [sinpapel](https://github.com/aprendomx/sinpapel) framework. Standalone Vue 3 app, no auth, JSON round-trip via `sinpapel_import_flujo` / `sinpapel_export_flujo`.

> **Status (S27.1 bootstrap)**: Vue 3 + Quasar + Vue Flow scaffold validado. Port del WorkflowCanvas + JSON data layer + CRUD inline catalogos arriban en S27.4-S27.7.

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
| `npm run test` | Vitest unit tests (jsdom) |
| `npm run lint` | ESLint check (`src/**/*.{js,vue}`) |
| `npm run format` | Prettier write |

## Architecture

- **Stack**: Vue 3.5 + Quasar 2 + Quasar CLI Vite mode + Vue Flow 1.48 + Pinia 3.
- **Persistence**: localStorage (autosave) + JSON file save/load. **No backend in this app.**
- **Auth**: none (admin tool, embed en creditos via iframe).
- **JSON schema**: v0.2 portable (extends sinpapel `flujo_export.py` v0.1 — ver ADR-017 en repo `creditos`).

## Roadmap

| Story | Scope |
|-------|-------|
| S27.1 ✅ | Bootstrap (este): Vue 3 + Quasar + Vue Flow + smoke test |
| S27.4 | Port WorkflowCanvas + EstadoNode (UI sin data layer) |
| S27.5 | JSON data layer + localStorage (Pinia store) |
| S27.6 | WorkflowList page (browser-side) |
| S27.7 | CRUD inline catalogos (Estado/Etapa/Group/TipoDocumento) |
| S27.8 | Round-trip end-to-end con sinpapel backend |
| S27.9 | Embed wrapper iframe en creditos |

## Related repos

- `aprendomx/sinpapel` (develop) — framework + schema portable.
- `creditos` (consumer) — governance, ADRs, embed wrapper.

## ADRs

ADRs viven en `creditos/dev/decisions/`:
- ADR-016 — sinpapel-designer stack & embed strategy
- ADR-017 — Schema v0.2 portable extension con catalogos inline opcional

## Smoke test

`tests/smoke.test.js` valida que `IndexPage.vue` monta en jsdom con todos los componentes (Vue Flow stubbed). Real Vue Flow + Quasar coexistence se valida via `npm run dev` + browser visual — ver 2 nodos + 1 edge + botón Quasar en la home page.
