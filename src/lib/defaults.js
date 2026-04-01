export const POT_WATER = {
  S: '~125ml (½ cup)',
  M: '~250ml (1 cup)',
  L: '~500ml (2 cups)',
  XL: '~1L (4 cups)',
}

export const DEFAULTS = {
  succulent: 14,
  cactus: 14,
  tropical: 7,
  pothos: 7,
  monstera: 7,
  philodendron: 7,
  fern: 3,
  calathea: 3,
  herb: 2,
  basil: 2,
  outdoor_generic: 3,
  indoor_generic: 7,
}

export const METHOD_DEFAULTS = {
  succulent: 'Water thoroughly, then let dry completely',
  fern: 'Keep soil moist, mist leaves occasionally',
  herb: 'Water at base, keep soil evenly moist',
  default: 'Water at base until it drains from the bottom',
}

const DEFAULT_ORDER = [
  'succulent',
  'cactus',
  'pothos',
  'monstera',
  'philodendron',
  'tropical',
  'fern',
  'calathea',
  'herb',
  'basil',
]

export function guessWateringDays(type, location) {
  const t = (type || '').toLowerCase()
  for (const key of DEFAULT_ORDER) {
    if (t.includes(key)) return DEFAULTS[key]
  }
  return location === 'outdoor'
    ? DEFAULTS.outdoor_generic
    : DEFAULTS.indoor_generic
}

export function guessMethod(type) {
  const t = (type || '').toLowerCase()
  if (t.includes('succulent') || t.includes('cactus')) {
    return METHOD_DEFAULTS.succulent
  }
  if (t.includes('fern')) return METHOD_DEFAULTS.fern
  if (t.includes('herb') || t.includes('basil')) return METHOD_DEFAULTS.herb
  return METHOD_DEFAULTS.default
}
