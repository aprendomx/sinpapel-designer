/**
 * Sync service stub for future backend integration (S27.9 / S28.x).
 *
 * This module defines the interface for round-trip synchronization
 * between sinpapel-designer (client) and sinpapel backend.
 *
 * When backend endpoints are available, replace these stubs with
 * actual fetch/axios calls.
 */

const API_BASE = import.meta.env.VITE_SINPAPEL_API_URL || '/api/sinpapel'

/**
 * Export current workflow state to backend via sinpapel_import_flujo.
 * @param {Object} state - Internal state shape (id-based)
 * @returns {Promise<{success: boolean, flujo_id?: string, errors?: string[]}>}
 */
export async function syncExportToBackend(state) {
  // STUB: implement when backend endpoint is ready
  console.warn('[syncService] syncExportToBackend not implemented yet')
  return { success: false, errors: ['Backend not configured'] }
}

/**
 * Import workflow from backend via sinpapel_export_flujo.
 * @param {string} flujoId - Backend flujo ID
 * @returns {Promise<Object>} JSON v0.2 shape
 */
export async function syncImportFromBackend(flujoId) {
  // STUB: implement when backend endpoint is ready
  console.warn('[syncService] syncImportFromBackend not implemented yet')
  throw new Error('Backend not configured')
}

/**
 * List available workflows from backend.
 * @returns {Promise<Array<{id: string, nombre: string, activo: boolean}>>}
 */
export async function syncListFromBackend() {
  // STUB: implement when backend endpoint is ready
  console.warn('[syncService] syncListFromBackend not implemented yet')
  return []
}

/**
 * Check backend connectivity.
 * @returns {Promise<boolean>}
 */
export async function syncPing() {
  // STUB: implement when backend endpoint is ready
  return false
}
