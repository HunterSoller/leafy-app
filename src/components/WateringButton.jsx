import { useCallback, useState } from 'react'

export function WateringButton({ onWater, disabled, overdue }) {
  const [phase, setPhase] = useState('idle')
  const [ripple, setRipple] = useState(false)

  const handleClick = useCallback(async () => {
    if (disabled || phase !== 'idle') return
    setRipple(true)
    window.setTimeout(() => setRipple(false), 600)
    setPhase('logging')
    try {
      await onWater()
    } finally {
      setPhase('done')
      window.setTimeout(() => setPhase('idle'), 1600)
    }
  }, [disabled, onWater, phase])

  const label =
    phase === 'done'
      ? 'Marked as watered'
      : phase === 'logging'
        ? 'Saving…'
        : 'Watered it'

  return (
    <button
      type="button"
      className={`watering-btn ${overdue ? 'is-overdue' : ''} ${ripple ? 'has-ripple' : ''} ${phase === 'done' ? 'is-success' : ''}`}
      onClick={handleClick}
      disabled={disabled || phase === 'logging'}
      style={{ touchAction: 'manipulation' }}
    >
      {label}
    </button>
  )
}
