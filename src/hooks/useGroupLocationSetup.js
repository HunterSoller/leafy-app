import { useCallback, useState } from 'react'
import {
  geocodeOpenMeteoSearch,
  reverseGeocodeLabel,
} from '../lib/geocodeOpenMeteo'

/**
 * Shared browser geolocation + manual geocode flow for group location.
 * Used by GroupLocationModal and GroupWelcomeScreen.
 */
export function useGroupLocationSetup(saveLocation, { afterSave } = {}) {
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualQuery, setManualQuery] = useState('')
  const [manualBusy, setManualBusy] = useState(false)
  const [manualError, setManualError] = useState(null)
  const [results, setResults] = useState([])

  const reset = useCallback(() => {
    setGeoBusy(false)
    setGeoError(null)
    setManualOpen(false)
    setManualQuery('')
    setManualBusy(false)
    setManualError(null)
    setResults([])
  }, [])

  const saveCoords = useCallback(
    async (payload) => {
      try {
        await saveLocation(payload)
      } catch {
        return
      }
      reset()
      await afterSave?.()
    },
    [afterSave, reset, saveLocation],
  )

  const requestBrowserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('This browser does not support location.')
      setManualOpen(true)
      return
    }
    setGeoError(null)
    setGeoBusy(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          let label = null
          try {
            label = await reverseGeocodeLabel(
              pos.coords.latitude,
              pos.coords.longitude,
            )
          } catch {
            /* use fallback below */
          }
          await saveCoords({
            location_lat: pos.coords.latitude,
            location_lng: pos.coords.longitude,
            location_label:
              label ||
              `${Number(pos.coords.latitude).toFixed(2)}°, ${Number(pos.coords.longitude).toFixed(2)}°`,
            location_source: 'browser',
          })
        } finally {
          setGeoBusy(false)
        }
      },
      (err) => {
        setGeoBusy(false)
        const denied = err?.code === 1
        setGeoError(
          denied
            ? 'Location permission was blocked. Try entering a city or ZIP below.'
            : 'Could not read your location. Try entering a city or ZIP below.',
        )
        setManualOpen(true)
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 14_000 },
    )
  }, [saveCoords])

  const runManualSearch = useCallback(async () => {
    const q = manualQuery.trim()
    if (!q) return
    setManualError(null)
    setManualBusy(true)
    setResults([])
    try {
      const found = await geocodeOpenMeteoSearch(q)
      if (!found.length) {
        setManualError('No matches. Try a nearby city or ZIP.')
        return
      }
      setResults(found)
    } catch {
      setManualError('Lookup failed. Check your connection and try again.')
    } finally {
      setManualBusy(false)
    }
  }, [manualQuery])

  return {
    geoBusy,
    geoError,
    manualOpen,
    setManualOpen,
    manualQuery,
    setManualQuery,
    manualBusy,
    manualError,
    results,
    setGeoError,
    requestBrowserLocation,
    runManualSearch,
    saveCoords,
    reset,
  }
}
