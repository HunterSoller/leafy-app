const CACHE_MS = 60 * 60 * 1000

/** Legacy default when `groupId` is default-group and no saved coords (backward compatible). */
export const LEGACY_DEFAULT_LAT = 42.776
export const LEGACY_DEFAULT_LNG = -73.714

function cacheKeyFor(lat, lng) {
  return `leafy_weather_v3:${Number(lat).toFixed(3)}:${Number(lng).toFixed(3)}`
}

function readCache(lat, lng) {
  try {
    const raw = sessionStorage.getItem(cacheKeyFor(lat, lng))
    if (!raw) return null
    const { t, data } = JSON.parse(raw)
    if (Date.now() - t >= CACHE_MS) return null
    return data
  } catch {
    return null
  }
}

function cToF(c) {
  if (c == null || Number.isNaN(c)) return null
  return (c * 9) / 5 + 32
}

function writeCache(lat, lng, data) {
  try {
    sessionStorage.setItem(
      cacheKeyFor(lat, lng),
      JSON.stringify({ t: Date.now(), data }),
    )
  } catch {
    /* ignore quota */
  }
}

export function buildOpenMeteoForecastUrl(latitude, longitude) {
  const u = new URL('https://api.open-meteo.com/v1/forecast')
  u.searchParams.set('latitude', String(latitude))
  u.searchParams.set('longitude', String(longitude))
  u.searchParams.set('daily', 'precipitation_sum,temperature_2m_max')
  u.searchParams.set('current', 'temperature_2m,relative_humidity_2m')
  u.searchParams.set('timezone', 'auto')
  u.searchParams.set('past_days', '1')
  u.searchParams.set('forecast_days', '2')
  return u.toString()
}

/**
 * Rain buckets (48h yesterday+today, mm). Drizzle ≠ soaking.
 * @returns {'drizzle' | 'very_light' | 'light' | 'moderate' | 'heavy'}
 */
function rainTierFromMm(combined) {
  if (combined < 0.5) return 'drizzle'
  if (combined < 2.5) return 'very_light'
  if (combined < 6) return 'light'
  if (combined < 14) return 'moderate'
  return 'heavy'
}

/**
 * Rain-aware delay (days) for outdoor plants only — capped later in net shift.
 * Light rain nudges a little; heavy rain nudges more (never replaces your schedule).
 */
function rainDelayDaysFromMm(mm48, mmTomorrow) {
  let d = 0
  if (mm48 < 0.5) d = 0
  else if (mm48 < 2.5) d = 1
  else if (mm48 < 6) d = 1
  else if (mm48 < 14) d = 2
  else if (mm48 < 28) d = 2
  else d = 3

  if (
    d < 1 &&
    mmTomorrow != null &&
    !Number.isNaN(mmTomorrow) &&
    mmTomorrow >= 8 &&
    mm48 < 6
  ) {
    d = 1
  }
  return Math.min(3, d)
}

/**
 * @returns {{
 *   outdoorDelayDays: number,
 *   rainDelayDays: number,
 *   heatPullInDays: number,
 *   humidityPushOutDays: number,
 *   effectiveOutdoorShiftDays: number,
 *   rainTier: 'none' | 'light' | 'moderate' | 'heavy',
 *   mmCombined48h: number,
 *   tempFMax: number | null,
 *   tempFCurrent: number | null,
 *   humidityPct: number | null,
 *   bannerMessage: string | null,
 *   mmForecastTomorrow: number | null,
 * }}
 */
export function deriveWeatherIntel(json) {
  const daily = json.daily
  if (!daily?.precipitation_sum?.length || !daily?.time?.length) {
    return {
      outdoorDelayDays: 0,
      rainDelayDays: 0,
      heatPullInDays: 0,
      humidityPushOutDays: 0,
      effectiveOutdoorShiftDays: 0,
      rainTier: 'none',
      mmCombined48h: 0,
      tempFMax: null,
      tempFCurrent: null,
      humidityPct: null,
      bannerMessage: null,
      mmForecastTomorrow: null,
    }
  }

  const prec = daily.precipitation_sum
  const yesterdayMm = Number(prec[0]) || 0
  const todayMm = Number(prec[1]) || 0
  const mmCombined48h = yesterdayMm + todayMm
  const mmForecastTomorrow =
    prec.length >= 3 ? Number(prec[2]) || 0 : null

  const rawBand = rainTierFromMm(mmCombined48h)
  const rainDelayDays = rainDelayDaysFromMm(
    mmCombined48h,
    mmForecastTomorrow,
  )

  const temps = daily.temperature_2m_max
  const todayMax =
    temps && temps.length > 1 ? Number(temps[1]) : null
  const curTemp = json.current?.temperature_2m
  const curRh = json.current?.relative_humidity_2m

  /** Hot, dry air → water a bit sooner (pull effective due earlier) */
  let heatPullInDays = 0
  const hot =
    (todayMax != null && !Number.isNaN(todayMax) && todayMax >= 31) ||
    (curTemp != null && !Number.isNaN(curTemp) && curTemp >= 32)
  if (hot) heatPullInDays = 1

  /** Very humid → soil dries slower */
  let humidityPushOutDays = 0
  if (curRh != null && !Number.isNaN(curRh) && curRh >= 78) {
    humidityPushOutDays = 1
  }

  /** Net calendar shift applied to outdoor next-due (positive = due feels later) */
  const effectiveOutdoorShiftDays = Math.min(
    4,
    Math.max(-2, rainDelayDays - heatPullInDays + humidityPushOutDays),
  )

  let bannerMessage = null
  if (rainDelayDays >= 2) {
    bannerMessage =
      'Heavy rain nearby — outdoor dates are eased a bit; you can still water if the soil feels dry.'
  } else if (rainDelayDays === 1) {
    bannerMessage =
      mmCombined48h < 2.5
        ? 'A little rain nearby — outdoor timing shifted slightly.'
        : 'Recent rain — outdoor plants may need a little less right now.'
  }

  const resolvedTier =
    rawBand === 'drizzle' || rawBand === 'very_light' || mmCombined48h < 0.3
      ? 'none'
      : rawBand === 'light'
        ? 'light'
        : rawBand === 'moderate'
          ? 'moderate'
          : 'heavy'

  const tempFMax = cToF(todayMax)
  const tempFCurrent = cToF(curTemp)
  const humidityPct =
    curRh != null && !Number.isNaN(curRh) ? Math.round(curRh) : null

  return {
    outdoorDelayDays: effectiveOutdoorShiftDays,
    rainDelayDays,
    heatPullInDays,
    humidityPushOutDays,
    effectiveOutdoorShiftDays,
    rainTier: resolvedTier,
    mmCombined48h,
    tempFMax,
    tempFCurrent,
    humidityPct,
    bannerMessage,
    mmForecastTomorrow,
  }
}

/** @deprecated use deriveWeatherIntel */
export function deriveOutdoorDelayFromForecast(json) {
  const w = deriveWeatherIntel(json)
  return { outdoorDelayDays: w.outdoorDelayDays, bannerMessage: w.bannerMessage }
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<Awaited<ReturnType<typeof deriveWeatherIntel>> & { fetchedAt: number }>}
 */
export async function fetchWeatherForLatLng(lat, lng) {
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error('Invalid coordinates')
  }

  const cached = readCache(latitude, longitude)
  if (cached) return cached

  const res = await fetch(buildOpenMeteoForecastUrl(latitude, longitude))
  if (!res.ok) throw new Error('Weather request failed')
  const json = await res.json()
  const derived = deriveWeatherIntel(json)
  const payload = { ...derived, fetchedAt: Date.now() }
  writeCache(latitude, longitude, payload)
  return payload
}

/** @deprecated use fetchWeatherForLatLng with explicit coordinates */
export async function fetchWeatherCohoes() {
  return fetchWeatherForLatLng(LEGACY_DEFAULT_LAT, LEGACY_DEFAULT_LNG)
}
