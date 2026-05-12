// S27.4 transient — replaced por Pinia store + localStorage en S27.5.
// Mimics creditoApi response shapes for drop-in replacement del UI port.
// Async functions return Promise.resolve(...) para preservar el await flow.

const _flujos = [
  {
    id: 1,
    nombre: 'Flujo Demo S27.4',
    descripcion: 'Stub fixture para validar UI port',
    activo: true,
    transiciones_count: 2,
    metadatos: {
      positions: {
        1: { x: 50, y: 50 },
        2: { x: 300, y: 100 },
        3: { x: 500, y: 200 },
      },
    },
  },
  {
    id: 2,
    nombre: 'Flujo Alternativo',
    descripcion: 'Stub 2 - sin transiciones',
    activo: false,
    transiciones_count: 0,
    metadatos: null,
  },
]

const _estados = [
  { id: 1, nombre: 'CAPTURA', color: '#9b2247', icono: 'edit', orden: 1, descripcion: 'Captura inicial', activo: true },
  { id: 2, nombre: 'REVISION', color: '#1e5b4f', icono: 'visibility', orden: 2, descripcion: 'En revisión', activo: true },
  { id: 3, nombre: 'APROBADO', color: '#a57f2c', icono: 'check_circle', orden: 3, descripcion: 'Aprobado final', activo: true },
]

const _grupos = [
  { id: 1, name: 'Comité de Crédito' },
  { id: 2, name: 'Administradores' },
]

const _transiciones_flujo_1 = [
  { id: 1, estado_origen: _estados[0], estado_destino: _estados[1], grupos_permitidos: [] },
  { id: 2, estado_origen: _estados[1], estado_destino: _estados[2], grupos_permitidos: [_grupos[0]] },
]

export const stub = {
  async getFlujos() {
    return _flujos.map((f) => ({ ...f }))
  },

  async getFlujo(id) {
    const f = _flujos.find((x) => x.id === Number(id))
    if (!f) throw new Error(`Flujo ${id} not found (stub)`)
    return { ...f }
  },

  async getFlujoTransiciones(id) {
    if (Number(id) === 1) return _transiciones_flujo_1.map((t) => ({ ...t }))
    return []
  },

  async getEstatuses() {
    return _estados.map((e) => ({ ...e }))
  },

  async getGrupos() {
    return _grupos.map((g) => ({ ...g }))
  },

  async createFlujo(data) {
    const newFlujo = {
      id: _flujos.length + 1,
      nombre: data.nombre,
      descripcion: data.descripcion || '',
      activo: false,
      transiciones_count: 0,
      metadatos: null,
    }
    _flujos.push(newFlujo)
    return { ...newFlujo }
  },

  async updateFlujo(id, patch) {
    const idx = _flujos.findIndex((f) => f.id === Number(id))
    if (idx === -1) throw new Error(`Flujo ${id} not found (stub)`)
    _flujos[idx] = { ..._flujos[idx], ...patch }
    return { ..._flujos[idx] }
  },

  async bulkReplaceTransiciones(id, transiciones) {
    console.log(`[stub] bulkReplaceTransiciones(${id})`, transiciones.length, 'transiciones')
  },

  async saveLayout(id, positions) {
    console.log(`[stub] saveLayout(${id})`, Object.keys(positions).length, 'positions')
  },
}
