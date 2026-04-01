const SIZES = [
  { id: 'S', label: 'Small', emoji: '🪴' },
  { id: 'M', label: 'Medium', emoji: '🪴' },
  { id: 'L', label: 'Large', emoji: '🪴' },
  { id: 'XL', label: 'Extra Large', emoji: '🪴' },
]

export function PotSizeSelector({ value, onChange }) {
  return (
    <div className="pot-size-selector" role="group" aria-label="Pot size">
      {SIZES.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`pot-pill ${value === s.id ? 'is-active' : ''}`}
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
