import { DEFAULT_GROUP_ID, normalizeStoredGroupId } from './group'

const PREFIX = 'leafy_group_settings_v1:'

function keyFor(groupId) {
  return `${PREFIX}${normalizeStoredGroupId(groupId)}`
}

/** Offline / no-Firebase mirror for group location fields only. */
export function readLocalGroupSettings(groupId) {
  try {
    const raw = localStorage.getItem(keyFor(groupId))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data?.location_lat == null || data?.location_lng == null) return null
    return data
  } catch {
    return null
  }
}

export function writeLocalGroupSettings(groupId, payload) {
  const id = normalizeStoredGroupId(groupId)
  try {
    localStorage.setItem(
      keyFor(id),
      JSON.stringify({
        location_lat: payload.location_lat,
        location_lng: payload.location_lng,
        location_label: payload.location_label ?? '',
        location_source: payload.location_source ?? 'manual',
      }),
    )
  } catch {
    /* quota */
  }
}

export function clearLocalGroupSettings(groupId) {
  try {
    localStorage.removeItem(keyFor(groupId))
  } catch {
    /* ignore */
  }
}

const SKIP_PREFIX = 'leafy_group_loc_skip_v1:'

export function isGroupLocationPromptSkipped(groupId) {
  if (normalizeStoredGroupId(groupId) === DEFAULT_GROUP_ID) return true
  try {
    return localStorage.getItem(`${SKIP_PREFIX}${groupId}`) === '1'
  } catch {
    return false
  }
}

export function setGroupLocationPromptSkipped(groupId, skipped) {
  try {
    if (skipped) localStorage.setItem(`${SKIP_PREFIX}${groupId}`, '1')
    else localStorage.removeItem(`${SKIP_PREFIX}${groupId}`)
  } catch {
    /* ignore */
  }
}
