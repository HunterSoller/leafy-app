import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  subscribePlants,
  createPlant,
  savePlant,
  removePlant,
  recordWatering,
  timestampFromDate,
} from '../lib/firebase'
import { useGroupId } from './useGroupId'
import { generateCareRecommendation } from '../lib/plantCareRules'

function isFirebaseConfigured() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_API_KEY,
  )
}

function careDocumentFields(payload, lastWateredAt, meta = {}) {
  const care = generateCareRecommendation({
    plantName: payload.name,
    environment: payload.location,
    potSize: payload.potSize || 'M',
    lastWateredAt,
    jitterKey: meta.jitterKey ?? payload.name,
    jitterEventIndex: meta.jitterEventIndex ?? 0,
  })
  return {
    type: care.detectedType,
    wateringIntervalDays: care.wateringIntervalDays,
    wateringFrequencyDays: care.wateringIntervalDays,
    waterAmountText: care.waterAmountText,
    waterAmount: care.waterAmountText,
    howToWaterText: care.howToWaterText,
    wateringMethod: care.howToWaterText,
    warningSignsText: care.warningSignsText,
    warningSign: care.warningSignsText,
    careMatchQuality: care.careMatchQuality,
    scheduleNote: care.scheduleNote,
    nextWaterDue: timestampFromDate(care.nextWateringAt),
  }
}

export function usePlants() {
  const groupId = useGroupId()
  const configured = useMemo(() => isFirebaseConfigured(), [])
  const [plants, setPlants] = useState([])
  const [loading, setLoading] = useState(() => configured)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!configured) return undefined

    const unsub = subscribePlants(
      groupId,
      (list) => {
        setPlants(list)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsub
  }, [configured, groupId])

  const addPlant = useCallback(
    async (payload) => {
      const care = careDocumentFields(payload, null, {
        jitterKey: payload.name,
        jitterEventIndex: 0,
      })
      await createPlant({
        groupId,
        name: payload.name,
        location: payload.location,
        potSize: payload.potSize || 'M',
        imageUrl: payload.imageUrl ?? null,
        lastWatered: null,
        notes: '',
        totalWaterCount: 0,
        ...care,
      })
    },
    [groupId],
  )

  const updatePlant = useCallback(
    async (id, payload) => {
      const { lastWateredAtForCare, totalWaterCountForCare, ...rest } = payload
      const care = careDocumentFields(rest, lastWateredAtForCare ?? null, {
        jitterKey: id,
        jitterEventIndex: totalWaterCountForCare ?? 0,
      })
      await savePlant(id, {
        name: rest.name,
        location: rest.location,
        potSize: rest.potSize || 'M',
        imageUrl: rest.imageUrl ?? null,
        groupId,
        ...care,
      })
    },
    [groupId],
  )

  const deletePlant = useCallback(async (id) => {
    await removePlant(id)
  }, [])

  const waterPlant = useCallback(async (plant, outdoorDelayDays) => {
    await recordWatering(plant, outdoorDelayDays)
  }, [])

  return {
    plants,
    loading,
    error,
    configured,
    groupId,
    addPlant,
    updatePlant,
    deletePlant,
    waterPlant,
  }
}
