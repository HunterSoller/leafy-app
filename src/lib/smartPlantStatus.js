import { getWateringStatus, daysUntilDueCalendar } from './wateringLogic'
import {
  getSmartHydrationStatus,
  formatManualWaterSummary,
  formatWeatherAdjustmentSummary,
} from './hydrationModel'

/**
 * @typedef {'needs_water_today' | 'due_soon' | 'on_track'} SmartTier
 */

/**
 * @param {object} [options]
 * @param {{ location?: string } | null} [options.plant]
 * @param {'none' | 'light' | 'moderate' | 'heavy'} [options.rainTier='none']
 * @param {number} [options.liveHydrationScore]
 * @param {number} [options.liveWaterLevel] legacy alias for liveHydrationScore
 * @param {object} [options.balanceMeta]
 * @param {object} [options.weatherContext]
 */
export function getSmartPlantStatus(
  nextWaterDueRaw,
  outdoorDelayDays = 0,
  options = {},
) {
  const {
    plant = null,
    rainTier = 'none',
    liveHydrationScore,
    liveWaterLevel,
    balanceMeta = null,
    weatherContext = null,
  } = options

  const hydrationLive =
    typeof liveHydrationScore === 'number'
      ? liveHydrationScore
      : typeof liveWaterLevel === 'number'
        ? liveWaterLevel
        : null

  if (hydrationLive != null) {
    return getSmartHydrationStatus(hydrationLive, plant, {
      weather: weatherContext ?? {},
      adjustmentsActive: weatherContext?.adjustmentsActive === true,
      nextWaterDue: balanceMeta?.nextWaterDue,
      rainJustCredited: balanceMeta?.rainJustCredited,
      lastRainAmountMm: balanceMeta?.lastRainAmount,
    })
  }

  const raw = nextWaterDueRaw?.toDate?.() ?? nextWaterDueRaw

  if (!raw) {
    return {
      tier: 'on_track',
      headline: 'All good for now',
      reasonLine: 'Add a schedule by saving this plant.',
      checkSoilHint: null,
      subline: 'Add a schedule by saving this plant.',
      daysUntil: null,
      overdueDays: 0,
      nextInDays: null,
      rainChipLabel: null,
      manualWaterLine: formatManualWaterSummary(plant),
      weatherAdjustmentLine: formatWeatherAdjustmentSummary(plant, {
        adjustmentsActive: weatherContext?.adjustmentsActive === true,
        weather: weatherContext,
      }),
    }
  }

  const daysUntil = daysUntilDueCalendar(raw, outdoorDelayDays)
  const daysNoShift =
    plant?.location === 'outdoor'
      ? daysUntilDueCalendar(raw, 0)
      : daysUntil

  const legacy = getWateringStatus(raw, outdoorDelayDays)

  const isOutdoor = plant?.location === 'outdoor'
  const forecastOn = weatherContext?.adjustmentsActive === true
  const meaningfulRain =
    forecastOn &&
    isOutdoor &&
    (rainTier === 'moderate' || rainTier === 'heavy')

  /** Would have been due or overdue without weather shift; rain eased the calendar. */
  const rainEasedSchedule =
    meaningfulRain &&
    daysNoShift != null &&
    daysUntil != null &&
    daysNoShift <= 0 &&
    daysUntil >= 1

  const rainPartial =
    meaningfulRain &&
    rainTier === 'moderate' &&
    daysNoShift != null &&
    daysUntil != null &&
    daysNoShift >= 1 &&
    daysUntil > daysNoShift

  let tier
  let headline
  let subline = null
  let overdueDays = 0
  let rainChipLabel = null

  const applyRainEasedCopy = () => {
    if (!rainEasedSchedule) return
    const again = `Check again in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
    if (rainTier === 'heavy') {
      headline = again
      subline = 'Heavy rain helped recently.'
      rainChipLabel = '🌧️ Rain helped'
    } else {
      headline = again
      subline = 'Rain gave the soil a boost.'
      rainChipLabel = '🌧️ Rain helped'
    }
  }

  if (legacy === 'overdue' || legacy === 'due_today') {
    tier = 'needs_water_today'
    overdueDays = daysUntil !== null && daysUntil < 0 ? -daysUntil : 0

    if (overdueDays > 0) {
      headline = 'Needs water today'
      subline = 'Running a bit behind — check the soil.'
    } else {
      headline = 'Needs water today'
      subline = isOutdoor
        ? 'Warm weather may have dried the soil faster.'
        : 'Time for a check and a drink if it’s dry.'
    }
  } else if (daysUntil !== null && daysUntil >= 1 && daysUntil <= 2) {
    tier = 'due_soon'
    applyRainEasedCopy()
    if (!rainEasedSchedule) {
      headline =
        daysUntil === 1 ? 'Water tomorrow' : 'Check again in 2 days'
      subline = rainPartial
        ? 'Rain helped — you still have a little time.'
        : daysUntil === 1
          ? 'Still holding some moisture.'
          : 'Peek at the soil before the weekend.'
      if (rainPartial) rainChipLabel = '🌧️ Rain helped'
    }
  } else {
    tier = 'on_track'
    headline =
      daysUntil !== null && daysUntil > 2
        ? `Check again in ${daysUntil} days`
        : 'All good for now'

    if (rainEasedSchedule) {
      applyRainEasedCopy()
    } else {
      subline = rainPartial
        ? 'Rain helped — you have time before the next water.'
        : daysUntil != null && daysUntil > 2
          ? 'Rhythm looks steady for now.'
          : 'Still holding moisture.'
      if (rainPartial) rainChipLabel = '🌧️ Rain helped'
    }
  }

  const reasonLine = subline
  return {
    tier,
    headline,
    reasonLine,
    checkSoilHint: null,
    subline,
    daysUntil,
    overdueDays,
    nextInDays: daysUntil,
    rainChipLabel,
    manualWaterLine: formatManualWaterSummary(plant),
    weatherAdjustmentLine: formatWeatherAdjustmentSummary(plant, {
      adjustmentsActive: forecastOn,
      weather: weatherContext,
    }),
  }
}

/** Sort: urgent first, then soon, then calm */
export function getSortTierRank(tier) {
  if (tier === 'needs_water_today') return 0
  if (tier === 'due_soon') return 1
  return 2
}

/**
 * @param {((plant: object) => object) | undefined} weatherOptionsForPlant
 *        Return value merged into getSmartPlantStatus options (e.g. rainTier).
 */
export function groupPlantsByTodayFocus(
  sortedPlants,
  delayForPlant,
  weatherOptionsForPlant,
) {
  const optFn =
    typeof weatherOptionsForPlant === 'function'
      ? weatherOptionsForPlant
      : () => ({})

  const today = []
  const soon = []
  const good = []

  for (const p of sortedPlants) {
    const delay = delayForPlant(p)
    const next = p.nextWaterDue?.toDate?.() ?? p.nextWaterDue
    const { tier } = getSmartPlantStatus(next, delay, optFn(p))
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

export function summarizeGroupSmart(
  plants,
  delayForPlant,
  weatherOptionsForPlant,
) {
  const optFn =
    typeof weatherOptionsForPlant === 'function'
      ? weatherOptionsForPlant
      : () => ({})

  let today = 0
  let soon = 0
  let onTrack = 0

  for (const p of plants) {
    const delay = delayForPlant(p)
    const next = p.nextWaterDue?.toDate?.() ?? p.nextWaterDue
    const { tier } = getSmartPlantStatus(next, delay, optFn(p))
    if (tier === 'needs_water_today') today += 1
    else if (tier === 'due_soon') soon += 1
    else onTrack += 1
  }

  return { today, soon, onTrack, total: plants.length }
}
