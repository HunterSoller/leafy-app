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
  const interval = Math.max(1, Math.round(Number(plant?.wateringIntervalDays)) || 7)
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

/**
 * Scannable CARE blocks from stored fields + optional careSummary fallback.
 */
export function getStructuredCare(plant) {
  const interval = Math.max(1, Math.round(Number(plant?.wateringIntervalDays)) || 7)

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
  waterBullets.push(`Usually every ~${interval} days`)

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
    lightLine,
    waterBullets,
    extraBullets: extra.slice(0, 2),
  }
}
