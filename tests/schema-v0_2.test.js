// S27.5 T1 — pure functions schema-v0_2 utilities.
// Field-by-field shape match con backend aprendo/sinpapel/schemas/flujo_export.py
// (S27.2 implementation). Validates contract en isolation.

import { describe, it, expect } from 'vitest'
import {
  SCHEMA_VERSION_LATEST,
  SUPPORTED_VERSIONS,
  validateSchema,
  serializeV0_2,
  parseV0_2,
  parseV0_1,
} from '../src/data/schema-v0_2.js'

const MINIMAL_STATE = {
  flujo: {
    id: '1', nombre: 'Test', descripcion: 'desc', activo: true,
    metadatos: { positions: { '1': { x: 10, y: 20 } } },
  },
  estados: [
    { id: 1, nombre: 'CAPTURA', color: '#9b2247', icono: 'edit', orden: 1,
      descripcion: '', activo: true, etapa: null,
      permite_expediente: false, expediente_obligatorio: false },
  ],
  etapas: [],
  grupos: [{ id: 1, name: 'Comité' }],
  tipos_documento: [],
  transiciones: [],
  requisitos: [],
}

describe('schema-v0_2', () => {
  it('exports SCHEMA_VERSION_LATEST = "0.2" + SUPPORTED_VERSIONS', () => {
    expect(SCHEMA_VERSION_LATEST).toBe('0.2')
    expect(SUPPORTED_VERSIONS).toEqual(['0.1', '0.2'])
  })

  it('serializeV0_2 produces shape matching backend serializer fields', () => {
    const json = serializeV0_2(MINIMAL_STATE)
    expect(json.schema_version).toBe('0.2')
    expect(json.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(json.catalogos).toBeDefined()
    expect(Object.keys(json.catalogos)).toEqual(
      expect.arrayContaining(['estados', 'etapas', 'grupos', 'tipos_documento'])
    )
    // Estado fields match backend (S27.2)
    const estado = json.catalogos.estados[0]
    expect(estado).toMatchObject({
      nombre: 'CAPTURA', color: '#9b2247', icono: 'edit',
      descripcion: '', orden: 1, activo: true, etapa: null,
      permite_expediente: false, expediente_obligatorio: false,
    })
    // Group only has 'name'
    expect(json.catalogos.grupos[0]).toEqual({ name: 'Comité' })
    // Flujo shape
    expect(json.flujo).toMatchObject({
      nombre: 'Test', descripcion: 'desc', activo: true,
    })
  })

  it('serializeV0_2 migrates positions ID-keyed to name-keyed', () => {
    const json = serializeV0_2(MINIMAL_STATE)
    // Estado id=1 nombre=CAPTURA → positions key migrates
    expect(json.flujo.metadatos.positions).toEqual({
      CAPTURA: { x: 10, y: 20 },
    })
  })

  it('parseV0_2 idempotent (serialize → parse → re-serialize equal)', () => {
    const v0_2 = serializeV0_2(MINIMAL_STATE)
    const parsed = parseV0_2(v0_2)
    const re_serialized = serializeV0_2(parsed)
    // Compare flujo (ignoring exported_at timestamp diff)
    expect(re_serialized.flujo).toEqual(v0_2.flujo)
    expect(re_serialized.catalogos.estados).toEqual(v0_2.catalogos.estados)
    expect(re_serialized.catalogos.grupos).toEqual(v0_2.catalogos.grupos)
  })

  it('parseV0_1 returns minimal v0.2 shape (empty catalogos)', () => {
    const v0_1 = {
      schema_version: '0.1',
      exported_at: '2026-05-12T00:00:00Z',
      flujo: {
        nombre: 'Legacy', descripcion: '', activo: false,
        metadatos: null,
        transiciones: [{ estado_origen: 'A', estado_destino: 'B', grupos_permitidos: [] }],
        requisitos: [],
      },
    }
    const state = parseV0_1(v0_1)
    expect(state.estados).toEqual([])
    expect(state.etapas).toEqual([])
    expect(state.grupos).toEqual([])
    expect(state.tipos_documento).toEqual([])
    expect(state.transiciones.length).toBe(1)
    expect(state.flujo.nombre).toBe('Legacy')
  })

  it('validateSchema rejects unsupported version 0.3', () => {
    expect(() => validateSchema({ schema_version: '0.3', flujo: { nombre: 'X' } })).toThrow(
      /Unsupported schema_version='0.3'/
    )
  })

  it('validateSchema accepts 0.1 and 0.2', () => {
    expect(() => validateSchema({ schema_version: '0.1', flujo: { nombre: 'X' } })).not.toThrow()
    expect(() => validateSchema({ schema_version: '0.2', flujo: { nombre: 'X' } })).not.toThrow()
  })

  it('validateSchema rejects missing flujo or flujo.nombre', () => {
    expect(() => validateSchema({ schema_version: '0.2' })).toThrow(/missing flujo/)
    expect(() => validateSchema({ schema_version: '0.2', flujo: {} })).toThrow(/nombre required/)
  })
})
