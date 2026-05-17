import { describe, it, expect } from 'vitest'
import { serializeV0_2, parseV0_2 } from '../src/data/schema-v0_2.js'

describe('schema v0.2 — condiciones round-trip', () => {
  const baseState = {
    flujo: { id: 'f1', nombre: 'F1', descripcion: '', activo: false, metadatos: null },
    estados: [
      { id: 1, nombre: 'A', color: '#fff', icono: 'circle', descripcion: '', orden: 0, activo: true },
      { id: 2, nombre: 'B', color: '#fff', icono: 'circle', descripcion: '', orden: 1, activo: true },
    ],
    etapas: [],
    grupos: [],
    tipos_documento: [],
    requisitos: [],
  }

  it('serializa condiciones cuando una transición las tiene', () => {
    const state = {
      ...baseState,
      transiciones: [{
        id: 1,
        estado_origen: baseState.estados[0],
        estado_destino: baseState.estados[1],
        grupos_permitidos: [],
        condiciones: [
          { tipo: 'json_logic', configuracion: { rule: { '==': [1, 1] } }, mensaje_error: 'falla', orden: 0, activo: true },
        ],
      }],
    }
    const json = serializeV0_2(state)
    expect(json.flujo.transiciones[0].condiciones).toEqual([
      { tipo: 'json_logic', configuracion: { rule: { '==': [1, 1] } }, mensaje_error: 'falla', orden: 0, activo: true },
    ])
  })

  it('omite el campo condiciones cuando está vacío (paridad con backend)', () => {
    const state = {
      ...baseState,
      transiciones: [{
        id: 1,
        estado_origen: baseState.estados[0],
        estado_destino: baseState.estados[1],
        grupos_permitidos: [],
        condiciones: [],
      }],
    }
    const json = serializeV0_2(state)
    expect(json.flujo.transiciones[0]).not.toHaveProperty('condiciones')
  })

  it('parsea condiciones desde JSON v0.2 y default a [] si ausentes', () => {
    const json = {
      schema_version: '0.2',
      exported_at: '2026-05-17T00:00:00Z',
      catalogos: {
        estados: [
          { nombre: 'A', color: '#fff', icono: 'circle', descripcion: '', orden: 0, activo: true },
          { nombre: 'B', color: '#fff', icono: 'circle', descripcion: '', orden: 1, activo: true },
        ],
        etapas: [], grupos: [], tipos_documento: [],
      },
      flujo: {
        nombre: 'F1', descripcion: '', activo: false, metadatos: null,
        transiciones: [
          {
            estado_origen: 'A', estado_destino: 'B', grupos_permitidos: [],
            condiciones: [
              { tipo: 'python_path', configuracion: { path: 'mod.fn' }, mensaje_error: '', orden: 0, activo: true },
            ],
          },
          { estado_origen: 'B', estado_destino: 'A', grupos_permitidos: [] },
        ],
        requisitos: [],
      },
    }
    const parsed = parseV0_2(json)
    expect(parsed.transiciones[0].condiciones).toHaveLength(1)
    expect(parsed.transiciones[0].condiciones[0].tipo).toBe('python_path')
    expect(parsed.transiciones[1].condiciones).toEqual([])
  })

  it('preserva condiciones de tipo desconocido en round-trip', () => {
    const state = {
      ...baseState,
      transiciones: [{
        id: 1,
        estado_origen: baseState.estados[0],
        estado_destino: baseState.estados[1],
        grupos_permitidos: [],
        condiciones: [
          { tipo: 'futuro_tipo', configuracion: { foo: 'bar' }, mensaje_error: '', orden: 0, activo: true },
        ],
      }],
    }
    const json = serializeV0_2(state)
    const parsed = parseV0_2(json)
    expect(parsed.transiciones[0].condiciones[0].tipo).toBe('futuro_tipo')
    expect(parsed.transiciones[0].condiciones[0].configuracion).toEqual({ foo: 'bar' })
  })

  it('preserva activo: false en round-trip', () => {
    const state = {
      ...baseState,
      transiciones: [{
        id: 1,
        estado_origen: baseState.estados[0],
        estado_destino: baseState.estados[1],
        grupos_permitidos: [],
        condiciones: [
          { tipo: 'json_logic', configuracion: { rule: true }, mensaje_error: 'msg', orden: 0, activo: false },
        ],
      }],
    }
    const json = serializeV0_2(state)
    expect(json.flujo.transiciones[0].condiciones[0].activo).toBe(false)
    const parsed = parseV0_2(json)
    expect(parsed.transiciones[0].condiciones[0].activo).toBe(false)
  })

  it('preserva mensaje_error vacío ("") en serialize y parse', () => {
    const state = {
      ...baseState,
      transiciones: [{
        id: 1,
        estado_origen: baseState.estados[0],
        estado_destino: baseState.estados[1],
        grupos_permitidos: [],
        condiciones: [
          { tipo: 'json_logic', configuracion: { rule: true }, mensaje_error: '', orden: 0, activo: true },
        ],
      }],
    }
    const json = serializeV0_2(state)
    expect(json.flujo.transiciones[0].condiciones[0].mensaje_error).toBe('')
    const parsed = parseV0_2(json)
    expect(parsed.transiciones[0].condiciones[0].mensaje_error).toBe('')
  })
})
