import { Timestamp } from 'firebase/firestore'
import { normalizeStoredGroupId } from './group'

const PREFIX = 'leafy_plants_cache_v1:'

/** Fields that may be Firestore Timestamps on plant docs */
const TIMESTAMP_KEYS = new Set([
  'nextWaterDue',
  'lastWatered',
  'createdAt',
  'hydrationCalculatedAt',
  'waterBalanceUpdatedAt',
  'lastRainAt',
  'imageAnalyzedAt',
])

function packValue(v) {
  if (v == null) return v
  if (v instanceof Timestamp) {
    return { __leafyTs: 1, s: v.seconds, n: v.nanoseconds ?? 0 }
  }
  if (Array.isArray(v)) return v.map(packValue)
  if (typeof v === 'object' && v.constructor === Object) {
    const o = {}
    for (const k of Object.keys(v)) {
      o[k] = packValue(v[k])
    }
    return o
  }
  return v
}

function unpackValue(v) {
  if (v == null) return v
  if (typeof v === 'object' && v.__leafyTs === 1 && typeof v.s === 'number') {
    return new Timestamp(v.s, v.n ?? 0)
  }
  if (Array.isArray(v)) return v.map(unpackValue)
  if (typeof v === 'object' && v.constructor === Object) {
    const o = {}
    for (const k of Object.keys(v)) {
      o[k] = unpackValue(v[k])
    }
    return o
  }
  return v
}

function packPlant(doc) {
  const { id, ...data } = doc
  const packed = { id }
  for (const k of Object.keys(data)) {
    packed[k] = TIMESTAMP_KEYS.has(k) ? packValue(data[k]) : data[k]
  }
  return packed
}

function unpackPlant(packed) {
  if (!packed?.id) return null
  const { id, ...data } = packed
  const out = { id }
  for (const k of Object.keys(data)) {
    out[k] = TIMESTAMP_KEYS.has(k) ? unpackValue(data[k]) : data[k]
  }
  return out
}

/** @returns {Array<{ id: string } & Record<string, unknown>> | null} */
export function readCachedPlantsList(groupId) {
  const id = normalizeStoredGroupId(groupId)
  try {
    const raw = localStorage.getItem(PREFIX + id)
    if (!raw) return null
    const { plants } = JSON.parse(raw)
    if (!Array.isArray(plants)) return null
    return plants.map(unpackPlant).filter(Boolean)
  } catch {
    return null
  }
}

/**
 * @param {string} groupId
 * @param {Array<Record<string, unknown> & { id: string }>} plants
 */
export function writeCachedPlantsList(groupId, plants) {
  const id = normalizeStoredGroupId(groupId)
  try {
    const payload = {
      t: Date.now(),
      plants: plants.map((p) => packPlant(p)),
    }
    localStorage.setItem(PREFIX + id, JSON.stringify(payload))
  } catch {
    /* quota */
  }
}
