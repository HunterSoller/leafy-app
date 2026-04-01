import { useSyncExternalStore } from 'react'
import { DEFAULT_GROUP_ID, getGroupId } from '../lib/group'

function subscribe(onChange) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

/**
 * Current group from ?group=… (falls back to default-group). Updates on popstate.
 */
export function useGroupId() {
  return useSyncExternalStore(subscribe, getGroupId, () => DEFAULT_GROUP_ID)
}
