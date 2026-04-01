import { useMemo } from 'react'
import { summarizeGroupSmart } from '../lib/smartPlantStatus'

/**
 * Compact at-a-glance counts — weather and location live in the header panel only.
 */
export function GroupDashboardSummary({
  plants,
  delayForPlant,
  weatherOptionsForPlant,
}) {
  const { today, soon, onTrack, total } = useMemo(
    () => summarizeGroupSmart(plants, delayForPlant, weatherOptionsForPlant),
    [plants, delayForPlant, weatherOptionsForPlant],
  )

  if (!plants.length) return null

  return (
    <section className="group-dash-summary" aria-label="At a glance">
      <div className="group-dash-stats" role="list">
        <div className="group-dash-stat group-dash-stat--total" role="listitem">
          <span className="group-dash-stat-value">{total}</span>
          <span className="group-dash-stat-label">plants</span>
        </div>
        <div
          className={`group-dash-stat group-dash-stat--now ${today > 0 ? 'has-count' : ''}`}
          role="listitem"
        >
          <span className="group-dash-stat-value">{today}</span>
          <span className="group-dash-stat-label">need water</span>
        </div>
        <div
          className={`group-dash-stat group-dash-stat--soon ${soon > 0 ? 'has-count' : ''}`}
          role="listitem"
        >
          <span className="group-dash-stat-value">{soon}</span>
          <span className="group-dash-stat-label">coming up</span>
        </div>
        <div
          className={`group-dash-stat group-dash-stat--ok ${onTrack > 0 ? 'has-count' : ''}`}
          role="listitem"
        >
          <span className="group-dash-stat-value">{onTrack}</span>
          <span className="group-dash-stat-label">all good</span>
        </div>
      </div>
      {today === 0 && (
        <p className="group-dash-celebrate" role="status">
          {soon > 0
            ? 'Nothing urgent right now — you’re in good shape.'
            : 'All caught up for the moment.'}
        </p>
      )}
    </section>
  )
}
