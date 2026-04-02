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

/**
 * Real-time subscription: one plant document per NFC tag at `plants/{tagId}`.
 * @param {string} tagId
 * @param {(data: object | null) => void} onData - null if document missing
 * @param {(err: Error) => void} [onError]
 */
export function subscribeNfcPlant(tagId, onData, onError) {
  const db = getDb()
  if (!db) {
    onData(null)
    return () => {}
  }

  const ref = doc(db, 'plants', tagId)
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      onData({ id: tagId, tagId, ...snap.data() })
    },
    (err) => onError?.(err),
  )
}

/**
 * First-time setup: create the plant record for this tag (document id = tagId).
 */
export async function createNfcPlantDocument(tagId, payload) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')

  const now = serverTimestamp()
  const interval = Math.max(
    1,
    Math.min(30, Math.round(Number(payload.wateringIntervalDays)) || 7),
  )

  await setDoc(
    doc(db, 'plants', tagId),
    {
      tagId,
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
    },
    { merge: false },
  )
}

export async function updateNfcPlantDocument(tagId, patch) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  const ref = doc(db, 'plants', tagId)
  const clean = { ...patch, updatedAt: serverTimestamp() }
  delete clean.id
  delete clean.tagId
  delete clean.createdAt
  for (const k of Object.keys(clean)) {
    if (clean[k] === undefined) delete clean[k]
  }
  await updateDoc(ref, clean)
}

export async function deleteNfcPlantDocument(tagId) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  await deleteDoc(doc(db, 'plants', tagId))
}

/**
 * Log watering: updates timestamps and optional hydration-free fields.
 */
export async function recordNfcPlantWatering(tagId, wateringIntervalDays) {
  const db = getDb()
  if (!db) throw new Error('Firebase is not configured')
  const now = new Date()
  const interval = Math.max(1, Math.min(30, Math.round(Number(wateringIntervalDays)) || 7))
  const nextDue = addDaysTimestamp(now, interval)
  const ref = doc(db, 'plants', tagId)

  await updateDoc(ref, {
    lastWateredAt: Timestamp.fromDate(now),
    lastWatered: Timestamp.fromDate(now),
    nextWaterDue: nextDue,
    totalWaterCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  await addDoc(collection(db, 'watering_log'), {
    tagId,
    plantId: tagId,
    wateredAt: serverTimestamp(),
  })
}

/**
 * Recent watering events for this tag (newest first).
 */
export function subscribeWateringLogForTag(tagId, onData, onError) {
  const db = getDb()
  if (!db) {
    onData([])
    return () => {}
  }
  const q = query(
    collection(db, 'watering_log'),
    where('tagId', '==', tagId),
    limit(40),
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
