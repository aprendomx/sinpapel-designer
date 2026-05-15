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

## Linting & testing with `rai-frontend-gates`

This project integrates [`rai-frontend-gates`](https://github.com/aprendomx/rai-frontend-gates) — a Python wrapper that extends the [`rai-cli`](https://github.com/humansys/raise) `gate check` UX to npm-based stacks (vitest, eslint, build). It adds **delta-vs-baseline display** on top of bare `npm run *`.

### Install

```bash
pip install "rai-frontend-gates @ git+ssh://git@github.com/aprendomx/rai-frontend-gates.git@v0.1.0"
```

Requires Python 3.10+. Until `v0.1.0` lands as a tag (S30.4), use `@develop`.

### Usage

```bash
# List available gates (detected from package.json scripts)
rai-frontend gate list
# → gate-tests  → npm run test
#   gate-lint   → npm run lint
#   gate-build  → npm run build

# Run a gate (transparent: npm exit → wrapper exit)
rai-frontend gate check gate-tests
rai-frontend gate check gate-lint
rai-frontend gate check gate-build

# Delta-vs-baseline (lint only; tests/build use exit code)
rai-frontend baseline snapshot --gate gate-lint
# ... make changes ...
rai-frontend gate check gate-lint --delta
# → baseline: 0 errors | current: 2 errors | delta: +2 new, -0 fixed, 0 kept
#   + src/pages/X.vue:42 [no-unused-vars] 'foo' is defined but never used

rai-frontend baseline reset --gate gate-lint
```

### Why?

- **Frontend gate parity** with `rai gate check` (consistent CLI surface across Python + npm stacks).
- **Delta display** is more actionable than absolute error counts (recurring retro request, governance).
- **Auto-invalidation** when `package.json` version bumps (no stale baseline footguns).

See **ADR-019** in `creditos/dev/decisions/adr-019-rai-frontend-gates-wrapper.md` for full architectural rationale (lands S30.4).

The baseline cache lives at `.rai-frontend/baseline.json` (gitignored — local per-developer).
