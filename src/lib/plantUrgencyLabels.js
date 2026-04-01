import { effectiveDueDate, calendarDaysDifferenceNY } from './wateringLogic'

/** Minimal badge text for visual hierarchy (Now / Soon / Okay). */
export function getTierBadgeShort(smart) {
  if (!smart) return 'Good'
  if (smart.tier === 'needs_water_today') return 'Due'
  if (smart.tier === 'due_soon') return 'Soon'
  return 'Good'
}

/**
 * Short, scannable status for list cards (mobile / NFC open).
 * Uses existing smart status tiers — does not recompute watering logic.
 */
export function getScanFriendlyStatus(smart) {
  if (!smart) return 'All good for now'
  const d = smart.daysUntil

  if (smart.tier === 'needs_water_today') {
    if (d != null && d < 0) {
      const o = -d
      return o === 1
        ? 'Needs water · about a day overdue'
        : `Needs water · about ${o} days overdue`
    }
    return 'Needs water today'
  }

  if (smart.tier === 'due_soon') {
    if (d === 1) return 'Check tomorrow'
    if (d === 2) return 'Within about 2 days'
    if (d != null && d > 2) return `Due in about ${d} days`
    return 'Coming up'
  }

  if (smart.tier === 'on_track') {
    if (d != null && d > 2) return `Comfortable for ~${d} more days`
    if (d === 2) return 'Comfortable for a couple of days'
    if (d === 1) return 'Comfortable for about a day'
    return 'All good for now'
  }

  return smart.headline || 'All good for now'
}

/**
 * One line for effective next watering (respects outdoor delay from weather).
 */
export function formatNextDueSummary(nextRaw, outdoorDelayDays) {
  const eff = effectiveDueDate(
    nextRaw?.toDate?.() ?? nextRaw,
    outdoorDelayDays ?? 0,
  )
  if (!eff || Number.isNaN(eff.getTime())) {
    return 'Next water: we’ll suggest one as you use Leafy'
  }
  const diff = calendarDaysDifferenceNY(new Date(), eff)
  if (diff < 0) {
    const o = -diff
    return o === 1 ? 'Due date was yesterday' : `${o} days past suggested date`
  }
  if (diff === 0) return 'Next: today'
  if (diff === 1) return 'Next: tomorrow'
  if (diff <= 6) {
    const short = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(eff)
    return `Next: ${short}`
  }
  return `Next: in ${diff} days`
}

/**
 * Plain indoor/outdoor note — avoids duplicating outdoor copy when forecast is already active.
 */
export function getTimingContextNote(plant, weatherContext) {
  if (!plant) return null
  if (plant.location === 'indoor') {
    return 'Indoor — weather won’t move this plant’s dates; only your care rhythm does.'
  }
  if (weatherContext?.adjustmentsActive === true) return null
  return 'Outdoor — add a location for this space if you’d like rain-aware timing.'
}
