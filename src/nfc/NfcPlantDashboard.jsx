import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getIndoorWateringStatus,
  formatLastWateredHuman,
  getStructuredCare,
  toJsDate,
} from '../lib/indoorWatering'
import { subscribeWateringLogForTag } from '../lib/firebase'
import { ConfirmDialog } from '../components/ConfirmDialog'

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
  const [editInterval, setEditInterval] = useState(
    String(plant.wateringIntervalDays ?? 7),
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

  useEffect(() => {
    if (!historyOpen || !plant.tagId) return undefined
    return subscribeWateringLogForTag(plant.tagId, setLog, () => setLog([]))
  }, [historyOpen, plant.tagId])

  useEffect(() => {
    setEditName(plant.displayName || plant.name || '')
    setEditInterval(String(plant.wateringIntervalDays ?? 7))
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
    const n = Math.max(1, Math.min(21, Math.round(Number(editInterval)) || 7))
    const name = editName.trim() || plant.identifiedPlantName || 'Plant'
    setSaveBusy(true)
    try {
      await updatePlant({
        customName: editName.trim(),
        displayName: name,
        name,
        wateringIntervalDays: n,
        wateringFrequencyDays: n,
      })
      setEditOpen(false)
      setNow(new Date())
    } finally {
      setSaveBusy(false)
    }
  }, [editName, editInterval, plant.identifiedPlantName, updatePlant])

  const doReset = useCallback(async () => {
    await resetPlant()
    setConfirmReset(false)
  }, [resetPlant])

  const typeLine =
    plant.identifiedPlantName ||
    plant.type ||
    plant.displayName ||
    'Indoor plant'

  const lastWateredLine = formatLastWateredHuman(
    effectivePlant.lastWateredAt ?? effectivePlant.lastWatered,
    now,
  )

  return (
    <div className="nfc-shell nfc-plant">
      <header className="nfc-plant-header">
        <span className="nfc-brand-leaf" aria-hidden>
          🌿
        </span>
        <span className="nfc-brand-word">Leafy</span>
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
            Based on typical indoor care — adjust if the soil still feels moist.
          </p>
        </div>

        <div className="nfc-divider nfc-divider--light" aria-hidden />

        <section className="nfc-care-box">
          <h2 className="nfc-care-heading">Care</h2>
          <div className="nfc-care-section">
            <h3 className="nfc-care-label">Light</h3>
            <ul className="nfc-care-list">
              <li>{care.lightLine}</li>
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
            <label className="nfc-field-label" htmlFor="nfc-edit-int">
              Water every (days)
            </label>
            <input
              id="nfc-edit-int"
              className="nfc-input"
              type="number"
              min={1}
              max={21}
              inputMode="numeric"
              value={editInterval}
              onChange={(e) => setEditInterval(e.target.value)}
            />
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
