export function EmptyState({ onAdd, firebaseReady }) {
  return (
    <div className="empty-state empty-state--polished empty-state-card">
      <div className="empty-visual" aria-hidden>
        <span className="empty-visual-ring" />
        <span className="empty-visual-emoji">🌱</span>
      </div>
      <h2 className="empty-title">This space is ready for plants</h2>
      <p className="empty-sub">
        Snap a photo or name a plant — Leafy builds a calm care plan. Works for
        one pot, a planter, or a whole bed. Tap your tag anytime to jump back.
      </p>
      {!firebaseReady && (
        <p className="empty-hint">
          To sync this list across devices, add your Firebase keys in{' '}
          <code>.env</code> when you’re ready.
        </p>
      )}
      <button type="button" className="btn-primary-empty" onClick={onAdd}>
        Add your first plant
      </button>
    </div>
  )
}
