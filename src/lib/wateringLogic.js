const NY = 'America/New_York'

export function dateKeyNY(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NY,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d instanceof Date ? d : new Date(d))
}

function parseDateKey(key) {
  const [y, m, day] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}

export function calendarDaysDifferenceNY(fromDate, toDate) {
  const a = parseDateKey(dateKeyNY(fromDate))
  const b = parseDateKey(dateKeyNY(toDate))
  return Math.round((b - a) / 86400000)
}

export function addCalendarDaysNY(baseDate, daysToAdd) {
  const key = dateKeyNY(baseDate)
  const [y, m, day] = key.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, day)
  const next = new Date(utc + daysToAdd * 86400000)
  return next
}

/**
 * @param {Date} nextWaterDue - stored due date
 * @param {number} outdoorDelayDays - 0, 1, or 2 from weather (outdoor only)
 */
export function effectiveDueDate(nextWaterDue, outdoorDelayDays) {
  if (!nextWaterDue) return null
  const d = nextWaterDue instanceof Date ? nextWaterDue : new Date(nextWaterDue)
  if (!outdoorDelayDays) return d
  return addCalendarDaysNY(d, outdoorDelayDays)
}

export function getWateringStatus(nextWaterDue, outdoorDelayDays) {
  const now = new Date()
  const eff = effectiveDueDate(nextWaterDue, outdoorDelayDays)
  if (!eff) return 'ok'
  const cmp = calendarDaysDifferenceNY(now, eff)
  if (cmp < 0) return 'ok'
  if (cmp === 0) return 'due_today'
  return 'overdue'
}

export function daysSinceLastWatered(lastWatered) {
  if (!lastWatered) return null
  const last = lastWatered instanceof Date ? lastWatered : lastWatered.toDate?.() ?? new Date(lastWatered)
  const n = calendarDaysDifferenceNY(last, new Date())
  return Math.max(0, n)
}

function smartSortTier(nextRaw, outdoorDelayDays) {
  const status = getWateringStatus(nextRaw, outdoorDelayDays)
  if (status === 'overdue' || status === 'due_today') return 0
  if (!nextRaw) return 2
  const eff = effectiveDueDate(nextRaw, outdoorDelayDays)
  const d = calendarDaysDifferenceNY(new Date(), eff)
  if (d >= 1 && d <= 2) return 1
  return 2
}

export function sortPlants(plants, getOutdoorDelayForPlant) {
  return [...plants].sort((a, b) => {
    const delayA = getOutdoorDelayForPlant(a)
    const delayB = getOutdoorDelayForPlant(b)
    const nextA = a.nextWaterDue?.toDate?.() ?? a.nextWaterDue
    const nextB = b.nextWaterDue?.toDate?.() ?? b.nextWaterDue
    const rA = smartSortTier(nextA, delayA)
    const rB = smartSortTier(nextB, delayB)
    if (rA !== rB) return rA - rB

    const dueA = effectiveDueDate(nextA, delayA)
    const dueB = effectiveDueDate(nextB, delayB)
    if (dueA && dueB) {
      const tA = dueA.getTime()
      const tB = dueB.getTime()
      if (tA !== tB) return tA - tB
    }
    return (a.name || '').localeCompare(b.name || '')
  })
}

/**
 * Days from today (NY calendar) until effective due. Negative = overdue, 0 = today.
 */
export function daysUntilDueCalendar(nextWaterDue, outdoorDelayDays) {
  const raw = nextWaterDue?.toDate?.() ?? nextWaterDue
  if (!raw) return null
  const eff = effectiveDueDate(raw, outdoorDelayDays)
  return calendarDaysDifferenceNY(new Date(), eff)
}

export function dueLabel(nextWaterDue, outdoorDelayDays) {
  const now = new Date()
  const raw = nextWaterDue?.toDate?.() ?? nextWaterDue
  if (!raw) return 'Schedule not set'
  const eff = effectiveDueDate(raw, outdoorDelayDays)
  const diff = calendarDaysDifferenceNY(now, eff)
  if (diff > 0) return `Next in ${diff} day${diff === 1 ? '' : 's'}`
  if (diff === 0) return 'Due today'
  const o = -diff
  return `${o} day${o === 1 ? '' : 's'} overdue`
}

export function allPlantsHappy(plants, getOutdoorDelayForPlant) {
  if (!plants.length) return false
  return plants.every((p) => {
    const delay = getOutdoorDelayForPlant(p)
    return getWateringStatus(
      p.nextWaterDue?.toDate?.() ?? p.nextWaterDue,
      delay,
    ) === 'ok'
  })
}
