// S27.7 — Catalog field configurations (config-driven CatalogoEditor).
//
// Single source of truth for: form fields, table columns, default values,
// reference-helper name, store action names. Adding a new catalog =
// adding an entry to CATALOGO_CONFIGS — no UI duplication.

const ESTADO_FIELDS = [
  { name: 'nombre', label: 'Nombre', type: 'text', required: true },
  { name: 'color', label: 'Color', type: 'color', default: '#4DEFE2' },
  { name: 'icono', label: 'Icono', type: 'text', default: 'circle' },
  { name: 'descripcion', label: 'Descripción', type: 'textarea' },
  { name: 'orden', label: 'Orden', type: 'number', default: 0 },
  { name: 'activo', label: 'Activo', type: 'toggle', default: true },
  { name: 'etapa', label: 'Etapa', type: 'select-etapa' },
  { name: 'permite_expediente', label: 'Permite expediente', type: 'toggle', default: false },
  { name: 'expediente_obligatorio', label: 'Expediente obligatorio', type: 'toggle', default: false },
]

const ETAPA_FIELDS = [
  { name: 'nombre', label: 'Nombre', type: 'text', required: true },
  { name: 'color', label: 'Color', type: 'color', default: '#4DEFE2' },
  { name: 'descripcion', label: 'Descripción', type: 'textarea' },
  { name: 'orden', label: 'Orden', type: 'number', default: 0 },
  { name: 'activo', label: 'Activo', type: 'toggle', default: true },
]

const GRUPO_FIELDS = [
  { name: 'name', label: 'Nombre', type: 'text', required: true },
]

const TIPO_DOCUMENTO_FIELDS = [
  { name: 'nombre', label: 'Nombre', type: 'text', required: true },
  { name: 'color', label: 'Color', type: 'color', default: '#4DEFE2' },
  { name: 'descripcion', label: 'Descripción', type: 'textarea' },
  { name: 'orden', label: 'Orden', type: 'number', default: 0 },
  { name: 'activo', label: 'Activo', type: 'toggle', default: true },
]

export const CATALOGO_CONFIGS = {
  estados: {
    label: 'Estado',
    labelPlural: 'Estados',
    storeKey: 'estados',
    nameField: 'nombre',
    fields: ESTADO_FIELDS,
    addAction: 'addEstado',
    updateAction: 'updateEstado',
    removeAction: 'removeEstado',
    findRefs: 'findEstadoReferences',
    refLabel: (refs) =>
      refs.transitions === 0
        ? 'Sin referencias'
        : `${refs.transitions} ${refs.transitions === 1 ? 'transición' : 'transiciones'}`,
  },
  etapas: {
    label: 'Etapa',
    labelPlural: 'Etapas',
    storeKey: 'etapas',
    nameField: 'nombre',
    fields: ETAPA_FIELDS,
    addAction: 'addEtapa',
    updateAction: 'updateEtapa',
    removeAction: 'removeEtapa',
    findRefs: 'findEtapaReferences',
    refLabel: (refs) =>
      refs.dependentEstados === 0
        ? 'Sin referencias'
        : `${refs.dependentEstados} Estado${refs.dependentEstados === 1 ? '' : 's'} dependientes (se desasocian)`,
  },
  grupos: {
    label: 'Grupo',
    labelPlural: 'Grupos',
    storeKey: 'grupos',
    nameField: 'name',
    fields: GRUPO_FIELDS,
    addAction: 'addGrupo',
    updateAction: 'updateGrupo',
    removeAction: 'removeGrupo',
    findRefs: 'findGrupoReferences',
    refLabel: (refs) =>
      refs.transitions === 0
        ? 'Sin referencias'
        : `${refs.transitions} ${refs.transitions === 1 ? 'transición' : 'transiciones'}`,
  },
  tipos_documento: {
    label: 'Tipo Documento',
    labelPlural: 'Tipos Documento',
    storeKey: 'tipos_documento',
    nameField: 'nombre',
    fields: TIPO_DOCUMENTO_FIELDS,
    addAction: 'addTipoDocumento',
    updateAction: 'updateTipoDocumento',
    removeAction: 'removeTipoDocumento',
    findRefs: 'findTipoDocumentoReferences',
    refLabel: (refs) =>
      refs.requisitos === 0
        ? 'Sin referencias'
        : `${refs.requisitos} ${refs.requisitos === 1 ? 'requisito' : 'requisitos'}`,
  },
}

export function defaultsFor(catalogKey) {
  const out = {}
  for (const f of CATALOGO_CONFIGS[catalogKey].fields) {
    if (f.default !== undefined) out[f.name] = f.default
    else if (f.type === 'toggle') out[f.name] = false
    else if (f.type === 'number') out[f.name] = 0
    else out[f.name] = ''
  }
  return out
}
