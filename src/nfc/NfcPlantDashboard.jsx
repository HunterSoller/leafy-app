import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getIndoorWateringStatus,
  formatLastWateredHuman,
  getStructuredCare,
  toJsDate,
} from '../lib/indoorWatering'
import { subscribeWateringLogForPlant } from '../lib/firebase'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  getProfileByCanonicalName,
  listProfilesForPicker,
  matchIndoorCareProfile,
  profileToFirestorePatch,
  INDOOR_PLANT_FALLBACK,
} from '../lib/plantCareProfiles'

function formatLogRow(row) {
  const t = row.wateredAt?.toDate?.() ?? row.wateredAt
  if (!t) return 'Watering logged'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(t instanceof Date ? t : new Date(t))
}

export function NfcPlantDashboard({
  groupId,
  plant,
  waterPlant,
  updatePlant,
  resetPlant,
}) {
  const [waterBusy, setWaterBusy] = useState(false)
  const [toast, setToast] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [log, setLog] = useState([])
  const [editName, setEditName] = useState(plant.displayName || plant.name || '')
  const [editCanonical, setEditCanonical] = useState(
    () =>
      plant.canonicalPlantName ||
      matchIndoorCareProfile([
        plant.identifiedPlantName,
        plant.type,
      ]).canonicalName,
  )
  const [saveBusy, setSaveBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [optimisticWateredAt, setOptimisticWateredAt] = useState(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setNow(new Date())
  }, [
    plant?.lastWateredAt,
    plant?.lastWatered,
    plant?.wateringIntervalDays,
  ])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  const effectivePlant = useMemo(() => {
    if (!optimisticWateredAt) return plant
    return {
      ...plant,
      lastWateredAt: optimisticWateredAt,
      lastWatered: optimisticWateredAt,
    }
  }, [plant, optimisticWateredAt])

  useEffect(() => {
    if (!optimisticWateredAt) return
    const server = toJsDate(plant.lastWateredAt ?? plant.lastWatered)
    if (!server) return
    // Firestore “now” can be slightly before the client tap; allow slack.
    if (server.getTime() >= optimisticWateredAt.getTime() - 120000) {
      setOptimisticWateredAt(null)
    }
  }, [plant, optimisticWateredAt])

  const status = useMemo(
    () => getIndoorWateringStatus(effectivePlant, now),
    [effectivePlant, now],
  )

  const care = useMemo(() => getStructuredCare(effectivePlant), [effectivePlant])

  const plantKey = plant.plantId || plant.id

  useEffect(() => {
    if (!historyOpen || !groupId || !plantKey) return undefined
    return subscribeWateringLogForPlant(
      groupId,
      plantKey,
      setLog,
      () => setLog([]),
    )
  }, [historyOpen, groupId, plantKey])

  useEffect(() => {
    setEditName(plant.displayName || plant.name || '')
    setEditCanonical(
      plant.canonicalPlantName ||
        matchIndoorCareProfile([plant.identifiedPlantName, plant.type])
          .canonicalName,
    )
  }, [plant])

  const onWater = useCallback(async () => {
    if (waterBusy) return
    const optimisticDate = new Date()
    setWaterBusy(true)
    setOptimisticWateredAt(optimisticDate)
    try {
      await waterPlant(plant.wateringIntervalDays ?? 7)
      setToast(true)
      window.setTimeout(() => setToast(false), 1050)
    } catch {
      setOptimisticWateredAt(null)
    } finally {
      setWaterBusy(false)
    }
  }, [waterBusy, waterPlant, plant.wateringIntervalDays])

  const saveEdit = useCallback(async () => {
    const name = editName.trim() || plant.identifiedPlantName || 'Plant'
    const prof =
      getProfileByCanonicalName(editCanonical) || {
        ...INDOOR_PLANT_FALLBACK,
        matchedFromFallback: true,
      }
    const patch = profileToFirestorePatch(prof)
    setSaveBusy(true)
    try {
      await updatePlant({
        customName: editName.trim(),
        displayName: name,
        name,
        ...patch,
        identifiedPlantName: prof.canonicalName,
        careLightLine: prof.lightBullets[0] || '',
        howToWaterText: prof.waterBullets[0] || plant.howToWaterText,
      })
      setEditOpen(false)
      setNow(new Date())
    } finally {
      setSaveBusy(false)
    }
  }, [editName, editCanonical, plant.howToWaterText, plant.identifiedPlantName, updatePlant])

  const doReset = useCallback(async () => {
    await resetPlant()
    setConfirmReset(false)
  }, [resetPlant])

  const typeLine =
    plant.canonicalPlantName ||
    plant.identifiedPlantName ||
    plant.type ||
    'Indoor plant'

  const lastWateredLine = formatLastWateredHuman(
    effectivePlant.lastWateredAt ?? effectivePlant.lastWatered,
    now,
  )

  return (
    <div className="nfc-shell nfc-plant">
      <header className="nfc-plant-header nfc-plant-header--row">
        <div className="nfc-plant-header-brand">
          <span className="nfc-brand-leaf" aria-hidden>
            🌿
          </span>
          <span className="nfc-brand-word">Leafy</span>
        </div>
        {groupId ? (
          <Link
            className="nfc-back-link"
            to={`/group/${encodeURIComponent(groupId)}`}
          >
            All plants
          </Link>
        ) : null}
      </header>

      <div className="nfc-plant-hero">
        {plant.imageUrl ? (
          <img
            src={plant.imageUrl}
            alt=""
            className="nfc-plant-hero-img"
          />
        ) : (
          <div className="nfc-plant-hero-placeholder" aria-hidden>
            🌿
          </div>
        )}
      </div>

      <div className="nfc-plant-body nfc-fade-in">
        <h1 className="nfc-plant-name">
          {plant.displayName || plant.name || 'Your plant'}
        </h1>
        <p className="nfc-plant-type">{typeLine}</p>
        {plant.careProfileFallback ? (
          <p className="nfc-plant-fallback-note">
            Matched as a general indoor plant — choose a closer type in Edit if you know it.
          </p>
        ) : null}

        <div
          className={`nfc-status-card nfc-status-card--${status.kind}`}
          role="status"
        >
          <span className="nfc-status-title">{status.title}</span>
          {status.subtitle ? (
            <span className="nfc-status-subtitle">{status.subtitle}</span>
          ) : null}
          <span className="nfc-status-soil">{status.soilHelper}</span>
        </div>

        <div className="nfc-plant-cta-wrap">
          <button
            type="button"
            className="nfc-btn nfc-btn-water"
            disabled={waterBusy}
            onClick={onWater}
          >
            {waterBusy ? 'Saving…' : 'I watered this plant'}
          </button>
        </div>

        <div className="nfc-divider" aria-hidden />

        <div className="nfc-meta-block">
          <p className="nfc-meta-line">{lastWateredLine}</p>
          <p className="nfc-meta-line nfc-meta-line--trust">
            Based on typical care for this plant — check soil before watering and adjust if
            it still feels moist.
          </p>
        </div>

        <div className="nfc-divider nfc-divider--light" aria-hidden />

        <section className="nfc-care-box">
          <h2 className="nfc-care-heading">Care</h2>
          <div className="nfc-care-section">
            <h3 className="nfc-care-label">Light</h3>
            <ul className="nfc-care-list">
              {care.lightBullets.map((line, i) => (
                <li key={`light-${i}`}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="nfc-care-section">
            <h3 className="nfc-care-label">Water</h3>
            <ul className="nfc-care-list">
              {care.waterBullets.map((line, i) => (
                <li key={`water-${i}`}>{line}</li>
              ))}
            </ul>
          </div>
          {care.extraBullets.length > 0 ? (
            <div className="nfc-care-section">
              <h3 className="nfc-care-label">Extra</h3>
              <ul className="nfc-care-list">
                {care.extraBullets.map((line, i) => (
                  <li key={`extra-${i}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <div className="nfc-secondary-actions">
          <button
            type="button"
            className="nfc-link-btn"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="nfc-link-btn"
            onClick={() => setHistoryOpen(true)}
          >
            History
          </button>
          <button
            type="button"
            className="nfc-link-btn nfc-link-btn--danger"
            onClick={() => setConfirmReset(true)}
          >
            Reset tag
          </button>
        </div>
      </div>

      {toast ? (
        <div className="nfc-toast nfc-toast--show" role="status">
          <span className="nfc-toast-icon" aria-hidden>
            ✓
          </span>
          <div>
            <p className="nfc-toast-title">Watering logged</p>
            <p className="nfc-toast-sub">Plant refreshed.</p>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div
          className="nfc-sheet-backdrop"
          role="presentation"
          onClick={() => !saveBusy && setEditOpen(false)}
        >
          <div
            className="nfc-sheet"
            role="dialog"
            aria-labelledby="nfc-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="nfc-edit-title" className="nfc-sheet-title">
              Edit plant
            </h2>
            <label className="nfc-field-label" htmlFor="nfc-edit-name">
              Name
            </label>
            <input
              id="nfc-edit-name"
              className="nfc-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={80}
            />
            <label className="nfc-field-label" htmlFor="nfc-edit-profile">
              Plant type
            </label>
            <select
              id="nfc-edit-profile"
              className="nfc-input nfc-select"
              value={editCanonical}
              onChange={(e) => setEditCanonical(e.target.value)}
            >
              {listProfilesForPicker().map((p) => (
                <option key={p.canonicalName} value={p.canonicalName}>
                  {p.canonicalName}
                </option>
              ))}
            </select>
            <p className="nfc-edit-hint">
              Not the right plant? Pick a match — we’ll update watering rhythm and care tips.
            </p>
            <div className="nfc-sheet-actions">
              <button
                type="button"
                className="nfc-btn nfc-btn-ghost"
                disabled={saveBusy}
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="nfc-btn nfc-btn-primary"
                disabled={saveBusy}
                onClick={saveEdit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div
          className="nfc-sheet-backdrop"
          role="presentation"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="nfc-sheet"
            role="dialog"
            aria-labelledby="nfc-hist-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="nfc-hist-title" className="nfc-sheet-title">
              Watering history
            </h2>
            {log.length === 0 ? (
              <p className="nfc-lede">No entries yet.</p>
            ) : (
              <ul className="nfc-log-list">
                {log.map((row) => (
                  <li key={row.id} className="nfc-log-item">
                    {formatLogRow(row)}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="nfc-btn nfc-btn-primary"
              onClick={() => setHistoryOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmReset}
        title="Reset this tag?"
        message="This removes the plant from this tag so you can set it up again. This can’t be undone."
        confirmLabel="Reset"
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
