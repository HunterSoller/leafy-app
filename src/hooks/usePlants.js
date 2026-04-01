import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import {
  subscribePlants,
  createPlant,
  savePlant,
  removePlant,
  recordWatering,
  timestampFromDate,
} from '../lib/firebase'
import { useGroupId } from './useGroupId'
import { addCalendarDaysNY } from '../lib/wateringLogic'
import { initialHydrationForNewPlant } from '../lib/hydrationModel'
import {
  generateCareRecommendation,
  normalizePlantName,
  computeJitterDays,
} from '../lib/plantCareRules'
import { clampWateringIntervalDays } from '../lib/normalizeAiPlantResult'
import {
  readCachedPlantsList,
  writeCachedPlantsList,
} from '../lib/plantsLocalCache'

function isFirebaseConfigured() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_API_KEY,
  )
}

function careFromNormalizedAi(normalized, lastWateredAt) {
  const anchor =
    lastWateredAt instanceof Date
      ? lastWateredAt
      : lastWateredAt?.toDate?.() ?? null
  const base = anchor ?? new Date()
  const jitter = computeJitterDays(normalized.detectedType || 'ai', 0)
  const nextWateringAt = addCalendarDaysNY(
    base,
    normalized.wateringIntervalDays + jitter,
  )
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
    nextWaterDue: timestampFromDate(nextWateringAt),
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

function mergeAiNormalizedForSave(raw, overrides = {}) {
  if (!raw) return null
  const env = overrides.location === 'outdoor' ? 'outdoor' : 'indoor'
  const intervalSrc =
    typeof overrides.wateringIntervalDaysOverride === 'number' &&
    !Number.isNaN(overrides.wateringIntervalDaysOverride)
      ? overrides.wateringIntervalDaysOverride
      : raw.wateringIntervalDays
  const wateringIntervalDays = clampWateringIntervalDays(
    intervalSrc,
    raw.sceneType,
    env,
  )
  let detectedType = raw.detectedType
  if (
    overrides.detectedTypeOverride &&
    String(overrides.detectedTypeOverride).trim()
  ) {
    detectedType = slugFromName(String(overrides.detectedTypeOverride).trim())
  }
  let typeLabel = raw.typeLabel
  if (overrides.typeLabelOverride && String(overrides.typeLabelOverride).trim()) {
    typeLabel = String(overrides.typeLabelOverride).trim().slice(0, 80)
  }
  return { ...raw, wateringIntervalDays, detectedType, typeLabel }
}

export function usePlants() {
  const groupId = useGroupId()
  const configured = useMemo(() => isFirebaseConfigured(), [])

  const [plants, setPlants] = useState([])
  const [hasRemoteSync, setHasRemoteSync] = useState(false)
  const [error, setError] = useState(null)

  useLayoutEffect(() => {
    startTransition(() => {
      if (!configured) {
        setPlants([])
        setHasRemoteSync(true)
        setError(null)
        return
      }
      const cached = readCachedPlantsList(groupId)
      setPlants(cached ?? [])
      setHasRemoteSync(false)
      setError(null)
    })
  }, [configured, groupId])

  useEffect(() => {
    if (!configured) return undefined

    const unsub = subscribePlants(
      groupId,
      (list) => {
        setPlants(list)
        writeCachedPlantsList(groupId, list)
        setHasRemoteSync(true)
        setError(null)
      },
      (err) => {
        setError(err)
        setHasRemoteSync(true)
      },
    )
    return unsub
  }, [configured, groupId])

  const loading = configured && !hasRemoteSync && plants.length === 0

  const addPlant = useCallback(
    async (payload) => {
      const {
        aiNormalized,
        aiCorrectedByUser = false,
        aiSuggestedDisplayName,
        aiFallback = false,
        lastWateredAt: lastWateredRaw,
        wateringIntervalDaysOverride,
        detectedTypeOverride,
        typeLabelOverride,
        scientificName,
        ...rest
      } = payload

      const lastWateredDate =
        lastWateredRaw instanceof Date
          ? lastWateredRaw
          : lastWateredRaw
            ? new Date(lastWateredRaw)
            : null
      const lastTs = lastWateredDate
        ? timestampFromDate(lastWateredDate)
        : null

      const useAiCare = Boolean(aiNormalized && !aiFallback)
      const nMerged =
        useAiCare
          ? mergeAiNormalizedForSave(aiNormalized, {
              location: rest.location,
              wateringIntervalDaysOverride,
              detectedTypeOverride,
              typeLabelOverride,
            })
          : null

      const care = useAiCare
        ? careFromNormalizedAi(nMerged, lastWateredDate)
        : careDocumentFields(rest, lastWateredDate, {
            jitterKey: rest.name,
            jitterEventIndex: 0,
          })

      const outdoorContainer =
        rest.location === 'outdoor' &&
        String(rest.potSize || '').trim().length > 0 &&
        (useAiCare
          ? nMerged.matchKind !== 'area' &&
            nMerged.sceneType !== 'garden_area' &&
            nMerged.sceneType !== 'multiple_plants'
          : true)

      const initWater = initialHydrationForNewPlant({
        lastWateredDate,
        intervalDays: care.wateringIntervalDays,
        location: rest.location,
        weather: null,
        outdoorContainer,
      })

      const sci = String(scientificName ?? '').trim()
      const aiSci = String(aiNormalized?.scientificName ?? '').trim()

      await createPlant({
        groupId,
        name: rest.name,
        location: rest.location,
        potSize: rest.potSize ?? '',
        imageUrl: rest.imageUrl ?? null,
        lastWatered: lastTs,
        notes: '',
        totalWaterCount: 0,
        hydrationScore: initWater,
        waterLevel: initWater,
        rainMmBalanceSnapshot: 0,
        ...care,
        displayName: rest.name,
        scientificName: sci,
        aiIdentifiedScientificName: useAiCare && aiSci ? aiSci : null,
        detectedType: useAiCare
          ? nMerged.detectedType
          : slugFromName(rest.name),
        matchKind: useAiCare ? nMerged.matchKind : 'specific',
        sceneType: useAiCare ? nMerged.sceneType : 'single_plant',
        confidence: useAiCare ? nMerged.confidence : null,
        aiGenerated: Boolean(aiNormalized),
        aiCorrectedByUser: Boolean(aiCorrectedByUser && aiNormalized),
        aiSuggestedDisplayName:
          aiSuggestedDisplayName ?? aiNormalized?.displayName ?? null,
        fallbackUsed: aiNormalized ? aiNormalized.fallbackUsed : aiFallback,
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
        _preserveFrom: preserve,
        ...rest
      } = payload

      const corrected =
        aiCorrectedFlag === true || rest.aiCorrectedByUser === true

      const newName = String(rest.name || '').trim()
      const oldName = preserve ? String(preserve.name || '').trim() : ''
      const slugChanged =
        Boolean(preserve) && slugFromName(oldName) !== slugFromName(newName)

      const envOrPotChanged =
        Boolean(preserve) &&
        ((preserve.location || '') !== (rest.location || '') ||
          String(preserve.potSize ?? '') !== String(rest.potSize ?? ''))

      const isAreaPlant =
        preserve &&
        (preserve.sceneType === 'garden_area' ||
          preserve.sceneType === 'multiple_plants' ||
          preserve.matchKind === 'area' ||
          preserve.careMatchQuality === 'area')

      const shouldRegenerateCare =
        !preserve ||
        envOrPotChanged ||
        (slugChanged &&
          preserve.sceneType === 'single_plant' &&
          preserve.matchKind === 'specific')

      const doc = {
        name: newName,
        location: rest.location,
        potSize: rest.potSize ?? '',
        imageUrl: rest.imageUrl ?? null,
        groupId,
        displayName: rest.displayName ?? newName,
        ...(corrected ? { aiCorrectedByUser: true } : {}),
      }

      if (!shouldRegenerateCare) {
        await savePlant(id, doc)
        return
      }

      const care = careDocumentFields(
        {
          ...rest,
          name: newName,
          sceneType: preserve?.sceneType ?? 'single_plant',
          matchKind: preserve?.matchKind ?? 'specific',
        },
        lastWateredAtForCare ?? null,
        { jitterKey: id, jitterEventIndex: totalWaterCountForCare ?? 0 },
      )

      const nextDetected =
        isAreaPlant && preserve?.detectedType
          ? preserve.detectedType
          : slugFromName(newName)

      await savePlant(id, {
        ...doc,
        ...care,
        detectedType: nextDetected,
        matchKind: preserve?.matchKind ?? 'specific',
        sceneType: preserve?.sceneType ?? 'single_plant',
        confidence: preserve ? preserve.confidence ?? null : null,
        aiGenerated: preserve?.aiGenerated ?? false,
        aiSuggestedDisplayName: preserve?.aiSuggestedDisplayName ?? null,
        fallbackUsed: preserve?.fallbackUsed ?? false,
        type: preserve?.type ?? care.detectedType,
      })
    },
    [groupId],
  )

  const deletePlant = useCallback(async (id) => {
    await removePlant(id)
  }, [])

  const waterPlant = useCallback(async (plant, options = {}) => {
    await recordWatering(plant, options.outdoorDelayDays ?? 0, {
      rainMmSnapshot: options.rainMmSnapshot,
    })
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    plants,
    loading,
    error,
    clearError,
    configured,
    groupId,
    addPlant,
    updatePlant,
    deletePlant,
    waterPlant,
  }
}
