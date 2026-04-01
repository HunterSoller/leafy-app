import { useCallback, useState } from 'react'
import { geocodeOpenMeteoSearch } from '../lib/geocodeOpenMeteo'

/**
 * First-open + update flow: save coords per group for Open-Meteo only.
 */
export function GroupLocationModal({
  open,
  onClose,
  groupLabel,
  isDefaultGroup,
  saveLocation,
  onSkipNotNow,
}) {
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

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const saveCoords = useCallback(
    async (payload) => {
      await saveLocation(payload)
      reset()
      onClose()
    },
    [onClose, reset, saveLocation],
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
          await saveCoords({
            location_lat: pos.coords.latitude,
            location_lng: pos.coords.longitude,
            location_label: 'Current location',
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

  if (!open) return null

  const title = isDefaultGroup
    ? 'Set a forecast location'
    : 'Use this group’s location for weather-based watering?'

  return (
    <div
      className="group-loc-backdrop"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="group-loc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-loc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="group-loc-title" className="group-loc-title">
          {title}
        </h2>
        <p className="group-loc-lede">
          {isDefaultGroup
            ? 'Pick where Leafy should pull rain and temperature from for outdoor plants in this space.'
            : `Outdoor plants in “${groupLabel}” can follow real rain and heat for this spot once you choose a location. Indoor plants stay the same.`}
        </p>

        {geoError ? (
          <p className="group-loc-hint group-loc-hint--warn">{geoError}</p>
        ) : (
          <p className="group-loc-hint">
            Your choice is saved only for this group — not shared with other NFC
            spaces.
          </p>
        )}

        <div className="group-loc-actions">
          <button
            type="button"
            className="btn-primary btn-primary--large"
            onClick={requestBrowserLocation}
            disabled={geoBusy}
          >
            {geoBusy ? 'Getting location…' : 'Use my location'}
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setManualOpen(true)
              setGeoError(null)
            }}
            disabled={geoBusy}
          >
            Enter city or ZIP
          </button>
          <button
            type="button"
            className="btn-ghost-inline"
            onClick={() => {
              if (!isDefaultGroup) onSkipNotNow?.()
              handleClose()
            }}
            disabled={geoBusy}
          >
            {isDefaultGroup ? 'Cancel' : 'Not now'}
          </button>
        </div>

        {manualOpen && (
          <div className="group-loc-manual">
            <label className="field field--group-loc">
              <span className="field-label field-label-subtle">
                City, state, ZIP, or address
              </span>
              <input
                className="field-input field-input--soft"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder="e.g. 78704 or Austin, TX"
                autoComplete="postal-code"
              />
            </label>
            {manualError && (
              <p className="field-error field-error--compact">{manualError}</p>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={() => void runManualSearch()}
              disabled={manualBusy || !manualQuery.trim()}
            >
              {manualBusy ? 'Searching…' : 'Search'}
            </button>
            {results.length > 0 && (
              <ul className="group-loc-results">
                {results.map((r, i) => (
                  <li key={`${r.lat}-${r.lng}-${i}`}>
                    <button
                      type="button"
                      className="group-loc-result-btn"
                      onClick={() =>
                        void saveCoords({
                          location_lat: r.lat,
                          location_lng: r.lng,
                          location_label: r.label,
                          location_source: 'manual',
                        })
                      }
                    >
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
