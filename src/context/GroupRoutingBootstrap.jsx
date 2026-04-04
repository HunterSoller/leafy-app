import { useLayoutEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  isValidGroupId,
  parseGroupIdFromPathname,
  rememberLastGroupId,
} from '../lib/groupRoutes'
import { GroupRouteContext } from './groupRouteContext'

/**
 * Syncs active group with the hash route, persists `leafy_group_id`, and exposes
 * context so hash changes swap groups without stale UI.
 */
export function GroupRoutingBootstrap({ children }) {
  const location = useLocation()

  const activeGroupId = useMemo(() => {
    const raw = parseGroupIdFromPathname(location.pathname)
    if (!raw || !isValidGroupId(raw)) return null
    return raw
  }, [location.pathname])

  useLayoutEffect(() => {
    if (activeGroupId) rememberLastGroupId(activeGroupId)
  }, [activeGroupId])

  const value = useMemo(
    () => ({
      activeGroupId,
      pathname: location.pathname,
      locationKey: location.key,
    }),
    [activeGroupId, location.pathname, location.key],
  )

  return (
    <GroupRouteContext.Provider value={value}>{children}</GroupRouteContext.Provider>
  )
}
