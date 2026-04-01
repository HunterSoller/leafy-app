import { useEffect } from 'react'

/**
 * Lightweight success moment after logging a watering — auto-dismiss + tap to close.
 */
export function WateringCelebration({ plantName, onDismiss }) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(), 2000)
    return () => window.clearTimeout(t)
  }, [onDismiss])

  const name = (plantName || '').trim() || 'Your plant'

  return (
    <div
      className="watering-celebration-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="watering-celebration-title"
      aria-describedby="watering-celebration-desc"
      onClick={onDismiss}
    >
      <div
        className="watering-celebration-sheet"
        onClick={(e) => e.stopPropagation()}
        aria-live="polite"
      >
        <div className="watering-celebration-icon" aria-hidden>
          <span className="watering-celebration-check">✓</span>
          <span className="watering-celebration-ring" />
        </div>
        <h2 id="watering-celebration-title" className="watering-celebration-title">
          Got it — watering saved
        </h2>
        <p id="watering-celebration-desc" className="watering-celebration-desc">
          <strong>{name}</strong> is updated. Next reminders follow what you just
          told us.
        </p>
        <button type="button" className="watering-celebration-done" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  )
}
