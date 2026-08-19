// S27.5 — Schema v0.2 portable utilities (client-side).
//
// Mirrors backend serializer en aprendo/sinpapel/schemas/flujo_export.py
// (S27.2 implementation, ADR-017). Field-by-field match para garantizar
// round-trip integrity entre sinpapel-designer (JSON producer) y sinpapel
// (backend consumer via sinpapel_import_flujo).
//
// Internal state shape (id-based, S27.4 page compat):
//   { flujo: {id, nombre, ...}, estados: [{id, nombre, ...}], etapas: [],
//     grupos: [{id, name}], tipos_documento: [], transiciones: [], requisitos: [] }
//
// External JSON v0.2 shape (nombre-keyed):
//   { schema_version: "0.2", exported_at, catalogos: {...}, flujo: {...} }
//
// Adapter funcionando bidireccional: serializeV0_2 (internal -> JSON),
// parseV0_2 (JSON -> internal).

import { hashId } from 'src/utils/hash-id.js'

export const SCHEMA_VERSION_LATEST = '0.2'
export const SUPPORTED_VERSIONS = ['0.1', '0.2']

export function validateSchema(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid: not an object')
  }
  const v = data.schema_version
  if (!SUPPORTED_VERSIONS.includes(v)) {
    throw new Error(
      `Unsupported schema_version='${v}'. ` +
      `This sinpapel-designer knows ${JSON.stringify(SUPPORTED_VERSIONS)}.`
    )
  }
  if (!data.flujo) {
    throw new Error('Invalid: missing flujo')
  }
  if (!data.flujo.nombre) {
    throw new Error('Invalid: flujo.nombre required')
  }
}

export function serializeV0_2(state) {
  return {
    schema_version: SCHEMA_VERSION_LATEST,
    exported_at: new Date().toISOString(),
    catalogos: {
      estados: (state.estados || []).map(_serializeEstado),
      etapas: (state.etapas || []).map(_serializeEtapa),
      grupos: (state.grupos || []).map((g) => ({ name: g.name })),
      tipos_documento: (state.tipos_documento || []).map(_serializeTipoDocumento),
    },
    flujo: {
      nombre: state.flujo.nombre,
      descripcion: state.flujo.descripcion || '',
      activo: state.flujo.activo ?? false,
      metadatos: _serializeMetadatos(state.flujo.metadatos, state.estados || []),
      transiciones: (state.transiciones || []).map(_serializeTransicion),
      requisitos: (state.requisitos || []).map(_serializeRequisito),
    },
  }
}

export function parseV0_2(json) {
  validateSchema(json)
  const cat = json.catalogos || { estados: [], etapas: [], grupos: [], tipos_documento: [] }
  const estados = (cat.estados || []).map(_deserializeEstado)
  const etapas = (cat.etapas || []).map(_deserializeEtapa)
  return {
    flujo: {
      id: json.flujo.id || hashId(json.flujo.nombre),
      nombre: json.flujo.nombre,
      descripcion: json.flujo.descripcion || '',
      activo: json.flujo.activo ?? false,
      transiciones_count: (json.flujo.transiciones || []).length,
      metadatos: _deserializeMetadatos(json.flujo.metadatos, estados),
    },
    estados,
    etapas,
    grupos: (cat.grupos || []).map((g, i) => ({ id: i + 1, name: g.name })),
    tipos_documento: (cat.tipos_documento || []).map(_deserializeTipoDocumento),
    transiciones: (json.flujo.transiciones || []).map((t, i) =>
      _deserializeTransicion(t, i, estados, cat.grupos || [])
    ),
    requisitos: json.flujo.requisitos || [],
  }
}

export function parseV0_1(json) {
  validateSchema(json)
  // v0.1 has no catalogos section — return minimal v0.2 shape
  return {
    flujo: {
      id: json.flujo.id || hashId(json.flujo.nombre),
      nombre: json.flujo.nombre,
      descripcion: json.flujo.descripcion || '',
      activo: json.flujo.activo ?? false,
      transiciones_count: (json.flujo.transiciones || []).length,
      metadatos: json.flujo.metadatos || null,
    },
    estados: [],
    etapas: [],
    grupos: [],
    tipos_documento: [],
    transiciones: (json.flujo.transiciones || []).map((t, i) =>
      _deserializeTransicion(t, i, [], [])
    ),
    requisitos: json.flujo.requisitos || [],
  }
}

// ── Field serializers (mirror backend) ────────────────────────────────────

function _serializeEstado(e) {
  return {
    nombre: e.nombre,
    color: e.color || '#4DEFE2',
    icono: e.icono || 'circle',
    descripcion: e.descripcion || '',
    orden: e.orden ?? 0,
    activo: e.activo ?? false,
    etapa: e.etapa?.nombre || (typeof e.etapa === 'string' ? e.etapa : null),
    permite_expediente: e.permite_expediente || false,
    expediente_obligatorio: e.expediente_obligatorio || false,
  }
}

function _serializeEtapa(e) {
  return {
    nombre: e.nombre,
    color: e.color || '#4DEFE2',
    descripcion: e.descripcion || '',
    orden: e.orden ?? 0,
    activo: e.activo ?? false,
  }
}

function _serializeTipoDocumento(t) {
  return {
    nombre: t.nombre,
    color: t.color || '#4DEFE2',
    descripcion: t.descripcion || '',
    orden: t.orden ?? 0,
    activo: t.activo ?? false,
  }
}

function _serializeTransicion(t) {
  const out = {
    estado_origen: t.estado_origen?.nombre || t.estado_origen,
    estado_destino: t.estado_destino?.nombre || t.estado_destino,
    grupos_permitidos: (t.grupos_permitidos || [])
      .map((g) => g.name || g)
      .sort(),
    // sinpapel 0.8.x: key aditiva del schema v0.2 (JSONs viejos → false)
    requiere_firma: t.requiere_firma ?? false,
  }
  const condiciones = (t.condiciones || []).map((c) => ({
    tipo: c.tipo,
    configuracion: c.configuracion ?? {},
    mensaje_error: c.mensaje_error ?? '',
    orden: c.orden ?? 0,
    activo: c.activo ?? true,
  }))
  if (condiciones.length > 0) {
    out.condiciones = condiciones
  }
  return out
}

function _serializeRequisito(r) {
  return {
    estado: r.estado?.nombre || r.estado,
    tipo_documento: r.tipo_documento?.nombre || r.tipo_documento,
    porcentaje: r.porcentaje ?? 100,
    auto_carga: r.auto_carga || false,
  }
}

function _serializeMetadatos(metadatos, estados) {
  if (!metadatos) return null
  if (!metadatos.positions) return metadatos
  // Migrate positions ID-keyed → name-keyed (ADR-017 D6)
  const idToNombre = Object.fromEntries(
    estados.map((e) => [String(e.id), e.nombre])
  )
  const positions = {}
  for (const [key, pos] of Object.entries(metadatos.positions)) {
    // If key already in nombre form (not in idToNombre), preserve as-is
    const nombre = idToNombre[key] || key
    positions[nombre] = pos
  }
  return { ...metadatos, positions }
}

// ── Field deserializers ────────────────────────────────────────────────────

function _deserializeEstado(e) {
  return {
    id: hashId(e.nombre),
    nombre: e.nombre,
    color: e.color,
    icono: e.icono,
    descripcion: e.descripcion || '',
    orden: e.orden ?? 0,
    activo: e.activo ?? false,
    etapa: e.etapa, // keep as nombre string; resolve via etapas lookup if needed
    permite_expediente: e.permite_expediente || false,
    expediente_obligatorio: e.expediente_obligatorio || false,
  }
}

function _deserializeEtapa(e) {
  return {
    id: hashId(e.nombre),
    nombre: e.nombre,
    color: e.color,
    descripcion: e.descripcion || '',
    orden: e.orden ?? 0,
    activo: e.activo ?? false,
  }
}

function _deserializeTipoDocumento(t) {
  return {
    id: hashId(t.nombre),
    nombre: t.nombre,
    color: t.color,
    descripcion: t.descripcion || '',
    orden: t.orden ?? 0,
    activo: t.activo ?? false,
  }
}

function _deserializeTransicion(t, idx, estados, gruposJson) {
  const estadoLookup = Object.fromEntries(estados.map((e) => [e.nombre, e]))
  const grupoLookup = Object.fromEntries(
    gruposJson.map((g, i) => [g.name, { id: i + 1, name: g.name }])
  )
  return {
    id: idx + 1,
    estado_origen: estadoLookup[t.estado_origen] || { nombre: t.estado_origen },
    estado_destino: estadoLookup[t.estado_destino] || { nombre: t.estado_destino },
    grupos_permitidos: (t.grupos_permitidos || []).map(
      (name) => grupoLookup[name] || { id: 0, name }
    ),
    requiere_firma: t.requiere_firma ?? false,
    condiciones: (t.condiciones || []).map((c) => ({
      tipo: c.tipo,
      configuracion: c.configuracion ?? {},
      mensaje_error: c.mensaje_error ?? '',
      orden: c.orden ?? 0,
      activo: c.activo ?? true,
    })),
  }
}

function _deserializeMetadatos(metadatos, estados) {
  if (!metadatos) return null
  if (!metadatos.positions) return metadatos
  // Positions in v0.2 are name-keyed; convert to id-keyed for internal state
  const nombreToId = Object.fromEntries(estados.map((e) => [e.nombre, String(e.id)]))
  const positions = {}
  for (const [key, pos] of Object.entries(metadatos.positions)) {
    // If key already in id form (not in nombreToId), preserve
    const id = nombreToId[key] || key
    positions[id] = pos
  }
  return { ...metadatos, positions }
}

// ── Helper: stable client-side id from string ────────────────────────────


