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
  const [hasRemote, setHasRemote] = useState(() => !tagId)

  useEffect(() => {
    if (!configured || !tagId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when tag or config is absent
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

  const loading = Boolean(configured && tagId && !hasRemote)

  const createPlant = useCallback(
    async (payload) => {
      if (!tagId) throw new Error('No plant tag')
      await createNfcPlantDocument(tagId, payload)
    },
    [tagId],
  )

  const updatePlant = useCallback(
    async (patch) => {
      if (!tagId) throw new Error('No plant tag')
      await updateNfcPlantDocument(tagId, patch)
    },
    [tagId],
  )

  const resetPlant = useCallback(async () => {
    if (!tagId) throw new Error('No plant tag')
    await deleteNfcPlantDocument(tagId)
  }, [tagId])

  const waterPlant = useCallback(
    async (wateringIntervalDays) => {
      if (!tagId) throw new Error('No plant tag')
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
