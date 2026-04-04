/**
 * Hash routing for static hosting: #/group/:groupId
 * Primary storage key for “last opened group” on this device.
 */

/** Current canonical key (requested product name). */
export const LEAFY_GROUP_ID_STORAGE_KEY = 'leafy_group_id'

/** @deprecated read for one-time migration only */
export const LEAFY_LAST_GROUP_STORAGE_KEY = 'leafy:lastGroupId'

/**
 * Navigate to a group using the hash router. Ensures a leading `#`.
 * @param {string} groupId
 */
export function goToGroup(groupId) {
  const clean = String(groupId || '').trim()
  if (!clean || !isValidGroupId(clean)) return
  window.location.hash = `#/group/${encodeURIComponent(clean)}`
}

/**
 * @returns {string | null}
 */
export function getGroupIdFromHash() {
  const hash = window.location.hash || ''
  const match = hash.match(/^#\/group\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1].trim()) : null
}

/**
 * React Router hash pathname, e.g. `/group/dayton-home/setup` → `dayton-home`
 * @param {string} pathname
 * @returns {string | null}
 */
export function parseGroupIdFromPathname(pathname) {
  const m = String(pathname || '').match(/^\/group\/([^/]+)/)
  if (!m) return null
  try {
    const id = decodeURIComponent(m[1]).trim()
    return id || null
  } catch {
    return m[1].trim() || null
  }
}

/**
 * Group ids: URL-safe slug per NFC tag / space.
 * @param {string} raw
 */
export function isValidGroupId(raw) {
  if (typeof raw !== 'string') return false
  const s = raw.trim()
  if (s.length < 2 || s.length > 80) return false
  return /^[a-zA-Z0-9_-]+$/.test(s)
}

/**
 * Reads `leafy_group_id`, then migrates legacy `leafy:lastGroupId` once if present.
 * @returns {string | null}
 */
export function readStoredLastGroupId() {
  try {
    const primary = localStorage.getItem(LEAFY_GROUP_ID_STORAGE_KEY)
    if (primary && isValidGroupId(primary)) return primary.trim()

    const legacy = localStorage.getItem(LEAFY_LAST_GROUP_STORAGE_KEY)
    if (legacy && isValidGroupId(legacy)) {
      const v = legacy.trim()
      localStorage.setItem(LEAFY_GROUP_ID_STORAGE_KEY, v)
      return v
    }
  } catch {
    /* private mode */
  }
  return null
}

/**
 * Persists last-opened group (any valid `#/group/:id` visit).
 * @param {string} groupId
 */
export function rememberLastGroupId(groupId) {
  if (!isValidGroupId(groupId)) return
  try {
    localStorage.setItem(LEAFY_GROUP_ID_STORAGE_KEY, groupId.trim())
  } catch {
    /* ignore */
  }
}
