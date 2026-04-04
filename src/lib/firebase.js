/**
 * Leafy Firestore layout (strict `groupId` separation):
 * - groups/{groupId}/plants/{plantId}
 * - groups/{groupId}/watering_log/{eventId}  (fields: groupId, plantId, wateredAt)
 * - groups/{groupId}/settings/main          (optional; per-group notes / location)
 */
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  limit,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore'

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

function plantPayloadFromCreate(groupId, payload, now) {
  const interval = Math.max(
    1,
    Math.min(30, Math.round(Number(payload.wateringIntervalDays)) || 7),
  )
  return {
    groupId,
    version: 1,
    setupComplete: true,
    location: 'indoor',

    customName: payload.customName ?? '',
    identifiedPlantName: payload.identifiedPlantName ?? '',
    canonicalPlantName: payload.canonicalPlantName ?? '',
    displayName: payload.displayName ?? payload.identifiedPlantName ?? 'Plant',
    name: payload.displayName ?? payload.identifiedPlantName ?? 'Plant',
    type: payload.type ?? payload.canonicalPlantName ?? payload.identifiedPlantName ?? '',

    imageUrl: payload.imageUrl ?? null,
    wateringIntervalDays: interval,
    wateringFrequencyDays: interval,
    displayWaterRange: payload.displayWaterRange ?? '',

    careSummary: payload.careSummary ?? '',
    careLightLine: payload.careLightLine ?? '',
    careLightBullets: Array.isArray(payload.careLightBullets)
      ? payload.careLightBullets
      : [],
    careWaterBullets: Array.isArray(payload.careWaterBullets)
      ? payload.careWaterBullets
      : [],
    careExtraBullets: Array.isArray(payload.careExtraBullets)
      ? payload.careExtraBullets
      : [],
    careProfileFallback: Boolean(payload.careProfileFallback),
    careScheduleNote: payload.careScheduleNote ?? '',
    notes: payload.notes ?? '',

    waterAmountText: payload.waterAmountText ?? '',
    howToWaterText: payload.howToWaterText ?? '',
    warningSignsText: payload.warningSignsText ?? '',

    lastWateredAt: null,
    lastWatered: null,
    nextWaterDue: null,

    aiConfidence: payload.aiConfidence ?? null,
    aiMatchKind: payload.aiMatchKind ?? null,
    detectedType: payload.detectedType ?? '',
    scientificName: payload.scientificName ?? '',

    totalWaterCount: 0,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * All plants in one NFC group / tag space: `groups/{groupId}/plants/*`
 * @param {string} groupId
 * @param {(rows: object[]) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function subscribeGroupPlants(groupId, onData, onError) {
  const db = getDb()
  if (!db) {
    onData([])
    return () => {}
  }

  const ref = collection(db, 'groups', groupId, 'plants')
  return onSnapshot(
    ref,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const id = d.id
        return {
          id,
          plantId: id,
          groupId,
          tagId: id,
          ...d.data(),
        }
      })
      rows.sort((a, b) => {
        const na = String(a.displayName || a.name || '').toLowerCase()
        const nb = String(b.displayName || b.name || '').toLowerCase()
        return na.localeCompare(nb)
      })
      onData(rows)
    },
    (err) => onError?.(err),
  )
}

/**
 * @returns {Promise<string>} new plant document id
 */
export async function createGroupPlantDocument(groupId, payload) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')

  const now = serverTimestamp()
  const body = plantPayloadFromCreate(groupId, payload, now)
  const colRef = collection(db, 'groups', groupId, 'plants')
  const docRef = await addDoc(colRef, body)
  return docRef.id
}

/**
 * @param {string} groupId
 * @param {string} plantId
 * @param {(data: object | null) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function subscribeGroupPlant(groupId, plantId, onData, onError) {
  const db = getDb()
  if (!db) {
    onData(null)
    return () => {}
  }

  const ref = doc(db, 'groups', groupId, 'plants', plantId)
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      const id = snap.id
      onData({
        id,
        plantId: id,
        groupId,
        tagId: id,
        ...snap.data(),
      })
    },
    (err) => onError?.(err),
  )
}

export async function updateGroupPlantDocument(groupId, plantId, patch) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  const ref = doc(db, 'groups', groupId, 'plants', plantId)
  const clean = { ...patch, updatedAt: serverTimestamp() }
  delete clean.id
  delete clean.plantId
  delete clean.groupId
  delete clean.tagId
  delete clean.createdAt
  for (const k of Object.keys(clean)) {
    if (clean[k] === undefined) delete clean[k]
  }
  await updateDoc(ref, clean)
}

export async function deleteGroupPlantDocument(groupId, plantId) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  await deleteDoc(doc(db, 'groups', groupId, 'plants', plantId))
}

export async function recordGroupPlantWatering(groupId, plantId, wateringIntervalDays) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  const now = new Date()
  const interval = Math.max(
    1,
    Math.min(30, Math.round(Number(wateringIntervalDays)) || 7),
  )
  const nextDue = addDaysTimestamp(now, interval)
  const ref = doc(db, 'groups', groupId, 'plants', plantId)

  await updateDoc(ref, {
    lastWateredAt: Timestamp.fromDate(now),
    lastWatered: Timestamp.fromDate(now),
    nextWaterDue: nextDue,
    totalWaterCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  await addDoc(collection(db, 'groups', groupId, 'watering_log'), {
    groupId,
    plantId,
    wateredAt: serverTimestamp(),
  })
}

/**
 * Watering history for one plant within a group (newest first, client-sorted).
 */
export function subscribeWateringLogForPlant(groupId, plantId, onData, onError) {
  const db = getDb()
  if (!db) {
    onData([])
    return () => {}
  }
  const q = query(
    collection(db, 'groups', groupId, 'watering_log'),
    where('plantId', '==', plantId),
    limit(60),
  )
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      rows.sort((a, b) => {
        const ta = a.wateredAt?.toMillis?.() ?? 0
        const tb = b.wateredAt?.toMillis?.() ?? 0
        return tb - ta
      })
      onData(rows)
    },
    (err) => onError?.(err),
  )
}

const GROUP_SETTINGS_DOC = 'main'

/**
 * Optional per-group settings / location note: `groups/{groupId}/settings/main`
 * @param {string} groupId
 * @param {(data: object | null) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function subscribeGroupSettingsMain(groupId, onData, onError) {
  const db = getDb()
  if (!db) {
    onData(null)
    return () => {}
  }
  const ref = doc(db, 'groups', groupId, 'settings', GROUP_SETTINGS_DOC)
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      onData({ id: snap.id, groupId, ...snap.data() })
    },
    (err) => onError?.(err),
  )
}

/**
 * @param {string} groupId
 * @param {Record<string, unknown>} patch
 */
export async function updateGroupSettingsMain(groupId, patch) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  const ref = doc(db, 'groups', groupId, 'settings', GROUP_SETTINGS_DOC)
  const clean = { ...patch, groupId, updatedAt: serverTimestamp() }
  delete clean.id
  for (const k of Object.keys(clean)) {
    if (clean[k] === undefined) delete clean[k]
  }
  await setDoc(ref, clean, { merge: true })
}
