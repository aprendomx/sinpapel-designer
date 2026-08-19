// sinpapel 0.8.x — requiere_firma round-trip en schema v0.2.
// El backend serializa ConfiguracionTransicion.requiere_firma desde 0.8.2;
// el designer debe preservarlo en ambas direcciones (JSONs viejos sin la
// key → default false).

import { describe, it, expect } from 'vitest'
import { serializeV0_2, parseV0_2 } from '../src/data/schema-v0_2.js'

const STATE_CON_FIRMA = {
  flujo: {
    id: '1', nombre: 'FirmaTest', descripcion: '', activo: true,
    metadatos: null,
  },
  estados: [
    { id: 1, nombre: 'CAPTURA', color: '#9b2247', icono: 'edit', orden: 1,
      descripcion: '', activo: true, etapa: null,
      permite_expediente: false, expediente_obligatorio: false },
    { id: 2, nombre: 'APROBADA', color: '#0a0', icono: 'check', orden: 2,
      descripcion: '', activo: true, etapa: null,
      permite_expediente: false, expediente_obligatorio: false },
  ],
  etapas: [],
  grupos: [{ id: 1, name: 'Comité' }],
  tipos_documento: [],
  transiciones: [
    {
      id: 1,
      estado_origen: { nombre: 'CAPTURA' },
      estado_destino: { nombre: 'APROBADA' },
      grupos_permitidos: [{ id: 1, name: 'Comité' }],
      requiere_firma: true,
      condiciones: [],
    },
    {
      id: 2,
      estado_origen: { nombre: 'APROBADA' },
      estado_destino: { nombre: 'CAPTURA' },
      grupos_permitidos: [],
      // sin requiere_firma → serializa false
      condiciones: [],
    },
  ],
  requisitos: [],
}

describe('schema-v0_2 · requiere_firma', () => {
  it('serializeV0_2 emite requiere_firma en cada transición', () => {
    const json = serializeV0_2(STATE_CON_FIRMA)
    const [t1, t2] = json.flujo.transiciones
    expect(t1.requiere_firma).toBe(true)
    expect(t2.requiere_firma).toBe(false)
  })

  it('parseV0_2 hidrata requiere_firma (default false si falta la key)', () => {
    const json = serializeV0_2(STATE_CON_FIRMA)
    // Simular JSON viejo: quitar la key de la segunda transición
    delete json.flujo.transiciones[1].requiere_firma

    const state = parseV0_2(json)
    expect(state.transiciones[0].requiere_firma).toBe(true)
    expect(state.transiciones[1].requiere_firma).toBe(false)
  })

  it('round-trip completo preserva el flag', () => {
    const json1 = serializeV0_2(STATE_CON_FIRMA)
    const state = parseV0_2(json1)
    const json2 = serializeV0_2(state)
    expect(json2.flujo.transiciones[0].requiere_firma).toBe(true)
    expect(json2.flujo.transiciones[1].requiere_firma).toBe(false)
  })
})
