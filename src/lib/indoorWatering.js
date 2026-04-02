/**
 * V1 indoor-only watering: countdown from lastWateredAt + wateringIntervalDays.
 * Uses calendar days (NY) for daysSinceWatered; daysLeft = interval - daysSince.
 */

import { calendarDaysDifferenceNY } from './wateringLogic'

export function toJsDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === 'function') return v.toDate()
  return new Date(v)
}

function wateringIntervalFromPlant(plant) {
  const raw = Math.round(Number(plant?.wateringIntervalDays))
  if (Number.isFinite(raw) && raw >= 1) return Math.min(raw, 60)
  return 7
}

/**
 * Dynamic status for plant card.
 * @returns {{
 *   kind: 'never' | 'ok' | 'almost' | 'today' | 'overdue',
 *   title: string,
 *   subtitle: string | null,
 *   soilHelper: string,
 *   daysSinceWatered: number | null,
 *   daysLeft: number | null,
 * }}
 */
export function getIndoorWateringStatus(plant, now = new Date()) {
  const interval = wateringIntervalFromPlant(plant)
  const last = toJsDate(plant?.lastWateredAt ?? plant?.lastWatered)

  const soilHelper = 'Check soil before watering'

  if (!last) {
    return {
      kind: 'never',
      title: 'Not watered yet',
      subtitle: 'Log the first watering to start tracking.',
      soilHelper,
      daysSinceWatered: null,
      daysLeft: null,
    }
  }

  const daysSinceWatered = calendarDaysDifferenceNY(last, now)
  const daysLeft = interval - daysSinceWatered

  if (daysLeft >= 3) {
    return {
      kind: 'ok',
      title: 'All good',
      subtitle: `Water in ~${daysLeft} days`,
      soilHelper,
      daysSinceWatered,
      daysLeft,
    }
  }

  if (daysLeft === 2) {
    return {
      kind: 'ok',
      title: 'All good',
      subtitle: 'Water in ~2 days',
      soilHelper,
      daysSinceWatered,
      daysLeft,
    }
  }

  if (daysLeft === 1) {
    return {
      kind: 'almost',
      title: 'Almost time',
      subtitle: 'Water tomorrow',
      soilHelper,
      daysSinceWatered,
      daysLeft,
    }
  }

  if (daysLeft === 0) {
    return {
      kind: 'today',
      title: 'Needs water today',
      subtitle: 'Give it some water',
      soilHelper,
      daysSinceWatered,
      daysLeft,
    }
  }

  const overdueBy = -daysLeft
  return {
    kind: 'overdue',
    title: 'Overdue',
    subtitle: `Overdue by ${overdueBy} day${overdueBy === 1 ? '' : 's'}`,
    soilHelper,
    daysSinceWatered,
    daysLeft,
  }
}

export function formatLastWateredHuman(lastWateredAt, now = new Date()) {
  const last = toJsDate(lastWateredAt)
  if (!last) return 'Not watered yet'
  const d = calendarDaysDifferenceNY(last, now)
  if (d === 0) return 'Watered today'
  if (d === 1) return 'Watered yesterday'
  return `Watered ${d} days ago`
}

const DEFAULT_LIGHT = 'Bright, indirect light suits most indoor plants.'
const DEFAULT_WATER = 'Water when the top 1–2 inches of soil feel dry.'

function trimBullet(s, max = 160) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * Scannable CARE blocks from stored profile bullets; legacy docs use older fields.
 * @returns {{ lightBullets: string[], waterBullets: string[], extraBullets: string[] }}
 */
export function getStructuredCare(plant) {
  const range =
    typeof plant?.displayWaterRange === 'string' && plant.displayWaterRange.trim()
      ? plant.displayWaterRange.trim()
      : null

  const hasProfileArrays =
    (Array.isArray(plant?.careLightBullets) && plant.careLightBullets.length > 0) ||
    (Array.isArray(plant?.careWaterBullets) && plant.careWaterBullets.length > 0) ||
    (Array.isArray(plant?.careExtraBullets) && plant.careExtraBullets.length > 0)

  if (hasProfileArrays || range) {
    const lightBullets = []
    if (Array.isArray(plant?.careLightBullets)) {
      for (const s of plant.careLightBullets) {
        const t = trimBullet(s)
        if (t) lightBullets.push(t)
      }
    }
    if (!lightBullets.length && typeof plant?.careLightLine === 'string' && plant.careLightLine.trim()) {
      lightBullets.push(trimBullet(plant.careLightLine))
    }
    if (!lightBullets.length) lightBullets.push(DEFAULT_LIGHT)

    const waterBullets = []
    if (Array.isArray(plant?.careWaterBullets)) {
      for (const s of plant.careWaterBullets) {
        const t = trimBullet(s)
        if (t) waterBullets.push(t)
      }
    }
    if (!waterBullets.length) {
      const how = String(plant?.howToWaterText || '').trim()
      const amt = String(plant?.waterAmountText || '').trim()
      waterBullets.push(trimBullet(how || amt || DEFAULT_WATER))
    }
    if (range) {
      waterBullets.push(`Usually every ${range}`)
    } else {
      const iv = wateringIntervalFromPlant(plant)
      waterBullets.push(`Usually every ~${iv} days`)
    }

    const extraBullets = []
    if (Array.isArray(plant?.careExtraBullets)) {
      for (const s of plant.careExtraBullets) {
        const t = trimBullet(s)
        if (t) extraBullets.push(t)
      }
    }
    const warn = String(plant?.warningSignsText || '').trim()
    if (extraBullets.length < 2 && warn) extraBullets.push(trimBullet(warn))
    const sched = String(plant?.careScheduleNote || '').trim()
    if (extraBullets.length < 2 && sched) {
      const short = trimBullet(sched)
      if (!extraBullets.length || !extraBullets[0].includes(short.slice(0, 28))) {
        extraBullets.push(short)
      }
    }

    return {
      lightBullets,
      waterBullets,
      extraBullets: extraBullets.slice(0, 2),
    }
  }

  /* Legacy documents (pre-profile) */
  let lightLine =
    typeof plant?.careLightLine === 'string' && plant.careLightLine.trim()
      ? plant.careLightLine.trim().slice(0, 140)
      : null

  const careBlob = String(plant?.careSummary || '').trim()
  if (!lightLine && careBlob) {
    const sentences = careBlob
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    lightLine =
      sentences
        .find((s) => /light|sun|window|bright|indirect|shade|low light/i.test(s))
        ?.slice(0, 140) ?? null
  }
  if (!lightLine) lightLine = DEFAULT_LIGHT

  const how = String(plant?.howToWaterText || '').trim()
  const amt = String(plant?.waterAmountText || '').trim()
  const waterBullets = []
  waterBullets.push((how || amt || DEFAULT_WATER).replace(/\s+/g, ' ').slice(0, 160))
  const iv = wateringIntervalFromPlant(plant)
  waterBullets.push(`Usually every ~${iv} days`)

  const extra = []
  const warn = String(plant?.warningSignsText || '').trim()
  if (warn) extra.push(warn.replace(/\s+/g, ' ').slice(0, 160))

  const sched = String(plant?.careScheduleNote || '').trim()
  if (sched && extra.length < 2) {
    const short = sched.replace(/\s+/g, ' ').slice(0, 160)
    const dup =
      lightLine.length > 20 &&
      (short.startsWith(lightLine.slice(0, 20)) || lightLine.startsWith(short.slice(0, 20)))
    if (!dup && (!extra.length || !extra[0].includes(short.slice(0, 30)))) {
      extra.push(short)
    }
  }

  if (extra.length < 2 && careBlob) {
    const sentences = careBlob
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const s of sentences) {
      if (extra.length >= 2) break
      if (/light|sun|window|bright|indirect|shade/i.test(s)) continue
      if (extra.some((e) => e.slice(0, 28) === s.slice(0, 28))) continue
      extra.push(s.slice(0, 160))
    }
  }

  return {
    lightBullets: [lightLine],
    waterBullets,
    extraBullets: extra.slice(0, 2),
  }
}
