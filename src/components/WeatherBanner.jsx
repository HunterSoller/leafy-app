export function WeatherBanner({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="weather-banner" role="status">
      <p className="weather-banner-text">{message}</p>
      <button
        type="button"
        className="weather-banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss weather notice"
      >
        ×
      </button>
    </div>
  )
}
