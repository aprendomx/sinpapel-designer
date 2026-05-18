import { describe, it, expect, vi, beforeEach } from 'vitest'
import { call } from '../src/services/llmAdapters/anthropic.js'
import {
  ApiAuthError,
  ApiRateLimitError,
  ApiNetworkError,
  ApiResponseError,
} from '../src/services/llmService.js'

describe('anthropic adapter', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('POST con headers correctos y body shape Anthropic', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'hola' }] }),
    })
    const result = await call({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-6',
      system: 'SYS',
      userMessage: 'USER',
    })
    expect(result.text).toBe('hola')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        }),
      }),
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.model).toBe('claude-sonnet-4-6')
    expect(body.system).toBe('SYS')
    expect(body.messages).toEqual([{ role: 'user', content: 'USER' }])
    expect(body.max_tokens).toBeGreaterThan(0)
  })

  it('lanza ApiAuthError con status 401', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid key' } }),
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

  it('lanza ApiNetworkError si fetch falla', async () => {
    global.fetch.mockRejectedValue(new TypeError('network'))
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiNetworkError)
  })

  it('lanza ApiResponseError genérico con otros status', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: { message: 'boom' } }),
    })
    await expect(call({ apiKey: 'x', model: 'm', system: 's', userMessage: 'u' }))
      .rejects.toBeInstanceOf(ApiResponseError)
  })
})
