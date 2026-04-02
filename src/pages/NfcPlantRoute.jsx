import { useParams } from 'react-router-dom'
import { isValidNfcTagId } from '../lib/nfcTag'
import { useNfcPlant } from '../hooks/useNfcPlant'
import { NfcSetupFlow } from '../nfc/NfcSetupFlow'
import { NfcPlantDashboard } from '../nfc/NfcPlantDashboard'

function NfcLoading() {
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

function NfcBadLink() {
  return (
    <div className="nfc-shell nfc-setup">
      <div className="nfc-setup-card">
        <span className="nfc-brand-leaf" aria-hidden>
          🌿
        </span>
        <h1 className="nfc-title">Link not valid</h1>
        <p className="nfc-lede">
          This URL doesn’t look like a Leafy plant tag. Check the link or scan
          the tag again.
        </p>
      </div>
    </div>
  )
}

export function NfcPlantRoute() {
  const { tagId: raw } = useParams()
  const tagId = raw?.trim() ?? ''
  const tagOk = isValidNfcTagId(tagId)

  const {
    plant,
    loading,
    configured,
    createPlant,
    updatePlant,
    resetPlant,
    waterPlant,
  } = useNfcPlant(tagOk ? tagId : null)

  if (!tagOk) {
    return <NfcBadLink />
  }

  if (loading) {
    return <NfcLoading />
  }

  if (plant == null) {
    return (
      <NfcSetupFlow
        configured={configured}
        createPlant={createPlant}
        onCreated={() => {}}
      />
    )
  }

  return (
    <NfcPlantDashboard
      plant={plant}
      waterPlant={waterPlant}
      updatePlant={updatePlant}
      resetPlant={resetPlant}
    />
  )
}

export function HomeRoute() {
  return (
    <div className="nfc-shell nfc-setup">
      <div className="nfc-setup-card nfc-fade-in">
        <span className="nfc-brand-leaf" aria-hidden>
          🌿
        </span>
        <h1 className="nfc-title">Leafy</h1>
        <p className="nfc-lede">
          Open Leafy from your plant’s NFC tag. Each tag opens its own plant
          page — nothing to set up here.
        </p>
      </div>
    </div>
  )
}
