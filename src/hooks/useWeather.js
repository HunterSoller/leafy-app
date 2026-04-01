import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { fetchWeatherForLatLng } from '../lib/weatherApi'

const EMPTY_INTEL = {
  outdoorDelayDays: 0,
  rainDelayDays: 0,
  heatPullInDays: 0,
  humidityPushOutDays: 0,
  effectiveOutdoorShiftDays: 0,
  rainTier: 'none',
  mmCombined48h: 0,
  mmForecastTomorrow: null,
  tempFMax: null,
  tempFCurrent: null,
  humidityPct: null,
  bannerMessage: null,
  fetchedAt: null,
}

/** Saved group coordinates only — no implicit default region. */
function resolveCoords(groupSettings, settingsLoading) {
  if (settingsLoading) return 'loading'
  const lat = groupSettings?.location_lat
  const lng = groupSettings?.location_lng
  if (lat != null && lng != null) {
    const la = Number(lat)
    const ln = Number(lng)
    if (!Number.isNaN(la) && !Number.isNaN(ln)) return { lat: la, lng: ln }
  }
  return null
}

export function useWeather(_groupId, groupSettings, groupSettingsLoading) {
  const coords = useMemo(
    () => resolveCoords(groupSettings, groupSettingsLoading),
    [groupSettings, groupSettingsLoading],
  )

  const [intel, setIntel] = useState(null)

  useEffect(() => {
    if (coords === 'loading') {
      startTransition(() => setIntel(null))
    }
  }, [coords])

  const refresh = useCallback(async () => {
    if (coords === 'loading') return
    if (coords === null) {
      setIntel({
        ...EMPTY_INTEL,
        fetchedAt: Date.now(),
        error: null,
        weatherNeutral: true,
      })
      return
    }
    try {
      const data = await fetchWeatherForLatLng(coords.lat, coords.lng)
      setIntel({
        outdoorDelayDays: data.outdoorDelayDays ?? 0,
        rainDelayDays: data.rainDelayDays ?? 0,
        heatPullInDays: data.heatPullInDays ?? 0,
        humidityPushOutDays: data.humidityPushOutDays ?? 0,
        effectiveOutdoorShiftDays:
          data.effectiveOutdoorShiftDays ?? data.outdoorDelayDays ?? 0,
        rainTier: data.rainTier ?? 'none',
        mmCombined48h: data.mmCombined48h ?? 0,
        mmForecastTomorrow: data.mmForecastTomorrow ?? null,
        tempFMax: data.tempFMax ?? null,
        tempFCurrent: data.tempFCurrent ?? null,
        humidityPct: data.humidityPct ?? null,
        bannerMessage: data.bannerMessage ?? null,
        fetchedAt: data.fetchedAt ?? Date.now(),
        error: null,
        weatherNeutral: false,
      })
    } catch (e) {
      setIntel({
        ...EMPTY_INTEL,
        fetchedAt: null,
        error: e,
        weatherNeutral: true,
      })
    }
  }, [coords])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

  const effective = intel ?? EMPTY_INTEL

  const delayForPlant = useCallback(
    (plant) =>
      plant?.location === 'outdoor' ? effective.effectiveOutdoorShiftDays : 0,
    [effective.effectiveOutdoorShiftDays],
  )

  const weatherContext = useMemo(() => {
    const active = Boolean(
      coords &&
        typeof coords === 'object' &&
        intel &&
        !intel.error &&
        !intel.weatherNeutral &&
        intel.fetchedAt,
    )
    return {
      adjustmentsActive: active,
      mmCombined48h: active ? effective.mmCombined48h : 0,
      mmForecastTomorrow: active ? effective.mmForecastTomorrow ?? null : null,
      tempFMax: active ? effective.tempFMax : null,
      tempFCurrent: active ? effective.tempFCurrent : null,
      humidityPct: active ? effective.humidityPct : null,
      rainTier: active ? effective.rainTier : 'none',
    }
  }, [coords, intel, effective])

  const weatherOptionsForPlant = useCallback(
    (plant) => ({
      plant,
      rainTier:
        plant?.location === 'outdoor' ? weatherContext.rainTier : 'none',
      weatherContext,
    }),
    [weatherContext],
  )

  const usingSavedGroupCoords = Boolean(
    groupSettings?.location_lat != null &&
      groupSettings?.location_lng != null &&
      !Number.isNaN(Number(groupSettings.location_lat)) &&
      !Number.isNaN(Number(groupSettings.location_lng)),
  )

  const weatherFetchedAt =
    intel &&
    !intel.error &&
    !intel.weatherNeutral &&
    typeof intel.fetchedAt === 'number'
      ? intel.fetchedAt
      : null

  return {
    intel,
    weatherContext,
    weatherReady: coords !== 'loading' && intel !== null,
    outdoorDelayDays: effective.effectiveOutdoorShiftDays,
    effectiveOutdoorShiftDays: effective.effectiveOutdoorShiftDays,
    rainTier: weatherContext.rainTier,
    bannerMessage: effective.bannerMessage,
    error: intel?.error ?? null,
    weatherNeutral: Boolean(intel?.weatherNeutral),
    usingLegacyDefaultCoords: false,
    usingSavedGroupCoords,
    weatherFetchedAt,
    refresh,
    delayForPlant,
    weatherOptionsForPlant,
  }
}
