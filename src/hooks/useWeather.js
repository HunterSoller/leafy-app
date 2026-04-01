import { useCallback, useEffect, useState } from 'react'
import { fetchWeatherCohoes } from '../lib/weatherApi'

export function useWeather() {
  const [outdoorDelayDays, setOutdoorDelayDays] = useState(0)
  const [bannerMessage, setBannerMessage] = useState(null)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchWeatherCohoes()
      setOutdoorDelayDays(data.outdoorDelayDays ?? 0)
      setBannerMessage(data.bannerMessage ?? null)
      setError(null)
    } catch (e) {
      setError(e)
      setOutdoorDelayDays(0)
      setBannerMessage(null)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

  const delayForPlant = useCallback(
    (plant) => (plant?.location === 'outdoor' ? outdoorDelayDays : 0),
    [outdoorDelayDays],
  )

  return {
    outdoorDelayDays,
    bannerMessage,
    error,
    refresh,
    delayForPlant,
  }
}
