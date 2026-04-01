/** @typedef {typeof DEFAULT_GROUP_ID | string} GroupId */

export const DEFAULT_GROUP_ID = 'default-group'

/**
 * Read ?group= from the URL. Empty / missing → default-group.
 */
export function getGroupId() {
  if (typeof window === 'undefined') return DEFAULT_GROUP_ID
  const raw = new URLSearchParams(window.location.search).get('group')
  const id = (raw || '').trim()
  return id || DEFAULT_GROUP_ID
}

/**
 * Backwards compatibility: missing / null / '' stored values belong to default-group.
 */
export function normalizeStoredGroupId(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_GROUP_ID
  }
  return String(value)
}

export function plantBelongsToGroup(plant, groupId) {
  return normalizeStoredGroupId(plant?.groupId) === groupId
}

/** Human label for the NFC “space” (e.g. kitchen → “Kitchen plants”). */
export function getGroupSpaceLabel(groupId) {
  if (!groupId || groupId === DEFAULT_GROUP_ID) return 'Your plants'
  const slug = String(groupId).replace(/-/g, ' ').trim()
  const words = slug.split(/\s+/).filter(Boolean)
  const titled = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
  return `${titled} plants`
}
