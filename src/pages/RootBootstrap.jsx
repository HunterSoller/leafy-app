import { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { readStoredLastGroupId, isValidGroupId } from '../lib/groupRoutes'
import { HomeRoute } from './HomeRoute'

function RouteLoading({ message }) {
  return (
    <div className="nfc-shell nfc-loading">
      <div className="nfc-loading-dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p className="nfc-loading-text">{message}</p>
    </div>
  )
}

function readPlantQueryGroupId() {
  try {
    const p = new URLSearchParams(window.location.search).get('plant')
    const t = p?.trim()
    if (t && isValidGroupId(t)) return t
  } catch {
    /* ignore */
  }
  return null
}

/**
 * `#/` only: `?plant=` (legacy) → group route, else last `leafy_group_id`, else landing.
 */
export function RootBootstrap() {
  const navigate = useNavigate()

  const plantFromQuery = readPlantQueryGroupId()
  const stored = readStoredLastGroupId()
  const willRedirectQuery = Boolean(plantFromQuery)
  const willRedirectStorage = Boolean(!plantFromQuery && stored && isValidGroupId(stored))

  useLayoutEffect(() => {
    if (plantFromQuery) {
      navigate(`/group/${encodeURIComponent(plantFromQuery)}`, { replace: true })
      return
    }
    if (willRedirectStorage && stored) {
      navigate(`/group/${encodeURIComponent(stored)}`, { replace: true })
    }
  }, [navigate, plantFromQuery, willRedirectStorage, stored])

  if (willRedirectQuery || willRedirectStorage) {
    return <RouteLoading message="Opening Leafy…" />
  }

  return <HomeRoute />
}
