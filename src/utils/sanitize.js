/**
 * Sanitize parsed JSON to prevent prototype pollution.
 * Strips __proto__ and constructor keys recursively.
 */
export function sanitizeJsonInput(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  const safe = Array.isArray(obj) ? [] : {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor') continue
    safe[key] = sanitizeJsonInput(value)
  }
  return safe
}
