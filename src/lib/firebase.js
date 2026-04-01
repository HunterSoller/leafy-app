import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  increment,
  setDoc,
} from 'firebase/firestore'
import { DEFAULT_GROUP_ID, normalizeStoredGroupId } from './group'
import {
  readLocalGroupSettings,
  writeLocalGroupSettings,
} from './groupLocalSettings'
import { getPlantIntervalDays, computeJitterDays } from './plantCareRules'

function getConfig() {
  const {
    VITE_FIREBASE_API_KEY: apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: authDomain,
    VITE_FIREBASE_PROJECT_ID: projectId,
    VITE_FIREBASE_STORAGE_BUCKET: storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
    VITE_FIREBASE_APP_ID: appId,
  } = import.meta.env

  if (!projectId) return null

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  }
}

let _db

export function getDb() {
  if (_db) return _db
  const cfg = getConfig()
  if (!cfg?.apiKey) return null
  const app = initializeApp(cfg)
  _db = getFirestore(app)
  return _db
}

export function timestampFromDate(d) {
  return Timestamp.fromDate(d instanceof Date ? d : new Date(d))
}

export function addDaysTimestamp(from, days) {
  const base = from instanceof Date ? from : new Date(from)
  const next = new Date(base)
  next.setDate(next.getDate() + Number(days))
  return Timestamp.fromDate(next)
}

/**
 * Plants for this group. Non-default uses an indexed equality query.
 * default-group includes legacy docs with no groupId (client-side filter).
 */
export function subscribePlants(groupId, onData, onError) {
  const db = getDb()
  if (!db) {
    onData([])
    return () => {}
  }

  const mapDocs = (snap) =>
    snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  if (groupId !== DEFAULT_GROUP_ID) {
    const q = query(
      collection(db, 'plants'),
      where('groupId', '==', groupId),
    )
    return onSnapshot(
      q,
      (snap) => onData(mapDocs(snap)),
      (err) => onError?.(err),
    )
  }

  return onSnapshot(
    collection(db, 'plants'),
    (snap) => {
      const plants = mapDocs(snap).filter(
        (p) => normalizeStoredGroupId(p.groupId) === DEFAULT_GROUP_ID,
      )
      onData(plants)
    },
    (err) => onError?.(err),
  )
}

/**
 * Snapshot of watering_log for this group (use if you add a log UI later).
 */
export function subscribeWateringLog(groupId, onData, onError) {
  const db = getDb()
  if (!db) {
    onData([])
    return () => {}
  }

  if (groupId !== DEFAULT_GROUP_ID) {
    const q = query(
      collection(db, 'watering_log'),
      where('groupId', '==', groupId),
    )
    return onSnapshot(
      q,
      (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => onError?.(err),
    )
  }

  return onSnapshot(
    collection(db, 'watering_log'),
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => normalizeStoredGroupId(row.groupId) === DEFAULT_GROUP_ID)
      onData(rows)
    },
    (err) => onError?.(err),
  )
}

/**
 * Per-group settings (e.g. weather location). Document id matches `groupId` from the URL / plants.
 * Fields: location_lat, location_lng, location_label, location_source ('browser' | 'manual')
 */
export function subscribeGroupSettings(groupId, onData, onError) {
  const id = normalizeStoredGroupId(groupId)
  const db = getDb()
  if (!db) {
    try {
      onData(readLocalGroupSettings(id))
    } catch (e) {
      onError?.(e)
    }
    return () => {}
  }

  const ref = doc(db, 'groups', id)
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      onData(snap.data())
    },
    (err) => {
      onError?.(err)
      onData(readLocalGroupSettings(id))
    },
  )
}

/**
 * @param {string} groupId
 * @param {{ location_lat: number, location_lng: number, location_label?: string, location_source?: 'browser' | 'manual' }} fields
 */
export async function saveGroupLocation(groupId, fields) {
  const id = normalizeStoredGroupId(groupId)
  const lat = Number(fields.location_lat)
  const lng = Number(fields.location_lng)
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error('Invalid coordinates')
  }
  const payload = {
    location_lat: lat,
    location_lng: lng,
    location_label: String(fields.location_label ?? '').slice(0, 200),
    location_source: fields.location_source === 'browser' ? 'browser' : 'manual',
  }

  const db = getDb()
  if (!db) {
    writeLocalGroupSettings(id, payload)
    return
  }

  await setDoc(doc(db, 'groups', id), payload, { merge: true })
}

export async function persistPlantWaterBalance(id, patch) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  const ref = doc(db, 'plants', id)
  const clean = { ...patch }
  for (const k of Object.keys(clean)) {
    if (clean[k] === undefined) delete clean[k]
  }
  await updateDoc(ref, clean)
}

export async function createPlant(payload) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')

  const groupId = payload.groupId
  if (!groupId) throw new Error('groupId is required to create a plant')

  const now = serverTimestamp()
  const interval = getPlantIntervalDays(payload)
  const nextDue =
    payload.nextWaterDue ?? addDaysTimestamp(new Date(), interval)

  const initHydration =
    payload.hydrationScore ??
    payload.waterLevel ??
    100

  await addDoc(collection(db, 'plants'), {
    groupId,
    name: payload.name,
    displayName: payload.displayName ?? payload.name ?? '',
    type: payload.type ?? '',
    location: payload.location ?? 'indoor',
    potSize: payload.potSize !== undefined && payload.potSize !== null
      ? payload.potSize
      : '',
    imageUrl: payload.imageUrl ?? null,
    wateringIntervalDays:
      payload.wateringIntervalDays ?? payload.wateringFrequencyDays ?? 7,
    wateringFrequencyDays:
      payload.wateringFrequencyDays ?? payload.wateringIntervalDays ?? 7,
    waterAmountText:
      payload.waterAmountText ?? payload.waterAmount ?? '',
    waterAmount: payload.waterAmount ?? payload.waterAmountText ?? '',
    howToWaterText:
      payload.howToWaterText ?? payload.wateringMethod ?? '',
    wateringMethod:
      payload.wateringMethod ?? payload.howToWaterText ?? '',
    warningSignsText:
      payload.warningSignsText ?? payload.warningSign ?? '',
    warningSign: payload.warningSign ?? payload.warningSignsText ?? '',
    careMatchQuality: payload.careMatchQuality ?? 'general',
    scheduleNote: payload.scheduleNote ?? '',
    totalWaterCount: payload.totalWaterCount ?? 0,
    lastWatered: payload.lastWatered ?? null,
    nextWaterDue: nextDue,
    hydrationScore: initHydration,
    hydrationCalculatedAt: now,
    weatherAdjustmentNote: payload.weatherAdjustmentNote ?? null,
    waterLevel: initHydration,
    waterBalanceUpdatedAt: now,
    rainMmBalanceSnapshot:
      typeof payload.rainMmBalanceSnapshot === 'number'
        ? payload.rainMmBalanceSnapshot
        : 0,
    lastRainAt: payload.lastRainAt ?? null,
    lastRainAmount: payload.lastRainAmount ?? null,
    rainContribution: payload.rainContribution ?? null,
    notes: payload.notes ?? '',
    createdAt: now,
    scientificName: payload.scientificName ?? '',
    aiIdentifiedScientificName: payload.aiIdentifiedScientificName ?? null,
    detectedType: payload.detectedType ?? '',
    matchKind: payload.matchKind ?? null,
    sceneType: payload.sceneType ?? null,
    confidence: payload.confidence ?? null,
    aiGenerated: payload.aiGenerated ?? false,
    imageAnalyzedAt: payload.aiGenerated ? now : null,
    aiCorrectedByUser: payload.aiCorrectedByUser ?? false,
    aiSuggestedDisplayName: payload.aiSuggestedDisplayName ?? null,
    fallbackUsed: payload.fallbackUsed ?? false,
  })
}

export async function savePlant(id, payload) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  const ref = doc(db, 'plants', id)
  const patch = { ...payload }
  delete patch.id
  delete patch.createdAt
  for (const k of Object.keys(patch)) {
    if (patch[k] === undefined) delete patch[k]
  }
  await updateDoc(ref, patch)
}

export async function removePlant(id) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  await deleteDoc(doc(db, 'plants', id))
}

export async function logWatering(plantId, weatherDelayApplied, groupId) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  if (!groupId) throw new Error('groupId is required for watering log')

  await addDoc(collection(db, 'watering_log'), {
    groupId,
    plantId,
    wateredAt: serverTimestamp(),
    weatherDelayApplied: !!weatherDelayApplied,
  })
}

export async function recordWatering(plant, outdoorDelayDays, options = {}) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  const now = new Date()
  const baseInterval = getPlantIntervalDays(plant)
  const nextCount = (plant.totalWaterCount ?? 0) + 1
  const jitter = computeJitterDays(plant.id || plant.name, nextCount)
  const interval = baseInterval + jitter
  const nextDue = addDaysTimestamp(now, interval)
  const ref = doc(db, 'plants', plant.id)
  const groupId = normalizeStoredGroupId(plant.groupId)

  const rainSnap =
    typeof options.rainMmSnapshot === 'number' ? options.rainMmSnapshot : 0

  await updateDoc(ref, {
    lastWatered: Timestamp.fromDate(now),
    nextWaterDue: nextDue,
    totalWaterCount: increment(1),
    hydrationScore: 98,
    hydrationCalculatedAt: Timestamp.fromDate(now),
    waterLevel: 98,
    waterBalanceUpdatedAt: Timestamp.fromDate(now),
    rainMmBalanceSnapshot: rainSnap,
    weatherAdjustmentNote: null,
  })
  await logWatering(
    plant.id,
    plant.location === 'outdoor' && outdoorDelayDays > 0,
    groupId,
  )
}
