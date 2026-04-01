import { useCallback } from 'react'
import { useGroupLocationSetup } from '../hooks/useGroupLocationSetup'

/**
 * Full-screen first visit for a unique group without a saved forecast location.
 * Reuses the same save path as GroupLocationModal.
 */
export function GroupWelcomeScreen({
  groupLabel,
  saveLocation,
  onSkip,
  onSavedSequence,
  phase = 'idle',
  settingsLoading,
}) {
  const afterSave = useCallback(async () => {
    await onSavedSequence?.()
  }, [onSavedSequence])

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
  } = useGroupLocationSetup(saveLocation, { afterSave })

  const showSuccess = phase === 'success' || phase === 'exit'

  return (
    <div
      className={`group-welcome ${phase === 'exit' ? 'group-welcome--exit' : ''}`}
      aria-busy={settingsLoading || geoBusy}
    >
      <div className="group-welcome-bg" aria-hidden>
        <div className="group-welcome-bg-blob group-welcome-bg-blob--1" />
        <div className="group-welcome-bg-blob group-welcome-bg-blob--2" />
        <div className="group-welcome-bg-grain" />
      </div>

      <div className="group-welcome-inner">
        <header className="group-welcome-header">
          <div className="group-welcome-brand">
            <span className="group-welcome-brand-leaf" aria-hidden>
              🌿
            </span>
            <span className="group-welcome-brand-name">Leafy</span>
          </div>
        </header>

        {settingsLoading ? (
          <div className="group-welcome-loading" role="status">
            <div className="loading-dots" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="group-welcome-loading-text">Preparing your space…</p>
          </div>
        ) : showSuccess ? (
          <div className="group-welcome-success-card" role="status">
            <div className="group-welcome-success-icon" aria-hidden>
              ✓
            </div>
            <h2 className="group-welcome-success-title">You&apos;re all set</h2>
            <p className="group-welcome-success-sub">
              Weather-aware tips will personalize watering for{' '}
              <strong>{groupLabel}</strong>. Opening your dashboard…
            </p>
          </div>
        ) : (
          <>
            <div className="group-welcome-hero">
              <h1 className="group-welcome-title">Welcome to Leafy</h1>
              <p className="group-welcome-subtitle">
                Set this group&apos;s location once so we can tailor outdoor
                watering to real rain and temperature — starting with{' '}
                <span className="group-welcome-space">{groupLabel}</span>.
              </p>
              <p className="group-welcome-once">
                One quick step for this space. Other groups stay separate.
              </p>
            </div>

            <div className="group-welcome-card">
              <h2 className="group-welcome-card-title">Set this group&apos;s location</h2>
              <p className="group-welcome-card-lede">
                Indoor plants always follow your rhythm; outdoors gets smarter
                with local weather when you save a spot.
              </p>

              {geoError ? (
                <p className="group-welcome-hint group-welcome-hint--warn">
                  {geoError}
                </p>
              ) : (
                <p className="group-welcome-hint">
                  Saved only for this NFC space — never shared with your other
                  groups.
                </p>
              )}

              <div className="group-welcome-actions">
                <button
                  type="button"
                  className="btn-welcome-primary"
                  onClick={requestBrowserLocation}
                  disabled={geoBusy || manualBusy}
                >
                  {geoBusy ? 'Requesting location…' : 'Use my location'}
                </button>
                <button
                  type="button"
                  className="btn-welcome-secondary"
                  onClick={() => {
                    setManualOpen(true)
                    setGeoError(null)
                  }}
                  disabled={geoBusy || manualBusy}
                >
                  Enter city or ZIP instead
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
                    disabled={manualBusy || !manualQuery.trim()}
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

            <button
              type="button"
              className="btn-welcome-skip"
              onClick={onSkip}
              disabled={geoBusy}
            >
              I&apos;ll do this later
            </button>
          </>
        )}
      </div>
    </div>
  )
}
