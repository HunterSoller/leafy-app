import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  subscribeGroupPlant,
  createGroupPlantDocument,
  updateGroupPlantDocument,
  deleteGroupPlantDocument,
  recordGroupPlantWatering,
} from '../lib/firebase'

function isFirebaseConfigured() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_API_KEY,
  )
}

/**
 * One plant in `groups/{groupId}/plants/{plantId}`.
 * @param {string | null} groupId
 * @param {string | null} plantId - null: no subscription (e.g. idle create hook not used — create still needs groupId)
 */
export function useGroupPlant(groupId, plantId) {
  const configured = useMemo(() => isFirebaseConfigured(), [])
  const [plant, setPlant] = useState(undefined)
  const [error, setError] = useState(null)
  const [hasRemote, setHasRemote] = useState(() => !groupId || !plantId)

  useEffect(() => {
    if (!configured || !groupId || !plantId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when ids absent
      setPlant(null)
      setHasRemote(true)
      setError(null)
      return undefined
    }

    setHasRemote(false)
    const unsub = subscribeGroupPlant(
      groupId,
      plantId,
      (data) => {
        setPlant(data)
        setHasRemote(true)
        setError(null)
      },
      (err) => {
        setError(err)
        setHasRemote(true)
      },
    )
    return unsub
  }, [groupId, plantId, configured])

  const loading = Boolean(configured && groupId && plantId && !hasRemote)

  const createPlant = useCallback(
    async (payload) => {
      if (!groupId) throw new Error('No group')
      return createGroupPlantDocument(groupId, payload)
    },
    [groupId],
  )

  const updatePlant = useCallback(
    async (patch) => {
      if (!groupId || !plantId) throw new Error('No plant')
      await updateGroupPlantDocument(groupId, plantId, patch)
    },
    [groupId, plantId],
  )

  const resetPlant = useCallback(async () => {
    if (!groupId || !plantId) throw new Error('No plant')
    await deleteGroupPlantDocument(groupId, plantId)
  }, [groupId, plantId])

  const waterPlant = useCallback(
    async (wateringIntervalDays) => {
      if (!groupId || !plantId) throw new Error('No plant')
      await recordGroupPlantWatering(groupId, plantId, wateringIntervalDays)
    },
    [groupId, plantId],
  )

  return {
    plant,
    loading,
    error,
    configured,
    createPlant,
    updatePlant,
    resetPlant,
    waterPlant,
  }
}
