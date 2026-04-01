/**
 * Read-only presentation for saved forecast location & whether Leafy is using weather.
 */
export function GroupWeatherPanel({
  isDefaultGroup,
  hasSavedLocation,
  locationLabel,
  forecastActive,
  weatherFetchError,
  onUpdateLocation,
}) {
  const loc = (locationLabel || '').trim() || 'Saved spot'

  let badgeLabel = 'Not set'
  let badgeClass = 'group-weather-badge--off'
  if (hasSavedLocation && forecastActive) {
    badgeLabel = 'Live forecast'
    badgeClass = 'group-weather-badge--on'
  } else if (hasSavedLocation && weatherFetchError) {
    badgeLabel = 'Forecast unavailable'
    badgeClass = 'group-weather-badge--warn'
  } else if (hasSavedLocation) {
    badgeLabel = 'Schedule only'
    badgeClass = 'group-weather-badge--idle'
  }

  return (
    <div className="group-weather-panel">
      <div className="group-weather-panel-row">
        <span className="group-weather-panel-label">Weather for this space</span>
        <span className={`group-weather-badge ${badgeClass}`}>{badgeLabel}</span>
      </div>

      {hasSavedLocation ? (
        <p className="group-weather-panel-loc">
          <span className="group-weather-loc-name">{loc}</span>
          {weatherFetchError ? (
            <span className="group-weather-panel-fallback">
              {' '}
              We couldn’t refresh the sky right now — your plants still follow the
              rhythm you set.
            </span>
          ) : null}
        </p>
      ) : (
        <p className="group-weather-panel-loc group-weather-panel-loc--muted">
          {isDefaultGroup
            ? 'Optional: pick a place on the map so outdoor plants can lean on local rain and heat.'
            : 'One quick setup ties this NFC space to real-world weather for outdoor plants.'}
        </p>
      )}

      <button
        type="button"
        className="btn-weather-update"
        onClick={onUpdateLocation}
      >
        {hasSavedLocation ? 'Update location' : 'Set location'}
      </button>
    </div>
  )
}
