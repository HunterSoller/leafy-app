import { goToGroup } from '../lib/groupRoutes'

/**
 * Dev-only: quick jumps to sample groups (not shown in production builds).
 */
export function DevGroupShortcuts() {
  if (!import.meta.env.DEV) return null

  const samples = ['test1', 'test2', 'dayton-home']

  return (
    <div className="nfc-dev-groups" aria-label="Dev group shortcuts">
      <span className="nfc-dev-groups-label">Dev</span>
      {samples.map((id) => (
        <button
          key={id}
          type="button"
          className="nfc-dev-groups-btn"
          onClick={() => goToGroup(id)}
        >
          {id}
        </button>
      ))}
    </div>
  )
}
