/**
 * NFC tag id from URL: /plant/:tagId or ?plant=tagId
 */
export function isValidNfcTagId(raw) {
  if (typeof raw !== 'string') return false
  const s = raw.trim()
  if (s.length < 4 || s.length > 72) return false
  return /^[a-zA-Z0-9_-]+$/.test(s)
}

export function parsePlantQueryParam(searchString) {
  try {
    const q = new URLSearchParams(
      searchString.startsWith('?') ? searchString : `?${searchString}`,
    )
    const p = q.get('plant')
    if (p && isValidNfcTagId(p)) return p.trim()
  } catch {
    /* ignore */
  }
  return null
}
