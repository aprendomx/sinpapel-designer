import { describe, it, expect, vi, beforeEach } from 'vitest'
import { call } from '../src/services/llmAdapters/openai.js'
import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../src/services/llmService.js'

describe('openai adapter', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('POST con headers Bearer y body shape OpenAI', async () => {
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: 'hola' } }] }),
    })
    const result = await call({
      apiKey: 'sk-test',
      model: 'gpt-5',
      system: 'SYS',
      userMessage: 'USER',
    })
    expect(result.text).toBe('hola')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer sk-test',
          'content-type': 'application/json',
        }),
      }),
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.model).toBe('gpt-5')
    expect(body.messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USER' },
    ])
    expect(body.max_tokens).toBeGreaterThan(0)
  })

  it('lanza ApiAuthError con status 401', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ error: { message: 'invalid' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiAuthError)
  })

  it('lanza ApiAuthError con status 403 también', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 403,
      json: async () => ({ error: { message: 'no access' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiAuthError)
  })

  it('lanza ApiRateLimitError con status 429', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ error: { message: 'rate' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiRateLimitError)
  })

  it('lanza ApiNetworkError si fetch lanza', async () => {
    global.fetch.mockRejectedValue(new TypeError('network'))
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiNetworkError)
  })

  it('propaga AbortError sin envolverlo', async () => {
    const abortErr = new DOMException('aborted', 'AbortError')
    global.fetch.mockRejectedValue(abortErr)
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBe(abortErr)
  })

  it('lanza ApiResponseError genérico con 500', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: { message: 'boom' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiResponseError)
  })
})
