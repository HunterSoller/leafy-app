const SIZES = [
  { id: '', label: 'Not sure', emoji: '—' },
  { id: 'S', label: 'Small', emoji: '🪴' },
  { id: 'M', label: 'Medium', emoji: '🪴' },
  { id: 'L', label: 'Large', emoji: '🪴' },
  { id: 'XL', label: 'Extra Large', emoji: '🪴' },
]

export function PotSizeSelector({ value, onChange, className = '' }) {
  const v = value === undefined || value === null ? '' : value
  return (
    <div
      className={['pot-size-selector', className].filter(Boolean).join(' ')}
      role="group"
      aria-label="Container size"
    >
      {SIZES.map((s) => (
        <button
          key={s.id || 'unsure'}
          type="button"
          className={`pot-pill ${v === s.id ? 'is-active' : ''}`}
          onClick={() => onChange(s.id)}
        >
          <span className="pot-pill-emoji" aria-hidden>
            {s.emoji}
          </span>
          {s.label}
        </button>
      ))}
    </div>
  )
}
