import { useCallback, useEffect, useState } from 'react'
import {
  subscribeGroupSettings,
  saveGroupLocation as persistGroupLocation,
} from '../lib/firebase'
import { useGroupId } from './useGroupId'

export function useGroupSettings() {
  const groupId = useGroupId()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeGroupSettings(
      groupId,
      (docSnap) => {
        setData(docSnap)
        setLoading(false)
      },
      () => {
        setLoading(false)
      },
    )
    return unsub
  }, [groupId])

  const hasSavedLocation = Boolean(
    data &&
      data.location_lat != null &&
      data.location_lng != null &&
      !Number.isNaN(Number(data.location_lat)) &&
      !Number.isNaN(Number(data.location_lng)),
  )

  const saveLocation = useCallback(
    async (fields) => {
      await persistGroupLocation(groupId, fields)
      setData({
        location_lat: fields.location_lat,
        location_lng: fields.location_lng,
        location_label: fields.location_label ?? '',
        location_source:
          fields.location_source === 'browser' ? 'browser' : 'manual',
      })
    },
    [groupId],
  )

  return { settings: data, loading, hasSavedLocation, saveLocation }
}
