export function StatusBadge({ location }) {
  const outdoor = location === 'outdoor'
  return (
    <span className="status-badge">
      {outdoor ? 'Outdoor' : 'Indoor'} {outdoor ? '🌿' : '🪴'}
    </span>
  )
}
