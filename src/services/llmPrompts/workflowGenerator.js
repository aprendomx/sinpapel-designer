// Sub-proyecto D — System prompt + user message builder para el generador IA.
// Documenta el schema v0.2 e incluye un ejemplo few-shot.

const SCHEMA_DOCS = `
Schema JSON v0.2:

{
  "schema_version": "0.2",
  "exported_at": "<ISO 8601 datetime>",
  "catalogos": {
    "estados": [
      { "nombre": "STR_UNIQUE_UPPER_SNAKE", "color": "#hex", "icono": "material_icon_name",
        "descripcion": "str", "orden": int, "activo": bool,
        "etapa": "STR_O_NULL", "permite_expediente": bool, "expediente_obligatorio": bool }
    ],
    "etapas": [
      { "nombre": "STR_UNIQUE", "color": "#hex", "descripcion": "str", "orden": int, "activo": bool }
    ],
    "grupos": [ { "name": "str_kebab_o_snake" } ],
    "tipos_documento": [
      { "nombre": "STR_UNIQUE", "color": "#hex", "descripcion": "str", "orden": int, "activo": bool }
    ]
  },
  "flujo": {
    "nombre": "str",
    "descripcion": "str",
    "activo": bool,
    "metadatos": null,
    "transiciones": [
      {
        "estado_origen": "<nombre estado>",
        "estado_destino": "<nombre estado>",
        "grupos_permitidos": ["<grupo.name>"],
        "condiciones": [
          {
            "tipo": "python_path" | "json_logic" | "django_orm",
            "configuracion": <shape depende de tipo>,
            "mensaje_error": "str",
            "orden": int,
            "activo": bool
          }
        ]
      }
    ],
    "requisitos": [
      { "estado": "<nombre estado destino>",
        "tipo_documento": "<nombre tipo_documento>",
        "porcentaje": int_0_100,
        "auto_carga": bool }
    ]
  }
}

Shapes de configuracion por tipo:
- python_path: { "path": "modulo.submodulo.funcion" } (función f(instance, user) -> (bool, str|None))
- json_logic: { "rule": <regla JSON Logic, ej. {">=": [{"var": "monto"}, 100000]}> }
- django_orm: { "lookup": { "campo__lookup": valor, ... } }
`.trim()

const RULES = `
REGLAS OBLIGATORIAS:
1. Devuelve SÓLO un objeto JSON. No incluyas markdown (sin \`\`\`), sin explicaciones, sin prefacios.
2. \`estados[*].nombre\` debe ser UNIQUE y en UPPER_SNAKE_CASE.
3. \`transiciones[*].estado_origen\` y \`estado_destino\` deben referenciar \`nombres\` que existan en catalogos.estados.
4. \`transiciones[*].grupos_permitidos[*]\` deben referenciar \`name\` que exista en catalogos.grupos.
5. \`condiciones[*].tipo\` SÓLO puede ser uno de: python_path, json_logic, django_orm.
6. \`requisitos[*].tipo_documento\` debe existir en catalogos.tipos_documento.
7. Si no hay condiciones para una transición, OMITE el campo (no rellenes con []).
8. Si no estás seguro de una condición, NO la inventes. Es mejor un flujo sin condiciones que con configuraciones bogus.
9. \`metadatos\` siempre null en la salida (el designer asigna posiciones después).
10. \`exported_at\` debe ser un ISO 8601 datetime válido.
`.trim()

const FEW_SHOT_EXAMPLE = `
EJEMPLO de salida válida para un flujo simple de aprobación con condición:

{
  "schema_version": "0.2",
  "exported_at": "2026-05-17T00:00:00Z",
  "catalogos": {
    "estados": [
      { "nombre": "INICIO", "color": "#9b2247", "icono": "play_circle", "descripcion": "Solicitud creada", "orden": 0, "activo": true, "etapa": null, "permite_expediente": true, "expediente_obligatorio": false },
      { "nombre": "EN_REVISION", "color": "#a57f2c", "icono": "fact_check", "descripcion": "Revisión documental", "orden": 1, "activo": true, "etapa": null, "permite_expediente": true, "expediente_obligatorio": true },
      { "nombre": "APROBADO", "color": "#1e5b4f", "icono": "check_circle", "descripcion": "Aprobado", "orden": 2, "activo": true, "etapa": null, "permite_expediente": false, "expediente_obligatorio": false }
    ],
    "etapas": [],
    "grupos": [ { "name": "revisor" }, { "name": "aprobador" } ],
    "tipos_documento": [ { "nombre": "INE", "color": "#666", "descripcion": "Identificación oficial", "orden": 0, "activo": true } ]
  },
  "flujo": {
    "nombre": "Aprobación simple",
    "descripcion": "Flujo demo con un nivel de aprobación",
    "activo": false,
    "metadatos": null,
    "transiciones": [
      {
        "estado_origen": "INICIO",
        "estado_destino": "EN_REVISION",
        "grupos_permitidos": ["revisor"]
      },
      {
        "estado_origen": "EN_REVISION",
        "estado_destino": "APROBADO",
        "grupos_permitidos": ["aprobador"],
        "condiciones": [
          { "tipo": "json_logic", "configuracion": { "rule": { ">=": [{"var": "monto"}, 0] } }, "mensaje_error": "Monto inválido", "orden": 0, "activo": true }
        ]
      }
    ],
    "requisitos": [
      { "estado": "EN_REVISION", "tipo_documento": "INE", "porcentaje": 100, "auto_carga": false }
    ]
  }
}
`.trim()

const SYSTEM = `Eres un generador de workflows administrativos en formato JSON v0.2 del proyecto Sinpapel.

${SCHEMA_DOCS}

${RULES}

${FEW_SHOT_EXAMPLE}
`

export function buildPrompt(userDescription) {
  return {
    system: SYSTEM,
    userMessage: `Genera el JSON v0.2 para el siguiente flujo:\n\n${userDescription}`,
  }
}
