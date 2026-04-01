import { useMemo } from 'react'
import { formatTimeAgo } from '../lib/timeFormat'

/** Manual watering recap from existing plant docs only (no new data layer). */
export function RecentActivitySection({ plants }) {
  const rows = useMemo(() => {
    return plants
      .filter((p) => p.lastWatered)
      .map((p) => ({
        id: p.id,
        name: p.name || 'Plant',
        at: p.lastWatered?.toDate?.() ?? p.lastWatered,
      }))
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 6)
  }, [plants])

  return (
    <section
      className="recent-activity"
      aria-labelledby="recent-activity-heading"
    >
      <div className="recent-activity-head">
        <h2 id="recent-activity-heading" className="recent-activity-title">
          Recent activity
        </h2>
        <p className="recent-activity-sub">
          Manual waterings you log with “Watered it” — not automatic rain.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="recent-activity-empty">
          No entries yet. After you water, tap <strong>Watered it</strong> on
          each plant so your timeline stays accurate.
        </p>
      ) : (
        <ul className="recent-activity-list">
          {rows.map((r) => (
            <li key={r.id} className="recent-activity-item">
              <span className="recent-activity-badge" aria-hidden>
                Manual
              </span>
              <div className="recent-activity-body">
                <span className="recent-activity-plant">{r.name}</span>
                <span className="recent-activity-when">
                  {formatTimeAgo(r.at)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
