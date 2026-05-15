// S27.5 — Pinia workflow store.
//
// Replaces S27.4 transient src/data/stub-fixture.js (legacy sweep).
// Actions match stub interface (async returning data) so page code en
// S27.4 sigue funcional con mínimos cambios.
//
// State: id-based internal shape (S27.4 page compat).
// JSON I/O: v0.2 schema (nombre-keyed) via src/data/schema-v0_2.js adapters.
// Persistence: localStorage con autosave debounce 500ms.

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  serializeV0_2,
  parseV0_2,
  parseV0_1,
  validateSchema,
} from 'src/data/schema-v0_2.js'
import { hashId } from 'src/utils/hash-id.js'
import { sanitizeJsonInput } from 'src/utils/sanitize.js'

const STORAGE_PREFIX = 'sinpapel-designer/workflow/'
const INDEX_KEY = 'sinpapel-designer/workflow-index'
const AUTOSAVE_DEBOUNCE_MS = 500

export const useWorkflowStore = defineStore('workflow', () => {
  // ── State ────────────────────────────────────────────────────────────
  const current = ref(null) // internal state shape (id-based)
  const snapshot = ref(null) // for discard
  const isDirty = ref(false)
  let saveTimeoutId = null

  // ── Computed ─────────────────────────────────────────────────────────
  const hasWorkflow = computed(() => current.value !== null)

  // ── Actions: stub-interface match (S27.4 page compat) ────────────────

  async function getFlujos() {
    const indexRaw = localStorage.getItem(INDEX_KEY)
    const ids = indexRaw ? JSON.parse(indexRaw) : []
    return ids
      .map((id) => {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`)
        if (!raw) return null
        try {
          const data = JSON.parse(raw)
          return {
            id,
            nombre: data.flujo.nombre,
            descripcion: data.flujo.descripcion || '',
            activo: data.flujo.activo ?? false,
            transiciones_count: (data.flujo.transiciones || []).length,
            metadatos: data.flujo.metadatos,
          }
        } catch {
          return null
        }
      })
      .filter(Boolean)
  }

  async function getFlujo(id) {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`)
    if (!raw) {
      throw new Error(`Flujo ${id} not found`)
    }
    const json = JSON.parse(raw)
    const state =
      json.schema_version === '0.1' ? parseV0_1(json) : parseV0_2(json)
    state.flujo.id = id // preserve localStorage id
    current.value = state
    snapshot.value = _clone(state)
    isDirty.value = false
    return state.flujo
  }

  async function getFlujoTransiciones(id) {
    if (!current.value || current.value.flujo.id !== id) {
      await getFlujo(id)
    }
    return current.value.transiciones
  }

  async function getEstatuses() {
    return current.value?.estados || []
  }

  async function getGrupos() {
    return current.value?.grupos || []
  }

  async function createFlujo(data) {
    const id = _generateId()
    const state = {
      flujo: {
        id,
        nombre: data.nombre,
        descripcion: data.descripcion || '',
        activo: false,
        transiciones_count: 0,
        metadatos: null,
      },
      estados: [],
      etapas: [],
      grupos: [],
      tipos_documento: [],
      transiciones: [],
      requisitos: [],
    }
    _persist(id, state)
    _addToIndex(id)
    return { ...state.flujo }
  }

  async function updateFlujo(id, patch) {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`)
    if (!raw) throw new Error(`Flujo ${id} not found`)
    const json = JSON.parse(raw)
    Object.assign(json.flujo, patch)
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(json))
    if (current.value?.flujo.id === id) {
      Object.assign(current.value.flujo, patch)
    }
    return { ...json.flujo, id }
  }

  async function bulkReplaceTransiciones(id, transiciones) {
    if (!current.value || current.value.flujo.id !== id) {
      await getFlujo(id)
    }
    // Transitions arrive as objects with estado_origen_id, estado_destino_id
    // (from WorkflowCanvasPage saveChanges builder). Resolve to estado objects.
    const estadoById = Object.fromEntries(
      current.value.estados.map((e) => [String(e.id), e]),
    )
    current.value.transiciones = transiciones.map((t, i) => ({
      id: i + 1,
      estado_origen: estadoById[String(t.estado_origen_id)] || {
        nombre: String(t.estado_origen_id),
      },
      estado_destino: estadoById[String(t.estado_destino_id)] || {
        nombre: String(t.estado_destino_id),
      },
      grupos_permitidos: (t.grupos_ids || []).map((gid) => {
        const g = current.value.grupos.find((x) => x.id === gid)
        return g || { id: gid, name: String(gid) }
      }),
    }))
    isDirty.value = true
  }

  async function saveLayout(id, positions) {
    if (!current.value || current.value.flujo.id !== id) {
      await getFlujo(id)
    }
    current.value.flujo.metadatos = {
      ...(current.value.flujo.metadatos || {}),
      positions,
    }
    isDirty.value = true
  }

  // ── New actions S27.5 ───────────────────────────────────────────────

  async function loadFromFile(file) {
    const text = await file.text()
    const json = sanitizeJsonInput(JSON.parse(text))
    validateSchema(json)
    const state =
      json.schema_version === '0.1' ? parseV0_1(json) : parseV0_2(json)
    // Assign id (localStorage key); use hashId from nombre or new timestamp
    const id = _generateId()
    state.flujo.id = id
    current.value = state
    snapshot.value = _clone(state)
    isDirty.value = false
    _persist(id, state)
    _addToIndex(id)
    return state
  }

  function exportToFile() {
    if (!current.value) return
    const json = serializeV0_2(current.value)
    const blob = new Blob([JSON.stringify(json, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workflow-${current.value.flujo.nombre || 'untitled'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function discard() {
    if (snapshot.value) {
      current.value = _clone(snapshot.value)
    }
    isDirty.value = false
  }

  // ── S27.6: deleteFlujo ───────────────────────────────────────────────

  async function deleteFlujo(id) {
    const key = `${STORAGE_PREFIX}${id}`
    if (!localStorage.getItem(key)) {
      throw new Error(`Flujo ${id} not found`)
    }
    localStorage.removeItem(key)
    const indexRaw = localStorage.getItem(INDEX_KEY)
    const ids = indexRaw ? JSON.parse(indexRaw) : []
    const updated = ids.filter((i) => i !== id)
    localStorage.setItem(INDEX_KEY, JSON.stringify(updated))
    // D6: cascade clear current/snapshot if matching
    if (current.value?.flujo?.id === id) {
      current.value = null
      snapshot.value = null
      isDirty.value = false
    }
  }

  // ── S27.7: CRUD catalogos ────────────────────────────────────────────
  //
  // Generic internal helpers backing 4 catalogs × 3 ops. Each catalog has
  // a key in current.value (estados, etapas, grupos, tipos_documento) and
  // a "name field" (`nombre` for 3, `name` for grupos).

  const CATALOG_KEYS = {
    estado: { key: 'estados', nameField: 'nombre' },
    etapa: { key: 'etapas', nameField: 'nombre' },
    grupo: { key: 'grupos', nameField: 'name' },
    tipo_documento: { key: 'tipos_documento', nameField: 'nombre' },
  }

  function _assertUniqueName(kind, name, excludeId = null) {
    const { key, nameField } = CATALOG_KEYS[kind]
    const exists = current.value[key].some((e) => e[nameField] === name && e.id !== excludeId)
    if (exists) throw new Error(`${kind} con ${nameField}='${name}' ya existe`)
  }

  function _addToCatalog(kind, data) {
    if (!current.value) return null
    const { key, nameField } = CATALOG_KEYS[kind]
    const name = data[nameField]
    if (!name) return null
    _assertUniqueName(kind, name)
    const id = hashId(name)
    const entry = { id, ...data }
    current.value[key].push(entry)
    isDirty.value = true
    return entry
  }

  function _updateInCatalog(kind, id, patch) {
    if (!current.value) return null
    const { key, nameField } = CATALOG_KEYS[kind]
    const list = current.value[key]
    const idx = list.findIndex((e) => e.id === id)
    if (idx === -1) return null
    const oldName = list[idx][nameField]
    const newName = patch[nameField]
    const renamed = newName && newName !== oldName
    if (renamed) {
      _assertUniqueName(kind, newName, id)
    }
    // Rename → regenerate id (PAT-S27.5: hashId is content-derived)
    const newId = renamed ? hashId(newName) : id
    const updated = { ...list[idx], ...patch, id: newId }
    list[idx] = updated
    if (renamed) {
      _renameReferences(kind, oldName, newName)
    }
    isDirty.value = true
    return updated
  }

  function _removeFromCatalog(kind, id) {
    if (!current.value) return false
    const { key, nameField } = CATALOG_KEYS[kind]
    const list = current.value[key]
    const idx = list.findIndex((e) => e.id === id)
    if (idx === -1) return false
    const name = list[idx][nameField]
    list.splice(idx, 1)
    _cascadeRemoveReferences(kind, name)
    isDirty.value = true
    return true
  }

  function _renameReferences(kind, oldName, newName) {
    if (!current.value) return
    if (kind === 'estado') {
      // Update transitions estado_origen/destino.nombre
      for (const t of current.value.transiciones) {
        if (t.estado_origen?.nombre === oldName) t.estado_origen.nombre = newName
        if (t.estado_destino?.nombre === oldName) t.estado_destino.nombre = newName
      }
      // Update requisitos.estado
      for (const r of current.value.requisitos) {
        if (r.estado === oldName) r.estado = newName
        if (r.estado?.nombre === oldName) r.estado.nombre = newName
      }
      // Update positions (id-keyed internal; rename → new hashId)
      const positions = current.value.flujo?.metadatos?.positions
      if (positions) {
        const oldId = hashId(oldName)
        const newId = hashId(newName)
        if (positions[oldId]) {
          positions[newId] = positions[oldId]
          delete positions[oldId]
        }
      }
    } else if (kind === 'etapa') {
      // Update estados.etapa string refs
      for (const e of current.value.estados) {
        if (e.etapa === oldName) e.etapa = newName
        else if (e.etapa?.nombre === oldName) e.etapa.nombre = newName
      }
    } else if (kind === 'grupo') {
      for (const t of current.value.transiciones) {
        for (const g of t.grupos_permitidos || []) {
          if (g.name === oldName) g.name = newName
        }
      }
    } else if (kind === 'tipo_documento') {
      for (const r of current.value.requisitos) {
        if (r.tipo_documento === oldName) r.tipo_documento = newName
        if (r.tipo_documento?.nombre === oldName) r.tipo_documento.nombre = newName
      }
    }
  }

  function _cascadeRemoveReferences(kind, name) {
    if (!current.value) return
    if (kind === 'estado') {
      current.value.transiciones = current.value.transiciones.filter(
        (t) => t.estado_origen?.nombre !== name && t.estado_destino?.nombre !== name,
      )
      current.value.requisitos = current.value.requisitos.filter(
        (r) => (r.estado?.nombre || r.estado) !== name,
      )
    } else if (kind === 'etapa') {
      // D3: auto-null Estado.etapa refs (no cascade delete)
      for (const e of current.value.estados) {
        if (e.etapa === name || e.etapa?.nombre === name) e.etapa = null
      }
    } else if (kind === 'grupo') {
      for (const t of current.value.transiciones) {
        t.grupos_permitidos = (t.grupos_permitidos || []).filter(
          (g) => g.name !== name,
        )
      }
    } else if (kind === 'tipo_documento') {
      current.value.requisitos = current.value.requisitos.filter(
        (r) => (r.tipo_documento?.nombre || r.tipo_documento) !== name,
      )
    }
  }

  // ── Public CRUD: 12 actions (3 × 4 catalogs) ─────────────────────────

  function addEstado(data) { return _addToCatalog('estado', data) }
  function updateEstado(id, patch) { return _updateInCatalog('estado', id, patch) }
  function removeEstado(id) { return _removeFromCatalog('estado', id) }

  function addEtapa(data) { return _addToCatalog('etapa', data) }
  function updateEtapa(id, patch) { return _updateInCatalog('etapa', id, patch) }
  function removeEtapa(id) { return _removeFromCatalog('etapa', id) }

  function addGrupo(data) { return _addToCatalog('grupo', data) }
  function updateGrupo(id, patch) { return _updateInCatalog('grupo', id, patch) }
  function removeGrupo(id) { return _removeFromCatalog('grupo', id) }

  function addTipoDocumento(data) { return _addToCatalog('tipo_documento', data) }
  function updateTipoDocumento(id, patch) { return _updateInCatalog('tipo_documento', id, patch) }
  function removeTipoDocumento(id) { return _removeFromCatalog('tipo_documento', id) }

  // ── Reference helpers (delete safety) ────────────────────────────────

  function findEstadoReferences(nombre) {
    if (!current.value) return { transitions: 0 }
    const transitions = current.value.transiciones.filter(
      (t) => t.estado_origen?.nombre === nombre || t.estado_destino?.nombre === nombre,
    ).length
    return { transitions }
  }

  function findEtapaReferences(nombre) {
    if (!current.value) return { dependentEstados: 0 }
    const dependentEstados = current.value.estados.filter(
      (e) => e.etapa === nombre || e.etapa?.nombre === nombre,
    ).length
    return { dependentEstados }
  }

  function findGrupoReferences(name) {
    if (!current.value) return { transitions: 0 }
    const transitions = current.value.transiciones.filter((t) =>
      (t.grupos_permitidos || []).some((g) => g.name === name),
    ).length
    return { transitions }
  }

  function findTipoDocumentoReferences(nombre) {
    if (!current.value) return { requisitos: 0 }
    const requisitos = current.value.requisitos.filter(
      (r) => (r.tipo_documento?.nombre || r.tipo_documento) === nombre,
    ).length
    return { requisitos }
  }

  // ── Internal helpers ─────────────────────────────────────────────────

  function _clone(o) {
    return JSON.parse(JSON.stringify(o))
  }

  function _generateId() {
    // Unique id even within same millisecond (tests run fast).
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }



  function _addToIndex(id) {
    const raw = localStorage.getItem(INDEX_KEY)
    const ids = raw ? JSON.parse(raw) : []
    if (!ids.includes(id)) {
      ids.push(id)
      localStorage.setItem(INDEX_KEY, JSON.stringify(ids))
    }
  }

  function _persist(id, state) {
    try {
      const json = serializeV0_2(state)
      localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(json))
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
        console.warn('[workflow-store] localStorage quota exceeded')
        exportToFile()
        throw new Error('Almacenamiento local lleno. Se descargó el archivo de respaldo.')
      }
      throw e
    }
  }

  // ── Autosave debounce ────────────────────────────────────────────────

  watch(isDirty, (val) => {
    if (val && current.value?.flujo?.id) {
      clearTimeout(saveTimeoutId)
      saveTimeoutId = setTimeout(() => {
        _persist(current.value.flujo.id, current.value)
        snapshot.value = _clone(current.value)
        isDirty.value = false
      }, AUTOSAVE_DEBOUNCE_MS)
    }
  })

  return {
    // State
    current,
    isDirty,
    hasWorkflow,
    // Stub-interface actions
    getFlujos,
    getFlujo,
    getFlujoTransiciones,
    getEstatuses,
    getGrupos,
    createFlujo,
    updateFlujo,
    bulkReplaceTransiciones,
    saveLayout,
    // New S27.5 actions
    loadFromFile,
    exportToFile,
    discard,
    // S27.6
    deleteFlujo,
    // S27.7 CRUD catalogos
    addEstado, updateEstado, removeEstado,
    addEtapa, updateEtapa, removeEtapa,
    addGrupo, updateGrupo, removeGrupo,
    addTipoDocumento, updateTipoDocumento, removeTipoDocumento,
    findEstadoReferences, findEtapaReferences,
    findGrupoReferences, findTipoDocumentoReferences,
  }
})
