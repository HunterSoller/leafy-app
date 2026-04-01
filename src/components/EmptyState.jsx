export function EmptyState({ onAdd, firebaseReady }) {
  return (
    <div className="empty-state empty-state--polished empty-state-card">
      <div className="empty-visual" aria-hidden>
        <span className="empty-visual-ring" />
        <span className="empty-visual-emoji">🌱</span>
      </div>
      <h2 className="empty-title">No plants yet</h2>
      <p className="empty-sub">
        Add one in a few taps. Leafy will keep watering dates calm and clear —
        whether it’s a windowsill pot or something outside.
      </p>
      {!firebaseReady && (
        <p className="empty-hint">
          To sync across phones, add Firebase keys to your <code>.env</code> when
          you’re ready. This device still works for trying things out.
        </p>
      )}
      <button type="button" className="btn-primary-empty" onClick={onAdd}>
        Add your first plant
      </button>
    </div>
  )
}
