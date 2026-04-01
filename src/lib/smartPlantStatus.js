import { getWateringStatus, daysUntilDueCalendar } from './wateringLogic'

/**
 * @typedef {'needs_water_today' | 'due_soon' | 'on_track'} SmartTier
 */

/**
 * @returns {{
 *   tier: SmartTier,
 *   headline: string,
 *   subline: string | null,
 *   daysUntil: number | null,
 *   overdueDays: number,
 *   nextInDays: number | null,
 * }}
 */
export function getSmartPlantStatus(nextWaterDueRaw, outdoorDelayDays = 0) {
  const raw = nextWaterDueRaw?.toDate?.() ?? nextWaterDueRaw

  if (!raw) {
    return {
      tier: 'on_track',
      headline: 'All good for now',
      subline: 'Add a schedule by saving this plant',
      daysUntil: null,
      overdueDays: 0,
      nextInDays: null,
    }
  }

  const daysUntil = daysUntilDueCalendar(raw, outdoorDelayDays)
  const legacy = getWateringStatus(raw, outdoorDelayDays)

  if (legacy === 'overdue' || legacy === 'due_today') {
    const overdueDays = daysUntil !== null && daysUntil < 0 ? -daysUntil : 0
    return {
      tier: 'needs_water_today',
      headline: 'Water today',
      subline:
        overdueDays > 0 ? 'A bit overdue — still okay' : null,
      daysUntil,
      overdueDays,
      nextInDays: daysUntil,
    }
  }

  if (daysUntil !== null && daysUntil >= 1 && daysUntil <= 2) {
    const headline =
      daysUntil === 1 ? 'Water tomorrow' : 'Water in 2 days'
    return {
      tier: 'due_soon',
      headline,
      subline: null,
      daysUntil,
      overdueDays: 0,
      nextInDays: daysUntil,
    }
  }

  const headline =
    daysUntil !== null && daysUntil > 2
      ? `Water in ${daysUntil} days`
      : 'All good for now'

  return {
    tier: 'on_track',
    headline,
    subline: null,
    daysUntil,
    overdueDays: 0,
    nextInDays: daysUntil,
  }
}

/** Sort: urgent first, then soon, then calm */
export function getSortTierRank(tier) {
  if (tier === 'needs_water_today') return 0
  if (tier === 'due_soon') return 1
  return 2
}

/** Split an already-sorted list into today / soon / calm buckets (order preserved). */
export function groupPlantsByTodayFocus(sortedPlants, delayForPlant) {
  const today = []
  const soon = []
  const good = []

  for (const p of sortedPlants) {
    const delay = delayForPlant(p)
    const next = p.nextWaterDue?.toDate?.() ?? p.nextWaterDue
    const { tier } = getSmartPlantStatus(next, delay)
    if (tier === 'needs_water_today') today.push(p)
    else if (tier === 'due_soon') soon.push(p)
    else good.push(p)
  }
  return { today, soon, good }
}

/** One calm line for on-track plants — avoids cheesy tone. */
export function softPersonaLine(tier, nextInDays, plantId) {
  if (tier !== 'on_track') return null
  const id = plantId || ''
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % 2
  if (nextInDays != null && nextInDays > 2) {
    return h === 0 ? 'Still happy for now.' : 'No action needed yet.'
  }
  return 'No action needed yet.'
}

export function summarizeGroupSmart(plants, delayForPlant) {
  let today = 0
  let soon = 0
  let onTrack = 0

  for (const p of plants) {
    const delay = delayForPlant(p)
    const next = p.nextWaterDue?.toDate?.() ?? p.nextWaterDue
    if (!next) {
      onTrack += 1
      continue
    }
    const { tier } = getSmartPlantStatus(next, delay)
    if (tier === 'needs_water_today') today += 1
    else if (tier === 'due_soon') soon += 1
    else onTrack += 1
  }

  return { today, soon, onTrack, total: plants.length }
}
