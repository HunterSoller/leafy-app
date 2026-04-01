function formatForecastUpdated(ms) {
  if (ms == null || Number.isNaN(ms)) return null
  const sec = Math.floor((Date.now() - ms) / 1000)
  if (sec < 45) return 'Updated just now'
  if (sec < 3600) return `Updated ${Math.max(1, Math.floor(sec / 60))} min ago`
  if (sec < 86400) return `Updated ${Math.floor(sec / 3600)} hr ago`
  return `Updated ${Math.floor(sec / 86400)} day${sec >= 172800 ? 's' : ''} ago`
}

/**
 * Forecast location + whether Leafy is using weather (outdoor plants only).
 */
export function GroupWeatherPanel({
  isDefaultGroup,
  hasSavedLocation,
  locationLabel,
  forecastActive,
  weatherFetchError,
  weatherFetchedAt,
  onUpdateLocation,
}) {
  const loc = (locationLabel || '').trim() || 'Saved spot'
  const updatedLine = formatForecastUpdated(weatherFetchedAt)

  let badgeLabel = 'Not set'
  let badgeClass = 'group-weather-badge--off'
  if (hasSavedLocation && forecastActive) {
    badgeLabel = 'Forecast on'
    badgeClass = 'group-weather-badge--on'
  } else if (hasSavedLocation && weatherFetchError) {
    badgeLabel = 'Forecast paused'
    badgeClass = 'group-weather-badge--warn'
  } else if (hasSavedLocation) {
    badgeLabel = 'Schedule only'
    badgeClass = 'group-weather-badge--idle'
  }

  return (
    <div className="group-weather-panel">
      <div className="group-weather-panel-row">
        <span className="group-weather-panel-label">Weather (outdoor plants)</span>
        <span className={`group-weather-badge ${badgeClass}`}>{badgeLabel}</span>
      </div>

      {hasSavedLocation ? (
        <div className="group-weather-panel-loc-block">
          <p className="group-weather-panel-loc group-weather-panel-loc--with-action">
            <span className="group-weather-loc-name">{loc}</span>
            {weatherFetchError ? (
              <span className="group-weather-panel-fallback">
                {' '}
                We couldn’t load a fresh forecast — your watering schedule is
                unchanged.
              </span>
            ) : null}
          </p>
          {updatedLine && !weatherFetchError ? (
            <p className="group-weather-updated">{updatedLine}</p>
          ) : null}
          <button
            type="button"
            className="btn-weather-change-loc"
            onClick={onUpdateLocation}
          >
            Change location
          </button>
        </div>
      ) : (
        <>
          <p className="group-weather-panel-loc group-weather-panel-loc--muted">
            {isDefaultGroup
              ? 'Optional: set a spot so outdoor plants can lean on local rain and heat.'
              : 'Saving a place here helps outdoor plants — indoors stay on your rhythm.'}
          </p>
          <button
            type="button"
            className="btn-weather-update"
            onClick={onUpdateLocation}
          >
            Set location
          </button>
        </>
      )}
    </div>
  )
}
