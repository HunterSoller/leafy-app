/**
 * Open-Meteo geocoding (no API key). Used for ZIP / city / address-style input.
 * @param {string} query
 * @returns {Promise<Array<{ lat: number, lng: number, label: string }>>}
 */
export async function geocodeOpenMeteoSearch(query) {
  const q = String(query || '').trim()
  if (!q) return []

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', q)
  url.searchParams.set('count', '8')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Location lookup failed')
  const json = await res.json()
  const results = json.results || []
  return results.map((r) => {
    const parts = [r.name, r.admin1, r.country_code].filter(Boolean)
    return {
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      label: parts.join(', '),
    }
  })
}

/**
 * Resolve a human label for GPS coordinates (CORS-friendly, no API key).
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string | null>}
 */
export async function reverseGeocodeLabel(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  if (Number.isNaN(la) || Number.isNaN(ln)) return null

  const url = new URL('https://photon.komoot.io/reverse')
  url.searchParams.set('lat', String(la))
  url.searchParams.set('lon', String(ln))
  url.searchParams.set('lang', 'en')

  const res = await fetch(url.toString())
  if (!res.ok) return null
  const json = await res.json()
  const props = json.features?.[0]?.properties
  if (!props) return null

  const locality =
    props.city ||
    props.town ||
    props.village ||
    props.district ||
    props.county ||
    props.name
  const parts = [locality, props.state, props.country].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}
