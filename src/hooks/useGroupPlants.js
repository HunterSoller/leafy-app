import { useEffect, useMemo, useState } from 'react'
import { subscribeGroupPlants } from '../lib/firebase'

function isFirebaseConfigured() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_API_KEY,
  )
}

/**
 * Live list of plants in `groups/{groupId}/plants`.
 * @param {string | null} groupId
 */
export function useGroupPlants(groupId) {
  const configured = useMemo(() => isFirebaseConfigured(), [])
  const [plants, setPlants] = useState(undefined)
  const [error, setError] = useState(null)
  const [hasRemote, setHasRemote] = useState(() => !groupId)

  useEffect(() => {
    if (!configured || !groupId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlants([])
      setHasRemote(true)
      setError(null)
      return undefined
    }

    setHasRemote(false)
    const unsub = subscribeGroupPlants(
      groupId,
      (rows) => {
        setPlants(rows)
        setHasRemote(true)
        setError(null)
      },
      (err) => {
        setError(err)
        setHasRemote(true)
      },
    )
    return unsub
  }, [groupId, configured])

  const loading = Boolean(configured && groupId && !hasRemote)

  return { plants, loading, error, configured }
}
