import { calendarDaysDifferenceNY } from './wateringLogic'

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  return new Date(value)
}

/**
 * Human-friendly “last watered” copy (NY calendar days).
 */
export function formatTimeAgo(lastWateredAt) {
  if (!lastWateredAt) return 'Not watered yet'
  const last = toDate(lastWateredAt)
  if (!last || Number.isNaN(last.getTime())) return 'Not watered yet'

  const daysSince = calendarDaysDifferenceNY(last, new Date())
  if (daysSince === 0) return 'Watered today'
  if (daysSince === 1) return 'Watered yesterday'
  return `Watered ${daysSince} days ago`
}
