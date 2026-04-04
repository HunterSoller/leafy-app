import { Navigate, useParams } from 'react-router-dom'
import { GroupInvalid } from './GroupDashboardPage'
import { isValidGroupId } from '../lib/groupRoutes'

/**
 * Old hash bookmark: #/plant/:id → same id as a group slug (one tag ≈ one group).
 */
export function LegacyPlantToGroupRedirect() {
  const { legacyId: raw } = useParams()
  const legacyId = raw?.trim() ?? ''

  if (!isValidGroupId(legacyId)) {
    return <GroupInvalid />
  }

  return (
    <Navigate
      to={`/group/${encodeURIComponent(legacyId)}`}
      replace
    />
  )
}
