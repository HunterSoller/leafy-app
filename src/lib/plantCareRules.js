import { POT_WATER } from './defaults'
import { addCalendarDaysNY, calendarDaysDifferenceNY, effectiveDueDate } from './wateringLogic'

/** @param {string} text */
export function normalizePlantName(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .trim()
}

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  return new Date(value)
}

/**
 * Small ±1 day variation, stable for a given key + event index (no flicker on re-render).
 */
export function computeJitterDays(seedKey, eventIndex) {
  const s = String(seedKey ?? 'seed')
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h + s.charCodeAt(i) * (i + 1)) % 233
  }
  const idx = Number(eventIndex) || 0
  return ((h + idx * 17) % 3) - 1
}

/**
 * @typedef {{
 *   keys: string[],
 *   detectedType: string,
 *   indoorDays: number,
 *   outdoorDays: number,
 *   howToWaterText: string,
 *   warningSignsText: string,
 * }} CareRule
 */

/** @type {CareRule[]} Order: most specific first */
const CARE_RULES = [
  {
    keys: ['tomato', 'pepper', 'cucumber', 'zucchini', 'vegetable', 'eggplant'],
    detectedType: 'Vegetable patch',
    indoorDays: 5,
    outdoorDays: 2,
    howToWaterText: 'Water at the base in the morning until the top inch of soil is moist.',
    warningSignsText: 'Wilting in heat can be normal; soggy soil means cut back.',
  },
  {
    keys: ['snake plant', 'snake', 'sansevieria', 'mother-in-law'],
    detectedType: 'Snake plant',
    indoorDays: 14,
    outdoorDays: 10,
    howToWaterText: 'Soak lightly, then let the soil dry fully between waterings.',
    warningSignsText: 'Soft, yellow leaves often mean too much water.',
  },
  {
    keys: ['cactus', 'succulent', 'echeveria', 'jade'],
    detectedType: 'Succulent / cactus',
    indoorDays: 14,
    outdoorDays: 10,
    howToWaterText: 'Water deeply, then wait until the soil is completely dry.',
    warningSignsText: 'Mushy leaves or dark spots usually mean overwatering.',
  },
  {
    keys: ['aloe vera', 'aloe'],
    detectedType: 'Aloe',
    indoorDays: 14,
    outdoorDays: 10,
    howToWaterText: 'Water deeply, then let soil dry out completely between drinks.',
    warningSignsText: 'Soft, translucent leaves often mean too much water.',
  },
  {
    keys: ['peace lily', 'spathiphyllum'],
    detectedType: 'Peace lily',
    indoorDays: 5,
    outdoorDays: 4,
    howToWaterText: 'Keep soil evenly moist; water when the top feels slightly dry.',
    warningSignsText: 'Drooping with dry soil means water now; yellow leaves may mean too wet.',
  },
  {
    keys: ['orchid'],
    detectedType: 'Orchid',
    indoorDays: 10,
    outdoorDays: 7,
    howToWaterText: 'Water the growing medium thoroughly, then let excess drain away.',
    warningSignsText: 'Wrinkled leaves can mean underwatering; black roots mean too much water.',
  },
  {
    keys: ['fern', 'boston fern'],
    detectedType: 'Fern',
    indoorDays: 4,
    outdoorDays: 3,
    howToWaterText: 'Keep soil lightly moist; mist leaves if indoor air is very dry.',
    warningSignsText: 'Crisp brown tips often mean dry air or uneven watering.',
  },
  {
    keys: ['basil', 'mint', 'herb', 'cilantro', 'parsley', 'thyme', 'oregano', 'rosemary'],
    detectedType: 'Herb',
    indoorDays: 5,
    outdoorDays: 3,
    howToWaterText: 'Water at the base when the top of the soil feels dry.',
    warningSignsText: 'Wilting with dry soil means water right away; yellow mushy stems mean too wet.',
  },
  {
    keys: ['pothos', 'devils ivy', 'devil ivy', 'golden pothos'],
    detectedType: 'Pothos',
    indoorDays: 7,
    outdoorDays: 5,
    howToWaterText: 'Water at the base until slight drainage; let top soil dry between rounds.',
    warningSignsText: 'Yellow leaves may suggest overwatering; brown crispy edges mean too dry.',
  },
  {
    keys: ['monstera deliciosa', 'monstera', 'swiss cheese'],
    detectedType: 'Monstera',
    indoorDays: 7,
    outdoorDays: 5,
    howToWaterText: 'Water at the base until you see slight drainage from the bottom.',
    warningSignsText: 'Yellowing leaves may suggest overwatering.',
  },
  {
    keys: ['philodendron'],
    detectedType: 'Philodendron',
    indoorDays: 7,
    outdoorDays: 5,
    howToWaterText: 'Water at the base until slight drainage; allow the top inch to dry out.',
    warningSignsText: 'Soft stems or yellowing leaves may suggest overwatering.',
  },
  {
    keys: ['calathea', 'prayer plant'],
    detectedType: 'Calathea',
    indoorDays: 5,
    outdoorDays: 4,
    howToWaterText: 'Use room-temperature water; keep soil lightly moist, not soggy.',
    warningSignsText: 'Brown leaf edges often mean dry air or tap water sensitivity.',
  },
]

const GENERIC_INDOOR = {
  detectedType: 'Houseplant',
  indoorDays: 7,
  outdoorDays: 5,
  howToWaterText: 'Water at the base until you see slight drainage.',
  warningSignsText: 'Yellowing leaves may suggest overwatering.',
}

const GENERIC_OUTDOOR = {
  detectedType: 'Outdoor plant',
  indoorDays: 7,
  outdoorDays: 4,
  howToWaterText: 'Water at the base until the root zone is moist; adjust on very hot days.',
  warningSignsText: 'Wilting with wet soil may mean root issues; crisp dry leaves means water more.',
}

/**
 * @param {string} normalized
 * @param {'indoor' | 'outdoor'} environment
 * @returns {{ rule: CareRule, matched: boolean }}
 */
function pickRule(normalized, environment) {
  for (const rule of CARE_RULES) {
    if (rule.keys.some((k) => normalized.includes(k))) {
      return { rule, matched: true }
    }
  }
  const rule = environment === 'outdoor' ? GENERIC_OUTDOOR : GENERIC_INDOOR
  return { rule, matched: false }
}

/**
 * Prefer cup-style amounts only when pot context is meaningful (e.g. potted indoor or outdoor in a pot).
 */
export function shouldUsePotSizedAmount({
  environment,
  potSize,
  sceneType,
  matchKind,
}) {
  const st = sceneType || ''
  if (matchKind === 'area') return false
  if (st === 'garden_area' || st === 'multiple_plants') return false
  if (environment === 'outdoor' && !potSize) return false
  return true
}

/**
 * @param {{
 *   plantName: string,
 *   environment: 'indoor' | 'outdoor',
 *   potSize?: string | null,
 *   sceneType?: string | null,
 *   matchKind?: string | null,
 *   lastWateredAt?: Date | { toDate?: () => Date } | null,
 *   jitterKey?: string,
 *   jitterEventIndex?: number,
 * }} input
 */
export function generateCareRecommendation(input) {
  const {
    plantName,
    environment,
    potSize,
    lastWateredAt,
    jitterKey,
    jitterEventIndex = 0,
    sceneType,
    matchKind,
  } = input

  const normalized = normalizePlantName(plantName)
  const { rule, matched } = pickRule(normalized, environment)

  let interval =
    environment === 'outdoor' ? rule.outdoorDays : rule.indoorDays

  if (!matched) {
    interval += 1
    if (environment === 'indoor') interval = Math.max(interval, 4)
  }

  const usePotGuidance = shouldUsePotSizedAmount({
    environment,
    potSize: potSize || '',
    sceneType,
    matchKind,
  })
  const potKey = potSize && POT_WATER[potSize] ? potSize : 'M'
  const waterAmountText = usePotGuidance
    ? POT_WATER[potKey]
    : environment === 'outdoor'
      ? 'Water deeply at the root zone or across the bed until soil is moist several inches down.'
      : POT_WATER[potKey]

  const last = toDate(lastWateredAt)
  const anchor = last ?? new Date()
  const jitter = computeJitterDays((jitterKey ?? normalized) || 'plant', jitterEventIndex)
  const nextWateringAt = addCalendarDaysNY(anchor, interval + jitter)

  const careMatchQuality = matched ? 'specific' : 'general'
  let scheduleNote = matched
    ? 'Recommended schedule · tailored for this plant'
    : 'General recommendation · based on similar plants and your setup'
  if (!usePotGuidance && environment === 'outdoor') {
    scheduleNote =
      'Outdoor or in-ground — adjust for heat, wind, and rainfall in your area.'
  }

  const howPrefix = matched ? '' : 'Starting point — '
  const howToWaterText = matched
    ? rule.howToWaterText
    : `${howPrefix}${rule.howToWaterText}`
  const warningSignsText = matched
    ? rule.warningSignsText
    : `${rule.warningSignsText} Adjust if your plant looks thirsty or stressed.`

  return {
    detectedType: rule.detectedType,
    wateringIntervalDays: interval,
    waterAmountText,
    howToWaterText,
    warningSignsText,
    nextWateringAt,
    careMatchQuality,
    scheduleNote,
  }
}

/**
 * Decisive copy (legacy / secondary). Prefer getSmartPlantStatus for primary UI.
 */
export function assistantNextWateringPhrase(nextWaterDueRaw, outdoorDelayDays = 0) {
  const raw = nextWaterDueRaw?.toDate?.() ?? nextWaterDueRaw
  if (!raw) return 'Set a schedule by saving this plant again'

  const now = new Date()
  const eff = effectiveDueDate(raw, outdoorDelayDays)
  const diff = calendarDaysDifferenceNY(now, eff)
  if (diff <= 0) return 'Water today'
  if (diff === 1) return 'Water tomorrow'
  return `Water in ${diff} days`
}

/** @param {object} plant */
export function getPlantIntervalDays(plant) {
  return plant?.wateringIntervalDays ?? plant?.wateringFrequencyDays ?? 7
}

/** @param {object} plant */
export function suggestedAmountText(plant) {
  return plant?.waterAmountText ?? plant?.waterAmount ?? '—'
}

/** @param {object} plant */
export function howToWaterCopy(plant) {
  return plant?.howToWaterText ?? plant?.wateringMethod ?? '—'
}

/** @param {object} plant */
export function warningSignsCopy(plant) {
  return plant?.warningSignsText ?? plant?.warningSign ?? '—'
}

/** Subtitle under plant name, e.g. "Monstera (matched)" */
export function plantTypeDetectedLabel(plant) {
  const t = plant?.type?.trim()
  if (!t) return null
  const q = plant?.careMatchQuality ?? 'general'
  if (q === 'area' || plant?.matchKind === 'area') {
    return `${t} · area guide`
  }
  return q === 'specific' ? `${t} · recognized` : `${t} · general guide`
}
