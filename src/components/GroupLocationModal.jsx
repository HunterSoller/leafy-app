import { useCallback } from 'react'
import { useGroupLocationSetup } from '../hooks/useGroupLocationSetup'

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
  const afterSave = useCallback(async () => {
    onClose()
  }, [onClose])

  const {
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
  } = useGroupLocationSetup(saveLocation, { afterSave })

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

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
