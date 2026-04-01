import { useCallback, useRef } from 'react'
import { useGroupLocationSetup } from '../hooks/useGroupLocationSetup'

/**
 * Full-screen first visit for a unique group without a saved forecast location.
 */
export function GroupWelcomeScreen({
  groupLabel,
  saveLocation,
  phase = null,
}) {
  const cardRef = useRef(null)

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
  } = useGroupLocationSetup(saveLocation)

  const showSuccess = phase === 'success' || phase === 'exit'
  const saving = phase === 'saving'

  const scrollToSetup = useCallback(() => {
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  return (
    <div
      className={`group-welcome ${phase === 'exit' ? 'group-welcome--exit' : ''} ${saving ? 'group-welcome--saving' : ''} ${showSuccess ? '' : 'group-welcome--intro'}`}
      aria-busy={geoBusy || saving}
    >
      <div className="group-welcome-bg" aria-hidden>
        <div className="group-welcome-bg-blob group-welcome-bg-blob--1" />
        <div className="group-welcome-bg-blob group-welcome-bg-blob--2" />
        <div className="group-welcome-bg-grain" />
      </div>

      <div className="group-welcome-inner">
        <header className="group-welcome-header group-welcome-header--intro">
          <div className="group-welcome-brand">
            <span className="group-welcome-brand-leaf" aria-hidden>
              🌿
            </span>
            <span className="group-welcome-brand-name">Leafy</span>
          </div>
        </header>

        {showSuccess ? (
          <div className="group-welcome-success-card" role="status">
            <div className="group-welcome-success-icon" aria-hidden>
              ✓
            </div>
            <h2 className="group-welcome-success-title">You&apos;re all set</h2>
            <p className="group-welcome-success-sub">
              Weather-aware care will stay tuned to{' '}
              <strong>{groupLabel}</strong>. Opening your space…
            </p>
          </div>
        ) : (
          <>
            <div className="group-welcome-hero">
              <h1 className="group-welcome-title">Welcome to Leafy</h1>
              <p className="group-welcome-subtitle">
                Set this space&apos;s location so watering and weather stay
                accurate for{' '}
                <span className="group-welcome-space">{groupLabel}</span>.
              </p>
              <p className="group-welcome-once">
                This only needs to be done once for this space. Other links stay
                separate.
              </p>
              <button
                type="button"
                className="btn-welcome-hero-cta"
                onClick={() => {
                  scrollToSetup()
                  void requestBrowserLocation()
                }}
                disabled={geoBusy || manualBusy || saving}
              >
                {saving
                  ? 'Saving…'
                  : geoBusy
                    ? 'Requesting location…'
                    : "Set this space's location"}
              </button>
            </div>

            <div className="group-welcome-card" ref={cardRef}>
              <h2 className="group-welcome-card-title">How would you like to pin it?</h2>
              <p className="group-welcome-card-lede">
                Outdoor plants can follow real rain and temperature; indoor care
                stays on your rhythm.
              </p>

              {geoError ? (
                <p className="group-welcome-hint group-welcome-hint--warn">
                  {geoError}
                </p>
              ) : (
                <p className="group-welcome-hint">
                  Saved only for this space — never shared with your other Leafy
                  links.
                </p>
              )}

              <div className={`group-welcome-actions ${saving ? 'group-welcome-actions--dim' : ''}`}>
                <button
                  type="button"
                  className="btn-welcome-secondary"
                  onClick={requestBrowserLocation}
                  disabled={geoBusy || manualBusy || saving}
                >
                  {geoBusy ? 'Requesting location…' : 'Use my precise location'}
                </button>
                <button
                  type="button"
                  className="btn-welcome-secondary"
                  onClick={() => {
                    setManualOpen(true)
                    setGeoError(null)
                  }}
                  disabled={geoBusy || manualBusy || saving}
                >
                  Search city or ZIP
                </button>
              </div>

              {manualOpen && (
                <div className="group-welcome-manual">
                  <label className="field field--welcome-loc">
                    <span className="field-label field-label-subtle">
                      City, neighborhood, or ZIP
                    </span>
                    <input
                      className="field-input field-input--soft"
                      value={manualQuery}
                      onChange={(e) => setManualQuery(e.target.value)}
                      placeholder="e.g. Portland, OR or 97201"
                      autoComplete="postal-code"
                    />
                  </label>
                  {manualError && (
                    <p className="field-error field-error--compact">
                      {manualError}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn-welcome-secondary btn-welcome-secondary--search"
                    onClick={() => void runManualSearch()}
                    disabled={manualBusy || !manualQuery.trim() || saving}
                  >
                    {manualBusy ? 'Searching…' : 'Search'}
                  </button>
                  {results.length > 0 && (
                    <ul className="group-welcome-results">
                      {results.map((r, i) => (
                        <li key={`${r.lat}-${r.lng}-${i}`}>
                          <button
                            type="button"
                            className="group-welcome-result-btn"
                            onClick={() =>
                              void saveCoords({
                                location_lat: r.lat,
                                location_lng: r.lng,
                                location_label: r.label,
                                location_source: 'manual',
                              })
                            }
                            disabled={saving}
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
          </>
        )}
      </div>
    </div>
  )
}
