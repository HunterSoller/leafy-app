/**
 * Indoor plant care profiles for Leafy (NFC, one plant per tag).
 * Single source of truth for intervals, human ranges, and care bullets.
 */

/** @typedef {{
 *   canonicalName: string,
 *   aliases: string[],
 *   intervalDays: number,
 *   displayWaterRange: string,
 *   lightBullets: string[],
 *   waterBullets: string[],
 *   extraBullets: string[],
 * }} PlantCareProfile */

/** Used when no profile scores above the match threshold. */
export const INDOOR_PLANT_FALLBACK = {
  canonicalName: 'Indoor Plant',
  aliases: [
    'indoor plant',
    'houseplant',
    'house plant',
    'potted plant',
    'plant',
    'green plant',
    'foliage',
    'greenery',
  ],
  intervalDays: 7,
  displayWaterRange: '7–10 days',
  lightBullets: ['Bright, indirect light is usually best.'],
  waterBullets: ['Water when the top 1–2 inches of soil feel dry.'],
  extraBullets: ['Adjust for season, light, and humidity in your home.'],
}

/** @type {PlantCareProfile[]} */
const PROFILES = [
  {
    canonicalName: 'Areca Palm',
    aliases: [
      'areca palm',
      'areca',
      'butterfly palm',
      'dypsis lutescens',
      'golden cane palm',
    ],
    intervalDays: 7,
    displayWaterRange: '5–10 days',
    lightBullets: ['Bright, indirect light; a few hours of gentle morning sun is OK.'],
    waterBullets: ['Water when the top 1–2 inches of soil feel dry.'],
    extraBullets: ['Enjoys humidity; brown tips often mean dry air or irregular watering.'],
  },
  {
    canonicalName: 'Snake Plant',
    aliases: [
      'snake plant',
      'sansevieria',
      'dracaena trifasciata',
      'mother-in-law',
      'mother in law tongue',
      'snakeplant',
    ],
    intervalDays: 18,
    displayWaterRange: '14–21 days',
    lightBullets: ['Tolerates lower light; grows faster in medium to bright indirect light.'],
    waterBullets: ['Let soil dry fully between waterings; easy to overwater.'],
    extraBullets: ['Very sensitive to soggy soil — use a well-draining mix.'],
  },
  {
    canonicalName: 'Pothos',
    aliases: [
      'pothos',
      'devils ivy',
      "devil's ivy",
      'golden pothos',
      'epipremnum',
      'epipremnum aureum',
      'marble queen pothos',
      'neon pothos',
    ],
    intervalDays: 8,
    displayWaterRange: '7–10 days',
    lightBullets: ['Medium to bright indirect light; tolerates lower light but grows slower.'],
    waterBullets: ['Water when the top inch or two of soil feels dry.'],
    extraBullets: ['Trailing stems may need water a bit more often in bright, warm spots.'],
  },
  {
    canonicalName: 'Monstera Deliciosa',
    aliases: [
      'monstera',
      'monstera deliciosa',
      'swiss cheese plant',
      'swiss cheese',
      'split leaf philodendron',
      'deliciosa',
    ],
    intervalDays: 8,
    displayWaterRange: '7–10 days',
    lightBullets: ['Bright, indirect light; avoid harsh midday sun on the leaves.'],
    waterBullets: ['Water when the top 2 inches of soil feel dry.'],
    extraBullets: ['Large leaves appreciate occasional dusting for better light capture.'],
  },
  {
    canonicalName: 'Peace Lily',
    aliases: [
      'peace lily',
      'spathiphyllum',
      'spath',
      'white sails',
    ],
    intervalDays: 5,
    displayWaterRange: '4–7 days',
    lightBullets: ['Medium to bright indirect light; low light works but may bloom less.'],
    waterBullets: ['Water when the top inch feels dry; it may droop slightly when thirsty.'],
    extraBullets: ['Sensitive to cold drafts and long dry spells — leaves may brown at tips.'],
  },
  {
    canonicalName: 'ZZ Plant',
    aliases: [
      'zz plant',
      'zanzibar gem',
      'zamioculcas',
      'zamioculcas zamiifolia',
      'zzplant',
    ],
    intervalDays: 14,
    displayWaterRange: '10–14 days',
    lightBullets: ['Low to bright indirect light; very adaptable.'],
    waterBullets: ['Let soil dry well between waterings; stores water in rhizomes.'],
    extraBullets: ['Overwatering is the most common issue — when in doubt, wait.'],
  },
  {
    canonicalName: 'Spider Plant',
    aliases: [
      'spider plant',
      'chlorophytum',
      'chlorophytum comosum',
      'airplane plant',
      'ribbon plant',
    ],
    intervalDays: 7,
    displayWaterRange: '5–10 days',
    lightBullets: ['Bright, indirect light keeps variegation happiest.'],
    waterBullets: ['Water when the top inch of soil feels dry.'],
    extraBullets: ['Brown leaf tips can follow fluoride/chlorine in tap water or dry air.'],
  },
  {
    canonicalName: 'Rubber Plant',
    aliases: [
      'rubber plant',
      'rubber tree',
      'ficus elastica',
      'indian rubber tree',
    ],
    intervalDays: 9,
    displayWaterRange: '7–10 days',
    lightBullets: ['Bright, indirect light; some direct morning sun is often fine.'],
    waterBullets: ['Water when the top 2 inches of soil feel dry.'],
    extraBullets: ['Wipe leaves occasionally — dust slows growth and dulls the sheen.'],
  },
  {
    canonicalName: 'Fiddle Leaf Fig',
    aliases: [
      'fiddle leaf',
      'fiddle leaf fig',
      'fiddle-leaf fig',
      'ficus lyrata',
    ],
    intervalDays: 8,
    displayWaterRange: '7–10 days',
    lightBullets: ['Bright, indirect light; consistent light helps prevent leaf drop.'],
    waterBullets: ['Water when the top 2 inches of soil feel dry; soak until slight drainage.'],
    extraBullets: ['Avoid moving it often — it can sulk after location changes.'],
  },
  {
    canonicalName: 'Aloe Vera',
    aliases: [
      'aloe',
      'aloe vera',
      'aloe barbadensis',
      'medicinal aloe',
    ],
    intervalDays: 16,
    displayWaterRange: '14–21 days',
    lightBullets: ['Bright indirect light to some direct sun (especially morning).'],
    waterBullets: ['Water deeply but only when soil is completely dry.'],
    extraBullets: ['Soft, mushy leaves usually mean too much water.'],
  },
  {
    canonicalName: 'Jade Plant',
    aliases: [
      'jade plant',
      'jade',
      'crassula',
      'crassula ovata',
      'money plant',
      'friendship tree',
    ],
    intervalDays: 16,
    displayWaterRange: '14–21 days',
    lightBullets: ['Bright light; a few hours of direct sun is often appreciated.'],
    waterBullets: ['Let soil dry fully between waterings; leaves store water.'],
    extraBullets: ['Leaves may shrivel when thirsty; wrinkling is a better cue than a fixed calendar.'],
  },
  {
    canonicalName: 'Philodendron',
    aliases: [
      'philodendron',
      'heartleaf philodendron',
      'philodendron hederaceum',
      'brasil philodendron',
    ],
    intervalDays: 8,
    displayWaterRange: '7–10 days',
    lightBullets: ['Medium to bright indirect light.'],
    waterBullets: ['Water when the top 1–2 inches of soil feel dry.'],
    extraBullets: ['Many types climb or trail — give support or space to hang.'],
  },
  {
    canonicalName: 'Calathea',
    aliases: [
      'calathea',
      'prayer plant',
      'goeppertia',
      'rattlesnake plant',
      'calathea ornata',
      'calathea medallion',
    ],
    intervalDays: 5,
    displayWaterRange: '4–7 days',
    lightBullets: ['Medium indirect light; avoid strong direct sun on patterned leaves.'],
    waterBullets: ['Keep evenly moist but not soggy; prefers consistent moisture.'],
    extraBullets: ['Loves humidity; brown crispy edges often mean dry air or tap water sensitivity.'],
  },
  {
    canonicalName: 'Fern',
    aliases: [
      'fern',
      'boston fern',
      'nephrolepis',
      'maidenhair fern',
      'bird nest fern',
      'asplenium nidus',
      'button fern',
    ],
    intervalDays: 4,
    displayWaterRange: '3–5 days',
    lightBullets: ['Medium indirect light; avoid hot afternoon sun.'],
    waterBullets: ['Keep soil lightly moist; never let it bake completely dry for long.'],
    extraBullets: ['Higher humidity helps — misting or a pebble tray can reduce browning.'],
  },
  {
    canonicalName: 'Dracaena',
    aliases: [
      'dracaena',
      'dracaena marginata',
      'dragon tree',
      'corn plant',
      'dracaena fragrans',
      'janet craig',
      'lemon lime dracaena',
    ],
    intervalDays: 10,
    displayWaterRange: '7–14 days',
    lightBullets: ['Medium to bright indirect light.'],
    waterBullets: ['Water when the top half of the soil feels dry.'],
    extraBullets: ['Brown leaf tips can follow fluoride in water or very dry air.'],
  },
  {
    canonicalName: 'Chinese Evergreen',
    aliases: [
      'chinese evergreen',
      'aglaonema',
      'aglaonema silver bay',
    ],
    intervalDays: 9,
    displayWaterRange: '7–10 days',
    lightBullets: ['Low to medium indirect light; tolerates less light than many houseplants.'],
    waterBullets: ['Water when the top 1–2 inches of soil feel dry.'],
    extraBullets: ['Very forgiving — great for offices and dimmer corners.'],
  },
  {
    canonicalName: 'Dieffenbachia',
    aliases: [
      'dieffenbachia',
      'dumb cane',
      'leopard lily',
    ],
    intervalDays: 7,
    displayWaterRange: '5–10 days',
    lightBullets: ['Bright, indirect light; avoid scorching midday sun.'],
    waterBullets: ['Water when the top inch or two feels dry.'],
    extraBullets: ['Sap can irritate skin — wash hands after handling damaged leaves.'],
  },
  {
    canonicalName: 'Parlor Palm',
    aliases: [
      'parlor palm',
      'parlour palm',
      'chamaedorea elegans',
      'neanthe bella palm',
      'tabletop palm',
    ],
    intervalDays: 9,
    displayWaterRange: '7–10 days',
    lightBullets: ['Medium to bright indirect light; tolerates lower light slowly.'],
    waterBullets: ['Water when the top inch of soil feels dry.'],
    extraBullets: ['Fronds brown faster in very dry air — occasional misting can help.'],
  },
  {
    canonicalName: 'Succulent',
    aliases: [
      'succulent',
      'succulents',
      'echeveria',
      'haworthia',
      'sempervivum',
      'string of pearls',
      'burros tail',
      'sedum',
    ],
    intervalDays: 18,
    displayWaterRange: '14–21 days',
    lightBullets: ['Bright light; most want strong indirect or some direct sun.'],
    waterBullets: ['Water deeply, then let soil dry completely before watering again.'],
    extraBullets: ['When in doubt, wait — rot from overwatering is the usual problem.'],
  },
  {
    canonicalName: 'Cactus',
    aliases: [
      'cactus',
      'cacti',
      'barrel cactus',
      'prickly pear',
      'opuntia',
      'mammillaria',
      'gymnocalycium',
    ],
    intervalDays: 21,
    displayWaterRange: '14–21+ days',
    lightBullets: ['Bright direct sun for many types; a sunny window is ideal.'],
    waterBullets: ['Water only when soil is fully dry; water even less in winter dormancy.'],
    extraBullets: ['Use a fast-draining cactus mix and a pot with drainage.'],
  },
]

const MATCH_THRESHOLD = 48

export function normalizeForProfileMatch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(norm) {
  return new Set(
    norm
      .split(/\s+/)
      .filter((w) => w.length > 1),
  )
}

/**
 * @param {string} inputNorm
 * @param {string} aliasNorm
 */
function scoreMatch(inputNorm, aliasNorm) {
  if (!inputNorm || !aliasNorm) return 0
  if (inputNorm === aliasNorm) return 100
  if (inputNorm.includes(aliasNorm)) return 88 + Math.min(aliasNorm.length, 12)
  if (aliasNorm.length >= 5 && aliasNorm.includes(inputNorm)) return 78

  const it = tokenSet(inputNorm)
  const at = tokenSet(aliasNorm)
  let overlap = 0
  for (const w of at) {
    if (it.has(w)) overlap++
  }
  if (at.size > 0 && overlap === at.size) return 72
  if (overlap > 0) return 42 + overlap * 11

  for (const w of at) {
    if (w.length >= 4 && inputNorm.includes(w)) return 62
  }
  return 0
}

/**
 * @param {string[]} rawStrings
 * @returns {PlantCareProfile & { matchedFromFallback: boolean }}
 */
export function matchIndoorCareProfile(rawStrings) {
  const inputs = rawStrings
    .map((s) => normalizeForProfileMatch(s))
    .filter(Boolean)

  let bestProfile = null
  let bestScore = 0

  for (const profile of PROFILES) {
    for (const alias of profile.aliases) {
      const an = normalizeForProfileMatch(alias)
      if (!an) continue
      for (const input of inputs) {
        const sc = scoreMatch(input, an)
        if (sc > bestScore) {
          bestScore = sc
          bestProfile = profile
        }
      }
    }
  }

  if (!bestProfile || bestScore < MATCH_THRESHOLD) {
    return {
      ...INDOOR_PLANT_FALLBACK,
      matchedFromFallback: true,
    }
  }

  return {
    ...bestProfile,
    matchedFromFallback: false,
  }
}

/**
 * @param {{ displayName?: string, typeLabel?: string, detectedType?: string, scientificName?: string, nameHint?: string }} ai
 */
export function matchIndoorCareProfileFromAi(ai) {
  const hint = ai.nameHint ? String(ai.nameHint).trim() : ''
  const slug = ai.detectedType ? String(ai.detectedType).replace(/_/g, ' ') : ''
  return matchIndoorCareProfile([
    ai.displayName,
    ai.typeLabel,
    ai.scientificName,
    slug,
    hint,
  ])
}

/**
 * Merge profile fields onto an AI result object (for setup / manual flows).
 * @param {object} n
 * @param {string} [nameHint]
 */
export function applyIndoorCareProfileToAiResult(n, nameHint = '') {
  const p = matchIndoorCareProfileFromAi({
    displayName: n.displayName,
    typeLabel: n.typeLabel,
    detectedType: n.detectedType,
    scientificName: n.scientificName,
    nameHint: nameHint || n.nameHint,
  })

  return {
    ...n,
    wateringIntervalDays: p.intervalDays,
    canonicalPlantName: p.canonicalName,
    displayWaterRange: p.displayWaterRange,
    careLightBullets: [...p.lightBullets],
    careWaterBullets: [...p.waterBullets],
    careExtraBullets: [...p.extraBullets],
    careProfileFallback: p.matchedFromFallback,
    careLightLine: p.lightBullets[0] || n.careLightLine || '',
    howToWaterText: p.waterBullets[0] || n.howToWaterText,
  }
}

/** @returns {PlantCareProfile[]} */
export function listProfilesForPicker() {
  return [
    ...[...PROFILES].sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName),
    ),
    { ...INDOOR_PLANT_FALLBACK },
  ]
}

/**
 * @param {string} canonicalName
 * @returns {PlantCareProfile & { matchedFromFallback: boolean } | null}
 */
export function getProfileByCanonicalName(canonicalName) {
  const key = String(canonicalName || '').trim()
  if (!key) return null
  if (key === INDOOR_PLANT_FALLBACK.canonicalName) {
    return { ...INDOOR_PLANT_FALLBACK, matchedFromFallback: true }
  }
  const found = PROFILES.find((p) => p.canonicalName === key)
  return found ? { ...found, matchedFromFallback: false } : null
}

/**
 * @param {PlantCareProfile & { matchedFromFallback?: boolean }} p
 */
export function profileToFirestorePatch(p) {
  return {
    canonicalPlantName: p.canonicalName,
    wateringIntervalDays: p.intervalDays,
    wateringFrequencyDays: p.intervalDays,
    displayWaterRange: p.displayWaterRange,
    careLightBullets: [...p.lightBullets],
    careWaterBullets: [...p.waterBullets],
    careExtraBullets: [...p.extraBullets],
    careProfileFallback: Boolean(p.matchedFromFallback),
    type: p.canonicalName,
  }
}
