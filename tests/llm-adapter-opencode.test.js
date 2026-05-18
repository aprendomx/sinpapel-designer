import { describe, it, expect, vi, beforeEach } from 'vitest'
import { call } from '../src/services/llmAdapters/opencode.js'
import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../src/services/llmService.js'

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

describe('opencode adapter', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('happy path: crea sesión y envía prompt con shape correcto', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-1' }))
      .mockResolvedValueOnce(jsonResponse(200, {
        info: { id: 'msg-1' },
        parts: [{ type: 'text', text: 'hola mundo' }],
      }))

    const result = await call({
      apiKey: '',
      model: 'anthropic/claude-sonnet-4-6',
      system: 'SYS',
      userMessage: 'USER',
      opencodeUrl: 'http://localhost:4096',
    })

    expect(result.text).toBe('hola mundo')
    expect(global.fetch).toHaveBeenCalledTimes(2)

    // primer call: session create
    expect(global.fetch.mock.calls[0][0]).toBe('http://localhost:4096/session')
    expect(global.fetch.mock.calls[0][1].method).toBe('POST')
    const sessionBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(sessionBody).toEqual({ title: 'sinpapel-designer' })
    expect(global.fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization')

    // segundo call: prompt
    expect(global.fetch.mock.calls[1][0]).toBe('http://localhost:4096/session/sess-1/prompt')
    expect(global.fetch.mock.calls[1][1].method).toBe('POST')
    const promptBody = JSON.parse(global.fetch.mock.calls[1][1].body)
    expect(promptBody).toEqual({
      model: { providerID: 'anthropic', modelID: 'claude-sonnet-4-6' },
      parts: [{ type: 'text', text: 'USER' }],
      system: 'SYS',
      tools: [],
    })
  })

  it('con password: incluye Authorization: Basic en ambos POSTs', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-2' }))
      .mockResolvedValueOnce(jsonResponse(200, { parts: [{ type: 'text', text: 'ok' }] }))

    await call({
      apiKey: 'secretpw',
      model: 'anthropic/claude-sonnet-4-6',
      system: 'S',
      userMessage: 'U',
      opencodeUrl: 'http://localhost:4096',
    })

    const expectedHeader = 'Basic ' + btoa('opencode:secretpw')
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe(expectedHeader)
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe(expectedHeader)
  })

  it('split de model: anthropic/claude-sonnet-4-6 -> providerID + modelID', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-3' }))
      .mockResolvedValueOnce(jsonResponse(200, { parts: [{ type: 'text', text: 'x' }] }))

    await call({
      apiKey: '',
      model: 'openai/gpt-4-turbo',
      system: 'S',
      userMessage: 'U',
      opencodeUrl: 'http://localhost:4096',
    })

    const promptBody = JSON.parse(global.fetch.mock.calls[1][1].body)
    expect(promptBody.model).toEqual({ providerID: 'openai', modelID: 'gpt-4-turbo' })
  })

  it('lanza ApiAuthError con 401 en session create', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(401, { error: { message: 'auth' } }))
    await expect(call({
      apiKey: 'bad', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })).rejects.toBeInstanceOf(ApiAuthError)
    expect(global.fetch).toHaveBeenCalledTimes(1) // no llega al segundo POST
  })

  it('lanza ApiRateLimitError con 429 en prompt', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-4' }))
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: 'rate' } }))
    await expect(call({
      apiKey: '', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })).rejects.toBeInstanceOf(ApiRateLimitError)
  })

  it('lanza ApiNetworkError si fetch lanza (server down)', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('failed to fetch'))
    await expect(call({
      apiKey: '', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })).rejects.toBeInstanceOf(ApiNetworkError)
  })

  it('propaga AbortError sin envolverlo', async () => {
    const abortErr = new DOMException('aborted', 'AbortError')
    global.fetch.mockRejectedValueOnce(abortErr)
    await expect(call({
      apiKey: '', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })).rejects.toBe(abortErr)
  })

  it('lanza ApiResponseError genérico con otros status (ej. 500)', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-6' }))
      .mockResolvedValueOnce(jsonResponse(500, { error: { message: 'server error' } }))
    await expect(call({
      apiKey: '', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })).rejects.toBeInstanceOf(ApiResponseError)
  })

  it('filtra parts a sólo type=text y concatena (ignora tool calls u otros)', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { id: 'sess-5' }))
      .mockResolvedValueOnce(jsonResponse(200, {
        parts: [
          { type: 'text', text: 'parte1 ' },
          { type: 'tool_use', name: 'shell' },
          { type: 'text', text: 'parte2' },
        ],
      }))
    const result = await call({
      apiKey: '', model: 'anthropic/sonnet', system: 's', userMessage: 'u',
      opencodeUrl: 'http://localhost:4096',
    })
    expect(result.text).toBe('parte1 parte2')
  })
})
