/**
 * V1 indoor-only watering: next due = last watered + interval (calendar days, NY).
 * No weather, rain, or outdoor logic.
 */

import { addCalendarDaysNY, calendarDaysDifferenceNY } from './wateringLogic'

export function toJsDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === 'function') return v.toDate()
  return new Date(v)
}

/**
 * @param {Date|import('firebase/firestore').Timestamp|null|undefined} lastWateredAt
 * @param {number} wateringIntervalDays
 * @param {Date} [now]
 */
export function computeNextWaterDueDate(lastWateredAt, wateringIntervalDays, now = new Date()) {
  const last = toJsDate(lastWateredAt)
  if (!last) return null
  const interval = Math.max(1, Math.round(Number(wateringIntervalDays)) || 7)
  return addCalendarDaysNY(last, interval)
}

/**
 * @returns {{
 *   kind: 'never' | 'ok' | 'today' | 'overdue',
 *   primary: string,
 *   secondary: string | null,
 *   daysUntil: number | null,
 *   overdueDays: number,
 * }}
 */
export function getIndoorWateringStatus(plant, now = new Date()) {
  const interval = Math.max(1, Math.round(Number(plant?.wateringIntervalDays)) || 7)
  const last = toJsDate(plant?.lastWateredAt ?? plant?.lastWatered)

  if (!last) {
    return {
      kind: 'never',
      primary: 'Not watered yet',
      secondary: 'Log the first watering to start tracking.',
      daysUntil: null,
      overdueDays: 0,
    }
  }

  const next = addCalendarDaysNY(last, interval)
  const diff = calendarDaysDifferenceNY(now, next)

  if (diff > 0) {
    return {
      kind: 'ok',
      primary: 'All good',
      secondary:
        diff === 1 ? 'Next watering in 1 day' : `Next watering in ${diff} days`,
      daysUntil: diff,
      overdueDays: 0,
    }
  }

  if (diff === 0) {
    return {
      kind: 'today',
      primary: 'Needs water today',
      secondary: null,
      daysUntil: 0,
      overdueDays: 0,
    }
  }

  const overdue = -diff
  return {
    kind: 'overdue',
    primary: overdue === 1 ? 'Overdue by 1 day' : `Overdue by ${overdue} days`,
    secondary: null,
    daysUntil: diff,
    overdueDays: overdue,
  }
}

export function formatLastWateredHuman(lastWateredAt) {
  const last = toJsDate(lastWateredAt)
  if (!last) return 'Not watered yet'
  const d = calendarDaysDifferenceNY(last, new Date())
  if (d === 0) return 'Last watered today'
  if (d === 1) return 'Last watered yesterday'
  return `Last watered ${d} days ago`
}
