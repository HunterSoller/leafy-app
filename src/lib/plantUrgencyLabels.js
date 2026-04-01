import { effectiveDueDate, calendarDaysDifferenceNY } from './wateringLogic'

/** Minimal badge text for visual hierarchy (Now / Soon / Okay). */
export function getTierBadgeShort(smart) {
  if (!smart) return 'Okay'
  if (smart.tier === 'needs_water_today') return 'Now'
  if (smart.tier === 'due_soon') return 'Soon'
  return 'Okay'
}

/**
 * Short, scannable status for list cards (mobile / NFC open).
 * Uses existing smart status tiers — does not recompute watering logic.
 */
export function getScanFriendlyStatus(smart) {
  if (!smart) return 'Okay for now'
  const d = smart.daysUntil

  if (smart.tier === 'needs_water_today') {
    if (d != null && d < 0) {
      const o = -d
      return o === 1 ? 'Water today · 1 day behind' : `Water today · ${o} days behind`
    }
    return 'Water today'
  }

  if (smart.tier === 'due_soon') {
    if (d === 1) return 'Check tomorrow'
    if (d === 2) return 'Water within 2 days'
    if (d != null && d > 2) return `Due in ${d} days`
    return 'Due soon'
  }

  if (smart.tier === 'on_track') {
    if (d != null && d > 2) return `Okay for ${d} more days`
    if (d === 2) return 'Okay for 2 more days'
    if (d === 1) return 'Okay for about a day'
    return 'Okay for now'
  }

  return smart.headline || 'Okay for now'
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
    return 'Next watering: once scheduled'
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
    return 'Indoors — weather forecast doesn’t change this plant’s timing.'
  }
  if (weatherContext?.adjustmentsActive === true) return null
  return 'Outdoors — save a group location to layer weather-aware hints.'
}
