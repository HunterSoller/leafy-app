/**
 * Leafy hydration model — single place for outdoor vs indoor, rain, heat, containers.
 * Indoor: never uses rain or outdoor weather for drying boosts.
 * Outdoor: rain credit, heat/humidity multipliers, container vs in-ground shaping.
 */

import { addCalendarDaysNY, calendarDaysDifferenceNY } from './wateringLogic'
import { getPlantIntervalDays } from './plantCareRules'

const CLAMP = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

/** Read stored score; supports legacy waterLevel. */
export function readHydrationScore(plant) {
  if (plant?.hydrationScore != null && !Number.isNaN(Number(plant.hydrationScore))) {
    return Number(plant.hydrationScore)
  }
  if (plant?.waterLevel != null && !Number.isNaN(Number(plant.waterLevel))) {
    return Number(plant.waterLevel)
  }
  return null
}

export function toJsDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === 'function') return v.toDate()
  return new Date(v)
}

function readHydrationAnchor(plant) {
  return (
    toJsDate(plant.hydrationCalculatedAt) ??
    toJsDate(plant.waterBalanceUpdatedAt) ??
    null
  )
}

/** Outdoor + potted (has container size) — not a broad garden/area card. */
export function isOutdoorContainerPlant(plant) {
  if (plant?.location !== 'outdoor') return false
  if (plant.matchKind === 'area' || plant.careMatchQuality === 'area') {
    return false
  }
  if (
    plant.sceneType === 'garden_area' ||
    plant.sceneType === 'multiple_plants'
  ) {
    return false
  }
  const ps = plant.potSize != null ? String(plant.potSize).trim() : ''
  return ps.length > 0
}

/** In-ground, bed, or generalized outdoor space — deeper rain benefit. */
export function isOutdoorInGroundOrBed(plant) {
  if (plant?.location !== 'outdoor') return false
  return !isOutdoorContainerPlant(plant)
}

export function pickHeatTempF(weather) {
  if (!weather) return 72
  const a = weather.tempFMax
  const b = weather.tempFCurrent
  if (a != null && b != null) return Math.max(a, b)
  return a ?? b ?? 72
}

/** Outdoor-only drying multiplier (heat speeds loss, humidity slows). */
export function outdoorDryingMultiplier(weather) {
  if (!weather) return 1
  let m = 1
  const t = pickHeatTempF(weather)
  if (t > 95) m *= 1.48
  else if (t > 85) m *= 1.26

  const rh = weather.humidityPct
  if (rh != null && !Number.isNaN(rh)) {
    if (rh >= 78) m *= 0.78
    else if (rh >= 65) m *= 0.9
  }
  return m
}

/** @deprecated use outdoorDryingMultiplier */
export const dryingMultiplierOutdoor = outdoorDryingMultiplier

/** Potted outdoor dries faster than open soil. */
export function outdoorContainerDecayBoost(plant) {
  return isOutdoorContainerPlant(plant) ? 1.18 : 1
}

/**
 * How much of incremental rain mm counts toward hydration (container gets partial credit).
 */
export function effectiveRainDeltaMm(deltaMm, plant) {
  if (!plant || plant.location !== 'outdoor') return 0
  let mult = 1
  if (isOutdoorContainerPlant(plant)) mult *= 0.72
  if (isOutdoorInGroundOrBed(plant)) mult *= 1.08
  mult = CLAMP(mult, 0.55, 1.12)
  return deltaMm * mult
}

/** ~100 points lost over one full interval at baseline. */
export function baseDrainPerDay(intervalDays) {
  return 100 / Math.max(1, intervalDays)
}

/**
 * Rain contribution from incremental mm (48h stack, already net of snapshot).
 * Bands: &lt;2 ignore; 2–8 moderate; 8–15 strong; &gt;15 Very strong → near full.
 */
export function hydrationBoostFromRainDelta(rawLevel, deltaMm) {
  /** Trace / drizzle: minimal credit; soaking: strong credit (layer on top of manual watering). */
  if (deltaMm < 1) {
    return { newLevel: rawLevel, pointsAdded: 0, creditedDelta: 0 }
  }
  if (deltaMm >= 22) {
    const pts = 100 - rawLevel
    return { newLevel: 100, pointsAdded: Math.max(0, pts), creditedDelta: deltaMm }
  }

  let add = 0
  if (deltaMm <= 3) {
    add = 5 + ((deltaMm - 1) / 2) * 10
  } else if (deltaMm <= 8) {
    add = 15 + ((deltaMm - 3) / 5) * 20
  } else if (deltaMm <= 15) {
    add = 35 + ((deltaMm - 8) / 7) * 28
  } else {
    add = 63 + ((deltaMm - 15) / 7) * 27
  }
  const newLevel = CLAMP(rawLevel + add, 0, 100)
  return {
    newLevel,
    pointsAdded: newLevel - rawLevel,
    creditedDelta: deltaMm,
  }
}

export function estimateLegacyHydration(plant, weather, now) {
  const interval = Math.max(1, getPlantIntervalDays(plant))
  const base = baseDrainPerDay(interval)
  const last = toJsDate(plant.lastWatered)
  const isOutdoor = plant.location === 'outdoor'

  if (last) {
    const days = Math.max(0, (now - last) / 86400000)
    let env = 1
    if (isOutdoor) {
      env =
        outdoorDryingMultiplier(weather) * outdoorContainerDecayBoost(plant)
    }
    return CLAMP(100 - days * base * env, 0, 100)
  }

  const next = toJsDate(plant.nextWaterDue)
  if (next && readHydrationScore(plant) == null) {
    const d = calendarDaysDifferenceNY(now, next)
    if (d < 0) return CLAMP(70 - d * (base * 0.6), 0, 100)
    return CLAMP(55 - d * (base * 0.5), 0, 100)
  }

  return 70
}

export function nextWaterDueFromHydration(
  level,
  intervalDays,
  plant,
  weather,
  now,
) {
  const base = baseDrainPerDay(intervalDays)
  let env = 1
  if (plant.location === 'outdoor') {
    env =
      outdoorDryingMultiplier(weather) * outdoorContainerDecayBoost(plant)
  }
  const drain = base * env
  if (drain < 0.05) return addCalendarDaysNY(now, Math.max(1, intervalDays))
  const target = 42
  if (level <= target) return now
  const days = (level - target) / drain
  return addCalendarDaysNY(now, Math.min(21, Math.max(0, Math.ceil(days))))
}

/**
 * @param {object} weatherContext — same shape as useWeather().weatherContext
 */
export function computeSyncedHydration(plant, weatherContext, now = new Date()) {
  const interval = Math.max(1, getPlantIntervalDays(plant))
  const isOutdoor = plant.location === 'outdoor'
  const adjustmentsActive = weatherContext?.adjustmentsActive === true
  const weather = isOutdoor && adjustmentsActive ? weatherContext : null

  let level =
    readHydrationScore(plant) ?? estimateLegacyHydration(plant, weather, now)

  const anchor =
    readHydrationAnchor(plant) ??
    toJsDate(plant.lastWatered) ??
    toJsDate(plant.createdAt) ??
    now

  let elapsedDays = (now - anchor) / 86400000
  if (elapsedDays < 0) elapsedDays = 0
  if (elapsedDays > 10) elapsedDays = 10

  const base = baseDrainPerDay(interval)
  let env = 1
  if (isOutdoor) {
    env =
      (adjustmentsActive && weather ? outdoorDryingMultiplier(weather) : 1) *
      outdoorContainerDecayBoost(plant)
  }
  const decay = base * env * elapsedDays
  level = CLAMP(level - decay, 0, 100)

  let rainContribution = plant.rainContribution ?? 0
  let lastRainAmount = plant.lastRainAmount ?? 0
  let lastRainAt = toJsDate(plant.lastRainAt)
  const mm = weatherContext?.mmCombined48h ?? 0
  let snap =
    typeof plant.rainMmBalanceSnapshot === 'number'
      ? plant.rainMmBalanceSnapshot
      : 0

  let rainJustCredited = false
  if (isOutdoor && adjustmentsActive && weatherContext) {
    if (mm + 0.001 < snap) {
      snap = mm
    } else {
      const delta = mm - snap
      if (delta >= 1) {
        const adj = effectiveRainDeltaMm(delta, plant)
        if (adj >= 1) {
          const { newLevel, pointsAdded, creditedDelta } =
            hydrationBoostFromRainDelta(level, adj)
          level = newLevel
          if (pointsAdded > 0) {
            rainContribution = pointsAdded
            lastRainAmount = creditedDelta
            lastRainAt = now
            rainJustCredited = true
          }
        }
        snap = mm
      }
    }
  }

  level = CLAMP(Math.round(level * 10) / 10, 0, 100)

  const nextWaterDue = nextWaterDueFromHydration(
    level,
    interval,
    plant,
    weather,
    now,
  )

  const weatherAdjustmentNote = buildWeatherAdjustmentNote(
    plant,
    level,
    adjustmentsActive ? weatherContext : null,
    { rainJustCredited, lastRainAmount },
  )

  return {
    hydrationScore: level,
    /** @deprecated mirror for older docs / transitions */
    waterLevel: level,
    rainMmBalanceSnapshot: snap,
    rainContribution,
    lastRainAmount,
    lastRainAt,
    rainJustCredited,
    hydrationCalculatedAt: now,
    /** @deprecated mirror */
    waterBalanceUpdatedAt: now,
    nextWaterDue,
    weatherAdjustmentNote,
  }
}

export function buildWeatherAdjustmentNote(plant, level, weather, hint = {}) {
  const outdoor = plant?.location === 'outdoor'
  if (!outdoor || !weather) return null

  if (hint.rainJustCredited && hint.lastRainAmount >= 12) {
    return 'Heavy rain helped recently'
  }
  if (hint.rainJustCredited) {
    return 'Some rain gave the soil a boost'
  }

  const t = pickHeatTempF(weather)
  if (t > 95 && level < 55) return 'Very hot spell — drying faster than usual'
  if (t > 85 && level < 62) return 'Warm stretch — soil may be drier'

  const mm = weather?.mmCombined48h ?? 0
  if (mm >= 12 && level >= 68) return 'Rain covered this for now'

  return null
}

/** Plain-language: only manual taps, not rain. */
export function formatManualWaterSummary(plant) {
  if (!plant?.lastWatered) {
    return 'Not manually watered yet — tap “Watered it” after you water.'
  }
  const last = toJsDate(plant.lastWatered)
  if (!last) {
    return 'Not manually watered yet — tap “Watered it” after you water.'
  }
  const days = calendarDaysDifferenceNY(last, new Date())
  if (days === 0) return 'Last manually watered today.'
  if (days === 1) return 'Last manually watered yesterday.'
  return `Last manually watered ${days} days ago.`
}

/**
 * Weather/rain layer only — never implies rain replaced a manual watering.
 * @param {object} ctx — same option bag as getSmartHydrationStatus (weather, adjustmentsActive, …)
 */
export function formatWeatherAdjustmentSummary(plant, ctx = {}) {
  const isOutdoor = plant?.location === 'outdoor'
  if (!isOutdoor) {
    return 'This plant is indoors — outdoor rain and forecast aren’t applied.'
  }
  if (!ctx.adjustmentsActive) {
    return null
  }
  const w = ctx.weather || {}
  const mm = Number(w.mmCombined48h) || 0
  const tm =
    w.mmForecastTomorrow != null ? Number(w.mmForecastTomorrow) : null
  const tempF = pickHeatTempF(w)
  const hot = tempF > 88
  const warm = tempF > 82

  const parts = []

  if (mm < 0.5) {
    parts.push(
      'Little to no rain recorded nearby — need still follows your last manual watering.',
    )
  } else if (mm < 2) {
    parts.push(
      'Only very light rain (or drizzle) — little watering credit; soil may still be dry below the surface.',
    )
  } else if (mm < 6) {
    parts.push(
      'Light rain gave a small boost — not the same as a deep soak you’d give by hand.',
    )
  } else if (mm < 14) {
    parts.push(
      'Moderate rain recently — that partly reduces how soon you’ll need to water.',
    )
  } else {
    parts.push(
      'Heavy rain recently — that strongly reduces how soon this likely needs water.',
    )
  }

  if (tm != null && tm >= 6 && mm < 8) {
    parts.push('Rain is expected soon — worth checking the soil again tomorrow.')
  } else if (tm != null && tm >= 3 && tm < 6 && mm < 4) {
    parts.push('A little rain may arrive soon — it might ease urgency slightly.')
  }

  if (hot && mm < 4) {
    parts.push('Hot weather dries outdoor soil faster than usual.')
  } else if (warm && mm < 2) {
    parts.push('Warm, mostly dry weather — moisture may not last as long.')
  }

  return parts.join(' ')
}

export function hydrationNeedsPersist(plant, computed) {
  const prev = readHydrationScore(plant)
  const next = computed.hydrationScore

  if (
    prev == null &&
    plant.hydrationCalculatedAt == null &&
    plant.waterBalanceUpdatedAt == null
  ) {
    return true
  }
  if (prev != null && Math.abs(prev - next) >= 0.65) return true
  if (Math.abs((plant.rainMmBalanceSnapshot ?? 0) - computed.rainMmBalanceSnapshot) > 0.05) {
    return true
  }
  const prevU =
    plant.hydrationCalculatedAt?.toMillis?.() ??
    plant.waterBalanceUpdatedAt?.toMillis?.() ??
    0
  if (Date.now() - prevU > 4 * 3600 * 1000) return true
  if (computed.rainJustCredited) return true
  return false
}

export function initialHydrationForNewPlant({
  lastWateredDate,
  intervalDays,
  location,
  weather,
  outdoorContainer = false,
  now = new Date(),
}) {
  const interval = Math.max(1, intervalDays ?? 7)
  if (!lastWateredDate) return 100

  const days = Math.max(0, (now - lastWateredDate) / 86400000)
  const base = baseDrainPerDay(interval)
  if (location !== 'outdoor') {
    return CLAMP(100 - days * base, 0, 100)
  }
  const env =
    outdoorDryingMultiplier(weather) *
    (outdoorContainer ? 1.18 : 1)
  return CLAMP(100 - days * base * env, 0, 100)
}

/** Natural rhythm line — no raw numbers shown on card for hydration. */
export function hydrationRhythmPhrase(intervalDays) {
  const d = Math.max(1, Math.round(intervalDays))
  if (d <= 3) return 'Usually every couple of days'
  if (d <= 5) return 'Usually every few days'
  if (d <= 7) return 'Usually about once a week'
  if (d <= 10) return 'Usually about every week and a half'
  return `Usually every ${d} days or so`
}

/**
 * Status bands: ≥65 calm; 40–64 check soon; 20–39 needs water; &lt;20 dry now.
 * headline = decisive instruction; reasonLine = schedule/nuance (manual + weather split in UI).
 * ctx.adjustmentsActive === true only when this group has saved coords + successful forecast fetch.
 */
export function getSmartHydrationStatus(score, plant, ctx = {}) {
  const isOutdoor = plant?.location === 'outdoor'
  const adjustmentsActive = ctx.adjustmentsActive === true
  const w = adjustmentsActive && ctx.weather ? ctx.weather : null
  const container = isOutdoor && isOutdoorContainerPlant(plant)

  const daysSince =
    plant?.lastWatered != null
      ? calendarDaysDifferenceNY(
          toJsDate(plant.lastWatered) ?? new Date(),
          new Date(),
        )
      : null

  const tempF = pickHeatTempF(w || ctx.weather || {})
  const hotDay = isOutdoor && adjustmentsActive && tempF > 85
  const veryHot = isOutdoor && adjustmentsActive && tempF > 95
  const interval = Math.max(1, getPlantIntervalDays(plant))
  const mm48 = w?.mmCombined48h ?? 0
  const rainHelpedVisual =
    adjustmentsActive &&
    isOutdoor &&
    mm48 >= 8 &&
    score >= 62 &&
    (ctx.rainJustCredited || mm48 >= 10)

  const nextD = ctx.nextWaterDue
  const daysUntil =
    nextD instanceof Date && !Number.isNaN(nextD.getTime())
      ? calendarDaysDifferenceNY(new Date(), nextD)
      : null

  let tier
  let headline
  let reasonLine
  let checkSoilHint = null
  let rainChipLabel = null

  const estCalmDays = Math.max(
    1,
    Math.min(7, Math.floor((score - 45) / (100 / interval))),
  )

  function buildReasonUrgent() {
    if (isOutdoor && adjustmentsActive && veryHot) {
      return 'Hot weather is pulling moisture faster than usual.'
    }
    if (isOutdoor && adjustmentsActive && hotDay) {
      return 'Warm, dry air sped up drying outdoors.'
    }
    if (isOutdoor && adjustmentsActive && mm48 < 2 && hotDay) {
      return 'Mostly dry and warm — worth checking the soil even if it sprinkled.'
    }
    if (isOutdoor && !adjustmentsActive) {
      return 'Based on your last manual watering and usual rhythm — no forecast layer for this group.'
    }
    if (!isOutdoor) {
      return 'Indoor soil may be ready if the top feels dry — your manual log drives timing.'
    }
    return 'Check the soil depth — water thoroughly if it’s dry below the surface.'
  }

  function buildReasonSoon() {
    if (isOutdoor && adjustmentsActive && mm48 >= 12) {
      return 'Heavy rain nearby recently eased how thirsty this feels (on top of your manual log).'
    }
    if (isOutdoor && adjustmentsActive && mm48 >= 6) {
      return 'Meaningful rain lately is still helping — you may have a bit more time.'
    }
    if (isOutdoor && adjustmentsActive && veryHot) {
      return 'Heat trims the cushion rain gave — still peek at the soil soon.'
    }
    if (isOutdoor && adjustmentsActive && hotDay) {
      return 'Warm stretch — moisture may not last as long as usual.'
    }
    if (isOutdoor && adjustmentsActive && mm48 < 2 && hotDay) {
      return 'Dry spell plus heat — outdoor pots especially can dry fast.'
    }
    if (isOutdoor && !adjustmentsActive) {
      return 'Next step follows your timing from the last manual watering.'
    }
    if (container) return 'Pots dry out faster than open soil.'
    if (!isOutdoor && daysSince != null && daysSince >= 4) {
      return 'It’s been several days since a manual watering — worth a look.'
    }
    return 'Still holding some moisture — worth a quick soil check.'
  }

  function buildReasonCalmRain() {
    if (mm48 >= 15 || (ctx.lastRainAmountMm ?? 0) >= 10) {
      return 'Soaking rain helped — this is weather support, not a manual watering.'
    }
    if (container) {
      return 'Rain helped overall — containers still dry faster than ground beds.'
    }
    return 'Moisture looks comfortable for now given rain and your last manual watering.'
  }

  if (score < 20) {
    tier = 'needs_water_today'
    headline = 'Dry — water now'
    reasonLine = buildReasonUrgent()
  } else if (score < 40) {
    tier = 'needs_water_today'
    headline = 'Needs water today'
    reasonLine = buildReasonUrgent()
  } else if (score < 65) {
    tier = 'due_soon'
    if (daysUntil === 1) headline = 'Water tomorrow'
    else if (daysUntil === 2) headline = 'Check again in 2 days'
    else if (daysUntil != null && daysUntil >= 3)
      headline = `Check again in ${daysUntil} days`
    else headline = 'Check soon'
    reasonLine = buildReasonSoon()
    checkSoilHint = 'If the soil still feels damp, wait a day.'
  } else {
    tier = 'on_track'
    if (
      adjustmentsActive &&
      (ctx.rainJustCredited ||
        rainHelpedVisual ||
        (isOutdoor && score >= 70 && mm48 >= 8))
    ) {
      headline = 'Rain covered this for now'
      reasonLine = buildReasonCalmRain()
      rainChipLabel = '🌧️ Rain helped'
    } else {
      headline = 'All good for now'
      if (daysSince != null && daysSince <= 1) {
        reasonLine = 'You manually watered recently — rhythm looks good.'
      } else {
        reasonLine = `Still holding moisture — check again in about ${estCalmDays} days.`
      }
    }
  }

  const manualWaterLine = formatManualWaterSummary(plant)
  const weatherAdjustmentLine = formatWeatherAdjustmentSummary(plant, {
    adjustmentsActive,
    weather: ctx.weather,
  })

  return {
    tier,
    headline,
    reasonLine,
    checkSoilHint,
    subline: reasonLine,
    daysUntil,
    overdueDays: score < 40 ? Math.max(0, 40 - Math.round(score)) : 0,
    nextInDays: daysUntil,
    rainChipLabel,
    manualWaterLine,
    weatherAdjustmentLine,
  }
}
