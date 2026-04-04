import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isValidGroupId } from '../lib/groupRoutes'
import { useGroupPlant } from '../hooks/useGroupPlant'
import { NfcSetupFlow } from '../nfc/NfcSetupFlow'
import { GroupInvalid } from './GroupDashboardPage'

export function GroupSetupPage() {
  const { groupId: raw } = useParams()
  const groupId = raw?.trim() ?? ''
  const navigate = useNavigate()
  const ok = isValidGroupId(groupId)

  const { configured, createPlant } = useGroupPlant(ok ? groupId : null, null)

  const onCreated = useCallback(
    async (newPlantId) => {
      if (newPlantId) {
        navigate(
          `/group/${encodeURIComponent(groupId)}/plant/${encodeURIComponent(newPlantId)}`,
          { replace: true },
        )
        return
      }
      navigate(`/group/${encodeURIComponent(groupId)}`, { replace: true })
    },
    [groupId, navigate],
  )

  if (!ok) {
    return <GroupInvalid />
  }

  return (
    <NfcSetupFlow
      key={groupId}
      configured={configured}
      createPlant={createPlant}
      onCreated={onCreated}
    />
  )
}
