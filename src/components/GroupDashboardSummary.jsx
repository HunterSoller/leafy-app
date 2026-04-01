import { useMemo } from 'react'
import { summarizeGroupSmart } from '../lib/smartPlantStatus'

/**
 * At-a-glance counts + location + weather layer for the group home.
 */
export function GroupDashboardSummary({
  plants,
  delayForPlant,
  weatherOptionsForPlant,
  locationLabel,
  hasSavedLocation,
  forecastActive,
  weatherFetchError,
}) {
  const { today, soon, onTrack, total } = useMemo(
    () => summarizeGroupSmart(plants, delayForPlant, weatherOptionsForPlant),
    [plants, delayForPlant, weatherOptionsForPlant],
  )

  if (!plants.length) return null

  const locLine = hasSavedLocation
    ? locationLabel?.trim()
      ? `Location: ${locationLabel.trim()}`
      : 'Location saved for this group'
    : 'Location: not set — add one for outdoor weather hints'

  const weatherLine = weatherFetchError
    ? 'Weather layer: forecast unavailable (rhythm unchanged)'
    : forecastActive
      ? 'Weather adjustments: on for outdoor plants'
      : 'Weather adjustments: off (set location & load forecast)'

  return (
    <section className="group-dash-summary" aria-label="Group overview">
      <p className="group-dash-summary-kicker">Overview</p>
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
          <span className="group-dash-stat-label">need water now</span>
        </div>
        <div
          className={`group-dash-stat group-dash-stat--soon ${soon > 0 ? 'has-count' : ''}`}
          role="listitem"
        >
          <span className="group-dash-stat-value">{soon}</span>
          <span className="group-dash-stat-label">due soon</span>
        </div>
        <div
          className={`group-dash-stat group-dash-stat--ok ${onTrack > 0 ? 'has-count' : ''}`}
          role="listitem"
        >
          <span className="group-dash-stat-value">{onTrack}</span>
          <span className="group-dash-stat-label">okay for now</span>
        </div>
      </div>
      <ul className="group-dash-meta">
        <li className="group-dash-meta-line">{locLine}</li>
        <li className="group-dash-meta-line">{weatherLine}</li>
      </ul>
      {today === 0 && (
        <p className="group-dash-celebrate" role="status">
          {soon > 0
            ? 'Nothing needs water right this moment — you’re in good shape.'
            : 'All plants look comfortable for now — nice work staying ahead.'}
        </p>
      )}
    </section>
  )
}
