export function EmptyState({ onAdd, firebaseReady }) {
  return (
    <div className="empty-state empty-state--polished">
      <div className="empty-visual" aria-hidden>
        <span className="empty-visual-ring" />
        <span className="empty-visual-emoji">🌱</span>
      </div>
      <h2 className="empty-title">No plants in this space yet</h2>
      <p className="empty-sub">
        Add your first plant here and Leafy will take care of the schedule.
      </p>
      {!firebaseReady && (
        <p className="empty-hint">
          Tip: add Firebase keys in <code>.env</code> so your list syncs everywhere.
        </p>
      )}
      <button type="button" className="btn-primary-empty" onClick={onAdd}>
        Add a plant
      </button>
    </div>
  )
}
