// Sub-proyecto D — LLM Service entry point + error classes.
// Despacha al adapter según aiSettings.provider.
// La implementación de generate() viene en Task 5.

export class MissingApiKeyError extends Error {
  constructor(provider) {
    super(`API key no configurada para provider '${provider}'`)
    this.name = 'MissingApiKeyError'
    this.provider = provider
  }
}

export class ApiAuthError extends Error {
  constructor(message = 'API key inválida o sin permisos') {
    super(message)
    this.name = 'ApiAuthError'
  }
}

export class ApiRateLimitError extends Error {
  constructor(message = 'Demasiadas requests, espera unos segundos') {
    super(message)
    this.name = 'ApiRateLimitError'
  }
}

export class ApiNetworkError extends Error {
  constructor(message = 'Sin conexión al provider') {
    super(message)
    this.name = 'ApiNetworkError'
  }
}

export class ApiResponseError extends Error {
  constructor(message = 'Error en la respuesta del provider', status) {
    super(message)
    this.name = 'ApiResponseError'
    this.status = status
  }
}
