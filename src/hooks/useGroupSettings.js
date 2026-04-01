import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  subscribeGroupSettings,
  saveGroupLocation as persistGroupLocation,
} from '../lib/firebase'
import { normalizeStoredGroupId } from '../lib/group'
import { readLocalGroupSettings } from '../lib/groupLocalSettings'
import { useGroupId } from './useGroupId'

function hasValidLocation(data) {
  if (!data) return false
  const la = Number(data.location_lat)
  const ln = Number(data.location_lng)
  return !Number.isNaN(la) && !Number.isNaN(ln)
}

/**
 * Per-group forecast location. Boots from localStorage until the first Firestore snapshot for this group.
 */
export function useGroupSettings() {
  const groupId = useGroupId()
  const id = useMemo(() => normalizeStoredGroupId(groupId), [groupId])
  const bootSettings = useMemo(() => readLocalGroupSettings(id), [id])

  const [lastRemote, setLastRemote] = useState({ groupId: null, data: null })

  useEffect(() => {
    const unsub = subscribeGroupSettings(groupId, (docSnap) => {
      setLastRemote({ groupId, data: docSnap })
    })
    return unsub
  }, [groupId])

  const synced = lastRemote.groupId === groupId
  const settings = synced ? lastRemote.data : bootSettings
  const loading = !synced && !hasValidLocation(bootSettings)

  const hasSavedLocation = hasValidLocation(settings)

  const saveLocation = useCallback(
    async (fields) => {
      await persistGroupLocation(groupId, fields)
      const payload = {
        location_lat: fields.location_lat,
        location_lng: fields.location_lng,
        location_label: fields.location_label ?? '',
        location_source:
          fields.location_source === 'browser' ? 'browser' : 'manual',
      }
      setLastRemote({ groupId, data: payload })
    },
    [groupId],
  )

  return { settings, loading, hasSavedLocation, saveLocation }
}
