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
