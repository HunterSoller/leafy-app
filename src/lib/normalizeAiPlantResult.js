import { addCalendarDaysNY } from './wateringLogic'
import { computeJitterDays } from './plantCareRules'
import { POT_WATER } from './defaults'

/** Legacy threshold; photo flow always requires explicit user confirmation before save. */
export const AUTO_SAVE_MIN_CONFIDENCE = 0.75

const MATCH_KINDS = new Set(['specific', 'category', 'area', 'unknown'])
const SCENE_TYPES = new Set([
  'single_plant',
  'multiple_plants',
  'garden_area',
  'unclear',
])

const VAGUE_NAME =
  /^(houseplant|indoor plant|plant|plants|green plant|green foliage|foliage|unknown|garden|outdoor plant|potted plant|greenery|green|variety|mixed|bed|area|yard|outside)$/i

function clamp01(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return 0.55
  return Math.min(1, Math.max(0, n))
}

function clampInterval(v, sceneType, environment) {
  let d = Math.round(Number(v))
  if (Number.isNaN(d)) d = environment === 'outdoor' ? 4 : 7
  if (sceneType === 'garden_area' || sceneType === 'multiple_plants') {
    d = Math.min(Math.max(d, 2), environment === 'outdoor' ? 6 : 6)
  } else {
    d = Math.min(Math.max(d, 2), 14)
  }
  return d
}

/** Exported for client-side clamping when the user edits interval after identification. */
export function clampWateringIntervalDays(v, sceneType, environment) {
  return clampInterval(v, sceneType, environment)
}

function sanitizeDisplayName(s) {
  return String(s ?? '')
    .replace(/[^\w\s\-'",./&]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function sanitizeScientificName(s) {
  return String(s ?? '')
    .replace(/[^\w\s.\-'",()]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/** Friendlier labels for generic outdoor area names from the model. */
function polishOutdoorDisplayName(displayName, nameHint, environment) {
  const d = sanitizeDisplayName(displayName)
  const hint = sanitizeDisplayName(nameHint)
  if (environment !== 'outdoor') return d

  const awkward =
    /^(outdoor garden|garden area|plants area|green plants|plants|yard|outside|backyard garden area|outdoor plants)$/i
  if (awkward.test(d) && hint.length >= 2) {
    if (/bed|patch|border|planter|herb|tomato|shrub|flower|front|side|back|drive/i.test(hint)) {
      return hint
    }
    if (/yard|garden|patch/i.test(hint)) return hint
    return `${hint} · garden area`
  }
  return d
}

function slugifyDetected(s) {
  const t = String(s ?? 'plant')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 48)
  return t || 'plant'
}

/**
 * If the model returns cup volumes but this is in-ground / bed / outdoor no-pot, use calm copy.
 */
function softenWaterAmountForContext(text, ignorePotSize, environment) {
  const t = String(text || '').trim()
  if (!ignorePotSize || !t) return t
  if (/\d+\s*(ml|cup|cups|oz|ltr|liter)/i.test(t)) {
    return environment === 'outdoor'
      ? 'Water deeply around the base or evenly until the soil feels moist.'
      : 'Water at the base until the soil feels lightly moist — skip strict cup counts for this setup.'
  }
  return t
}

/**
 * Nudge vague model outputs into something intentional for one saved card.
 */
function applyAmbiguityHeuristics(base, environment, nameHint) {
  const hint = sanitizeDisplayName(nameHint)
  let displayName = base.displayName
  let sceneType = base.sceneType
  let matchKind = base.matchKind
  let careMatchQuality = base.careMatchQuality
  let confidence = base.confidence
  let detectedType = base.detectedType
  const lower = displayName.toLowerCase()
  const isVague =
    !displayName ||
    lower.length < 2 ||
    VAGUE_NAME.test(lower) ||
    lower === 'n/a' ||
    lower === 'none'

  if (isVague) {
    if (environment === 'outdoor') {
      displayName = hint || 'Backyard garden area'
      sceneType = 'garden_area'
      matchKind = 'area'
      careMatchQuality = 'area'
      confidence = Math.min(confidence, 0.55)
      detectedType = hint ? slugifyDetected(hint) : 'garden_area'
    } else {
      displayName = hint || 'Indoor plant'
      sceneType = 'single_plant'
      matchKind = hint ? 'category' : 'unknown'
      careMatchQuality = 'general'
      confidence = Math.min(confidence, 0.58)
      detectedType = hint ? slugifyDetected(hint) : 'houseplant'
    }
  } else if (hint.length >= 2) {
    if (
      lower.includes('unknown') ||
      lower.includes('unclear') ||
      VAGUE_NAME.test(lower)
    ) {
      displayName = hint
      matchKind = 'category'
      detectedType = slugifyDetected(hint)
    } else if (environment === 'outdoor' && /bed|patch|planter|border|area/i.test(hint)) {
      displayName = hint
      sceneType = sceneType === 'single_plant' ? 'garden_area' : sceneType
      if (matchKind === 'specific') matchKind = 'area'
      careMatchQuality = 'area'
    }
  }

  return {
    ...base,
    displayName,
    sceneType,
    matchKind,
    careMatchQuality,
    confidence: clamp01(confidence),
    detectedType,
  }
}

/**
 * Map raw Anthropic JSON into a safe in-app shape. Always returns an object; never trust raw strings.
 * @param {object} raw
 * @param {{ environment?: 'indoor'|'outdoor', potSize?: string, nameHint?: string, jitterKey?: string, jitterEventIndex?: number }} ctx
 */
export function normalizeAiPlantResult(raw, ctx = {}) {
  const environment = ctx.environment === 'outdoor' ? 'outdoor' : 'indoor'
  const potSize = ctx.potSize && POT_WATER[ctx.potSize] ? ctx.potSize : ''
  const jitterKey = ctx.jitterKey ?? 'ai'
  const jitterEventIndex = ctx.jitterEventIndex ?? 0
  const nameHint = ctx.nameHint ? String(ctx.nameHint).trim() : ''

  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}

  let matchKind = String(r.matchKind || 'unknown').toLowerCase()
  if (!MATCH_KINDS.has(matchKind)) matchKind = 'unknown'

  let sceneType = String(r.sceneType || 'unclear').toLowerCase()
  if (!SCENE_TYPES.has(sceneType)) sceneType = 'unclear'

  let displayName = sanitizeDisplayName(r.displayName || r.commonName)
  let scientificName = sanitizeScientificName(r.scientificName)
  let detectedType = slugifyDetected(r.detectedType || displayName || 'plant')

  const confidence = clamp01(r.confidence)
  let wateringIntervalDays = clampInterval(
    r.wateringIntervalDays,
    sceneType,
    environment,
  )

  const ignorePotSize =
    environment === 'outdoor' && !potSize
      ? true
      : sceneType === 'garden_area' ||
        sceneType === 'multiple_plants' ||
        matchKind === 'area'

  let waterAmountText = String(r.waterAmountText || r.waterAmount || '').trim()
  waterAmountText = softenWaterAmountForContext(
    waterAmountText,
    ignorePotSize,
    environment,
  )
  if (!waterAmountText) {
    waterAmountText = ignorePotSize
      ? environment === 'outdoor'
        ? 'Give the area a deep soak when the soil starts to dry; ease off after rain.'
        : 'Water at the base until lightly moist; refine as you learn the plant.'
      : POT_WATER[potSize || 'M']
  }

  let howToWaterText = String(r.howToWaterText || r.howToWater || '').trim()
  howToWaterText = howToWaterText.replace(/\s+/g, ' ').slice(0, 280)
  if (!howToWaterText) {
    howToWaterText = ignorePotSize
      ? environment === 'outdoor'
        ? 'Water evenly until the soil feels moist several inches down.'
        : 'Water at the base until the top inch of soil feels damp, then let excess drain.'
      : 'Water at the base until you see slight drainage from the bottom.'
  }

  let warningSignsText = String(r.warningSignsText || r.warningSign || '').trim()
  warningSignsText = warningSignsText.replace(/\s+/g, ' ').slice(0, 280)
  if (!warningSignsText) {
    warningSignsText =
      'Wilting with wet soil may mean stress; dry, crisp leaves usually mean more water.'
  }

  let scheduleNote = String(r.scheduleNote || '').trim().slice(0, 400)
  if (!scheduleNote) {
    if (sceneType === 'garden_area' || sceneType === 'multiple_plants') {
      scheduleNote =
        'One gentle plan for this space — tweak if one corner dries faster.'
    } else if (environment === 'outdoor') {
      scheduleNote = 'Outdoors, heat and wind dry soil faster — check after hot days.'
    } else {
      scheduleNote = 'Indoors — adjust for light and how fast your pot dries out.'
    }
  }

  let careMatchQuality = String(r.careMatchQuality || '').toLowerCase()
  if (!['specific', 'general', 'area'].includes(careMatchQuality)) {
    if (matchKind === 'specific') careMatchQuality = 'specific'
    else if (matchKind === 'category') careMatchQuality = 'general'
    else if (matchKind === 'area') careMatchQuality = 'area'
    else careMatchQuality = 'general'
  }

  const fallbackUsed = Boolean(r.fallbackUsed)

  let merged = applyAmbiguityHeuristics(
    {
      displayName,
      scientificName,
      detectedType,
      matchKind,
      sceneType,
      careMatchQuality,
      confidence,
      wateringIntervalDays,
      waterAmountText,
      howToWaterText,
      warningSignsText,
      scheduleNote,
      fallbackUsed,
      ignorePotSize,
      typeLabel: '',
      nextWateringAt: null,
    },
    environment,
    nameHint,
  )

  merged.wateringIntervalDays = clampInterval(
    merged.wateringIntervalDays,
    merged.sceneType,
    environment,
  )

  merged.waterAmountText = softenWaterAmountForContext(
    merged.waterAmountText,
    merged.ignorePotSize,
    environment,
  )

  const jitter = computeJitterDays(jitterKey, jitterEventIndex)
  merged.nextWateringAt = addCalendarDaysNY(
    new Date(),
    merged.wateringIntervalDays + jitter,
  )

  merged.displayName = polishOutdoorDisplayName(
    merged.displayName,
    nameHint,
    environment,
  )
  merged.typeLabel = merged.displayName

  return merged
}

export function normalizeNameHintForRules(nameHint) {
  const t = String(nameHint || '').trim()
  return t || 'Plant'
}

/**
 * Photo identification never auto-saves — user must confirm on the review step.
 */
export function shouldAutoSaveAfterAi() {
  return false
}

export function needsAiReviewStep(n) {
  return Boolean(n && !n.fallbackUsed)
}

/**
 * Short confidence-aware headline for the review step (“Likely …”, “Possibly …”, etc.).
 */
export function identificationHeadline(n) {
  if (!n) return ''
  const name = String(n.displayName || '').trim() || 'this plant'
  const c = clamp01(n.confidence)
  if (c >= 0.72) return `Likely ${name}`
  if (c >= 0.45) return `Possibly ${name}`
  return `Not fully sure — please confirm`
}

/** Context + trust note for the review panel. */
export function confirmExplanationLine(n) {
  if (!n) return ''
  const trust =
    'Plant identification is an estimate. Please confirm details before saving.'
  if (n.sceneType === 'garden_area' || n.sceneType === 'multiple_plants') {
    return `We grouped this as one outdoor space — a single card with gentle guidance. ${trust}`
  }
  if (n.sceneType === 'unclear' || n.confidence < 0.55) {
    return `The photo left some room for interpretation — edit anything that looks off. ${trust}`
  }
  return `Review the suggestions below and adjust if needed. ${trust}`
}
