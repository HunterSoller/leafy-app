const CACHE_KEY = 'leafy_weather_cache'
const CACHE_MS = 60 * 60 * 1000

const COHOES_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=42.776&longitude=-73.714&daily=precipitation_sum&timezone=America%2FNew_York&past_days=1&forecast_days=2'

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { t, data } = JSON.parse(raw)
    if (Date.now() - t >= CACHE_MS) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ t: Date.now(), data }),
    )
  } catch {
    /* ignore quota */
  }
}

/**
 * @returns {{ outdoorDelayDays: number, bannerMessage: string | null }}
 */
export function deriveOutdoorDelayFromForecast(json) {
  const daily = json.daily
  if (!daily?.precipitation_sum?.length || !daily?.time?.length) {
    return { outdoorDelayDays: 0, bannerMessage: null }
  }
  const prec = daily.precipitation_sum
  const yesterday = prec[0] ?? 0
  const today = prec[1] ?? 0
  const tomorrow = prec[2] ?? 0

  let outdoorDelayDays = 0
  if (yesterday > 5) outdoorDelayDays = 1
  if (today > 5 || tomorrow > 5) outdoorDelayDays = 2

  let bannerMessage = null
  if (outdoorDelayDays > 0) {
    bannerMessage =
      outdoorDelayDays >= 2
        ? '🌧️ Rain in Cohoes today — outdoor watering delayed 2 days'
        : '🌧️ Recent rain in Cohoes — outdoor watering delayed 1 day'
  }

  return { outdoorDelayDays, bannerMessage }
}

export async function fetchWeatherCohoes() {
  const cached = readCache()
  if (cached) return cached

  const res = await fetch(COHOES_URL)
  if (!res.ok) throw new Error('Weather request failed')
  const json = await res.json()
  const derived = deriveOutdoorDelayFromForecast(json)
  const payload = { ...derived, fetchedAt: Date.now() }
  writeCache(payload)
  return payload
}
