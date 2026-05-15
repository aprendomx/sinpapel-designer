/**
 * Stable client-side hash from string.
 * Used for deterministic IDs derived from content (e.g. catalog names).
 */
export function hashId(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString()
}
