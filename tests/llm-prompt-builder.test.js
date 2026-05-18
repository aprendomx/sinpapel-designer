import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../src/services/llmPrompts/workflowGenerator.js'

describe('workflowGenerator prompt builder', () => {
  it('userMessage incluye la descripción del usuario', () => {
    const { userMessage } = buildPrompt('Trámite IMSS con 4 estados')
    expect(userMessage).toContain('Trámite IMSS con 4 estados')
  })

  it('system prompt documenta el schema v0.2 y los 3 tipos de condicion', () => {
    const { system } = buildPrompt('x')
    expect(system).toContain('schema_version')
    expect(system).toContain('0.2')
    expect(system).toContain('catalogos')
    expect(system).toContain('estados')
    expect(system).toContain('etapas')
    expect(system).toContain('grupos')
    expect(system).toContain('tipos_documento')
    expect(system).toContain('transiciones')
    expect(system).toContain('python_path')
    expect(system).toContain('json_logic')
    expect(system).toContain('django_orm')
    expect(system).toContain('requisitos')
  })

  it('system prompt impone devolver SÓLO JSON sin markdown', () => {
    const { system } = buildPrompt('x')
    expect(system).toMatch(/sólo|solo/i)
    expect(system).toMatch(/JSON/)
    expect(system).toMatch(/sin markdown|sin explicaciones/i)
  })

  it('system prompt incluye un ejemplo few-shot con shape v0.2', () => {
    const { system } = buildPrompt('x')
    expect(system).toContain('"schema_version": "0.2"')
    expect(system).toContain('"flujo"')
    expect(system).toContain('"transiciones"')
  })
})
