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
import { generateCareRecommendation, normalizePlantName } from '../lib/plantCareRules'

function isFirebaseConfigured() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_API_KEY,
  )
}

function careFromNormalizedAi(normalized) {
  return {
    type: normalized.typeLabel,
    wateringIntervalDays: normalized.wateringIntervalDays,
    wateringFrequencyDays: normalized.wateringIntervalDays,
    waterAmountText: normalized.waterAmountText,
    waterAmount: normalized.waterAmountText,
    howToWaterText: normalized.howToWaterText,
    wateringMethod: normalized.howToWaterText,
    warningSignsText: normalized.warningSignsText,
    warningSign: normalized.warningSignsText,
    careMatchQuality: normalized.careMatchQuality,
    scheduleNote: normalized.scheduleNote,
    nextWaterDue: timestampFromDate(normalized.nextWateringAt),
  }
}

function careDocumentFields(payload, lastWateredAt, meta = {}) {
  const care = generateCareRecommendation({
    plantName: payload.name,
    environment: payload.location,
    potSize: payload.potSize || '',
    sceneType: payload.sceneType,
    matchKind: payload.matchKind,
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

/** Slug for detectedType when using rules-only path */
function slugFromName(name) {
  return normalizePlantName(name).replace(/\s+/g, '_').slice(0, 48) || 'plant'
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
      const {
        aiNormalized,
        aiCorrectedByUser = false,
        aiSuggestedDisplayName,
        aiFallback = false,
        ...rest
      } = payload

      const useAiCare = !!(aiNormalized && !aiCorrectedByUser)
      const care = useAiCare
        ? careFromNormalizedAi(aiNormalized)
        : careDocumentFields(rest, null, {
            jitterKey: rest.name,
            jitterEventIndex: 0,
          })

      const n = aiNormalized

      await createPlant({
        groupId,
        name: rest.name,
        location: rest.location,
        potSize: rest.potSize ?? '',
        imageUrl: rest.imageUrl ?? null,
        lastWatered: null,
        notes: '',
        totalWaterCount: 0,
        ...care,
        displayName: rest.name,
        detectedType: useAiCare
          ? n.detectedType
          : slugFromName(rest.name),
        matchKind: useAiCare ? n.matchKind : 'specific',
        sceneType: useAiCare ? n.sceneType : 'single_plant',
        confidence: useAiCare ? n.confidence : null,
        aiGenerated: Boolean(n),
        aiCorrectedByUser: Boolean(aiCorrectedByUser && n),
        aiSuggestedDisplayName: aiSuggestedDisplayName ?? n?.displayName ?? null,
        fallbackUsed: n ? n.fallbackUsed : aiFallback,
      })
    },
    [groupId],
  )

  const updatePlant = useCallback(
    async (id, payload) => {
      const {
        lastWateredAtForCare,
        totalWaterCountForCare,
        aiCorrectedByUser: aiCorrectedFlag,
        ...rest
      } = payload

      const care = careDocumentFields(rest, lastWateredAtForCare ?? null, {
        jitterKey: id,
        jitterEventIndex: totalWaterCountForCare ?? 0,
      })

      const corrected =
        aiCorrectedFlag === true || rest.aiCorrectedByUser === true

      await savePlant(id, {
        name: rest.name,
        location: rest.location,
        potSize: rest.potSize ?? '',
        imageUrl: rest.imageUrl ?? null,
        groupId,
        displayName: rest.displayName ?? rest.name,
        ...care,
        detectedType: slugFromName(rest.name),
        matchKind: 'specific',
        sceneType: 'single_plant',
        confidence: null,
        ...(corrected ? { aiCorrectedByUser: true } : {}),
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
