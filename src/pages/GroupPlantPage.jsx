import { useNavigate, useParams } from 'react-router-dom'
import { isValidGroupId } from '../lib/groupRoutes'
import { useGroupPlant } from '../hooks/useGroupPlant'
import { NfcSetupFlow } from '../nfc/NfcSetupFlow'
import { NfcPlantDashboard } from '../nfc/NfcPlantDashboard'
import { GroupInvalid } from './GroupDashboardPage'

function RouteLoading() {
  return (
    <div className="nfc-shell nfc-loading">
      <div className="nfc-loading-dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p className="nfc-loading-text">Opening your plant…</p>
    </div>
  )
}

function PlantInvalid() {
  return (
    <div className="nfc-shell nfc-setup">
      <div className="nfc-setup-card">
        <span className="nfc-brand-leaf" aria-hidden>
          🌿
        </span>
        <h1 className="nfc-title">Plant not found</h1>
        <p className="nfc-lede">
          This plant link isn’t valid or the plant was removed. Open your group
          dashboard from the NFC tag and pick a plant from the list.
        </p>
      </div>
    </div>
  )
}

function isLikelyFirestorePlantId(s) {
  if (typeof s !== 'string') return false
  const t = s.trim()
  return t.length >= 6 && t.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(t)
}

export function GroupPlantPage() {
  const { groupId: gRaw, plantId: pRaw } = useParams()
  const groupId = gRaw?.trim() ?? ''
  const plantId = pRaw?.trim() ?? ''
  const navigate = useNavigate()

  const groupOk = isValidGroupId(groupId)
  const plantOk = isLikelyFirestorePlantId(plantId)

  const { plant, loading, updatePlant, resetPlant, waterPlant   } = useGroupPlant(
    groupOk && plantOk ? groupId : null,
    groupOk && plantOk ? plantId : null,
  )

  if (!groupOk) {
    return <GroupInvalid />
  }

  if (!plantOk) {
    return <PlantInvalid />
  }

  if (loading) {
    return <RouteLoading />
  }

  if (plant == null) {
    return <PlantInvalid />
  }

  return (
    <NfcPlantDashboard
      key={`${groupId}-${plantId}`}
      groupId={groupId}
      plant={plant}
      waterPlant={waterPlant}
      updatePlant={updatePlant}
      resetPlant={async () => {
        await resetPlant()
        navigate(`/group/${encodeURIComponent(groupId)}`, { replace: true })
      }}
    />
  )
}
