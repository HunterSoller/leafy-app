import { useCallback, useRef, useState } from 'react'

export function WateringButton({ onWater, disabled, overdue }) {
  const [saving, setSaving] = useState(false)
  const busyRef = useRef(false)

  const handleClick = useCallback(async () => {
    if (disabled || busyRef.current) return
    busyRef.current = true
    setSaving(true)
    try {
      await onWater()
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }, [disabled, onWater])

  return (
    <button
      type="button"
      className={`watering-btn ${overdue ? 'is-overdue' : ''} ${saving ? 'is-saving' : ''}`}
      onClick={() => void handleClick()}
      disabled={disabled || saving}
      aria-busy={saving}
    >
      <span className="watering-btn-label">
        {saving ? 'Saving…' : 'Watered it'}
      </span>
    </button>
  )
}
