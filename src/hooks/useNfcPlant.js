import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  subscribeNfcPlant,
  createNfcPlantDocument,
  updateNfcPlantDocument,
  deleteNfcPlantDocument,
  recordNfcPlantWatering,
} from '../lib/firebase'

function isFirebaseConfigured() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_API_KEY,
  )
}

/**
 * Single plant bound to one NFC tag id (Firestore doc id).
 */
export function useNfcPlant(tagId) {
  const configured = useMemo(() => isFirebaseConfigured(), [])
  const [plant, setPlant] = useState(undefined)
  const [error, setError] = useState(null)
  const [hasRemote, setHasRemote] = useState(false)

  useEffect(() => {
    if (!configured || !tagId) {
      setPlant(null)
      setHasRemote(true)
      setError(null)
      return undefined
    }

    setHasRemote(false)
    const unsub = subscribeNfcPlant(
      tagId,
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
  }, [tagId, configured])

  const loading = configured && !hasRemote

  const createPlant = useCallback(
    async (payload) => {
      await createNfcPlantDocument(tagId, payload)
    },
    [tagId],
  )

  const updatePlant = useCallback(
    async (patch) => {
      await updateNfcPlantDocument(tagId, patch)
    },
    [tagId],
  )

  const resetPlant = useCallback(async () => {
    await deleteNfcPlantDocument(tagId)
  }, [tagId])

  const waterPlant = useCallback(
    async (wateringIntervalDays) => {
      await recordNfcPlantWatering(tagId, wateringIntervalDays)
    },
    [tagId],
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
