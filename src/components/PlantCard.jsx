import { useState, useRef, useEffect } from 'react'
import { StatusBadge } from './StatusBadge'
import { CareInfoPanel } from './CareInfoPanel'
import { WateringButton } from './WateringButton'
import { getWateringStatus } from '../lib/wateringLogic'
import { getSmartPlantStatus, softPersonaLine } from '../lib/smartPlantStatus'
import { formatTimeAgo } from '../lib/timeFormat'
import {
  getPlantIntervalDays,
  suggestedAmountText,
  howToWaterCopy,
  warningSignsCopy,
  plantTypeDetectedLabel,
} from '../lib/plantCareRules'

function accentForStatus(status) {
  if (status === 'overdue') return 'accent-overdue'
  if (status === 'due_today') return 'accent-due'
  return 'accent-ok'
}

function cardUrgencyClass(tier, daysUntil) {
  if (tier === 'needs_water_today') return 'today'
  if (tier === 'due_soon' && daysUntil === 1) return 'tomorrow'
  if (tier === 'due_soon') return 'soon'
  return 'ok'
}

function plantingSceneLabel(plant) {
  if (plant.sceneType === 'garden_area') return 'Garden area'
  if (plant.sceneType === 'multiple_plants') return 'Mixed planting'
  return null
}

function plantProvenanceLine(plant) {
  if (!plant.aiGenerated) return null
  if (plant.aiCorrectedByUser) return 'Updated from photo'
  if (plant.careMatchQuality === 'area' || plant.matchKind === 'area') {
    return 'General care plan'
  }
  return 'Identified from photo'
}

function chipFromSmart(smart) {
  if (smart.tier === 'needs_water_today') {
    return 'Today'
  }
  if (smart.tier === 'due_soon') {
    return smart.daysUntil === 1 ? 'Tomorrow' : 'Soon'
  }
  return null
}

export function PlantCard({
  plant,
  index,
  outdoorDelayDays,
  onWater,
  onEdit,
  onDelete,
  waterFlash = false,
}) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const delay = plant.location === 'outdoor' ? outdoorDelayDays : 0
  const nextRaw = plant.nextWaterDue?.toDate?.() ?? plant.nextWaterDue
  const legacyStatus = getWateringStatus(nextRaw, delay)
  const accent = accentForStatus(legacyStatus)
  const smart = getSmartPlantStatus(nextRaw, delay)
  const urgency = cardUrgencyClass(smart.tier, smart.daysUntil)
  const chip = chipFromSmart(smart)

  const lastLine = formatTimeAgo(plant.lastWatered?.toDate?.() ?? plant.lastWatered)
  const intervalDays = getPlantIntervalDays(plant)
  const typeLabel = plantTypeDetectedLabel(plant)
  const sceneLabel = plantingSceneLabel(plant)
  const provenanceLine = plantProvenanceLine(plant)
  const waterCount = plant.totalWaterCount ?? 0
  const personaLine = softPersonaLine(smart.tier, smart.nextInDays, plant.id)

  const rhythmText = `About every ${intervalDays} days`

  const habitLine =
    waterCount >= 3
      ? 'Consistently cared for.'
      : waterCount >= 1
        ? 'Looking good.'
        : null

  useEffect(() => {
    if (!menuOpen) return undefined
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpen])

  return (
    <article
      className={`plant-card plant-card--urgency-${urgency} ${accent} ${legacyStatus === 'overdue' ? 'card-overdue' : ''} ${waterFlash ? 'plant-card--water-flash' : ''}`}
      style={{ animationDelay: `${0.08 * index}s` }}
    >
      <div className="plant-card-header-row">
        <div className="plant-card-media">
          {plant.imageUrl ? (
            <img
              className="plant-thumb"
              src={plant.imageUrl}
              alt=""
              width={72}
              height={72}
            />
          ) : (
            <div className="plant-thumb plant-thumb-placeholder" aria-hidden>
              <span className="plant-thumb-icon">🌿</span>
            </div>
          )}
        </div>
        <div className="plant-card-intro">
          <h3 className="plant-name">{plant.name}</h3>
          <div className="plant-card-badges">
            <StatusBadge location={plant.location} />
            {sceneLabel && (
              <span className="plant-scene-chip">{sceneLabel}</span>
            )}
            {chip && (
              <span className={`plant-urgency-chip chip-${urgency}`}>{chip}</span>
            )}
          </div>
        </div>

        <div className="card-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="card-menu-btn"
            aria-label="More options"
            onClick={() => setMenuOpen((v) => !v)}
            style={{ touchAction: 'manipulation' }}
          >
            ⋮
          </button>
          {menuOpen && (
            <ul className="card-menu">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onEdit(plant)
                  }}
                >
                  Edit plant
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete(plant)
                  }}
                >
                  Remove plant
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>

      {typeLabel && <p className="plant-type-subtle">{typeLabel}</p>}
      {provenanceLine && (
        <p className="plant-provenance">{provenanceLine}</p>
      )}

      <div className="plant-card-status-block">
        <p className="plant-next-label">When to water</p>
        <p
          className={`plant-due-hero ${
            legacyStatus === 'overdue'
              ? 'status-overdue'
              : legacyStatus === 'due_today'
                ? 'status-due-today'
                : 'status-ok'
          }`}
        >
          {smart.headline}
        </p>
        {smart.subline && (
          <p className="plant-due-subtle">{smart.subline}</p>
        )}
        {personaLine && (
          <p className="plant-persona">{personaLine}</p>
        )}
        <p className="plant-rhythm">{rhythmText}</p>
      </div>

      <div className="plant-card-meta">
        <span>{lastLine}</span>
      </div>

      {habitLine && <p className="plant-habit">{habitLine}</p>}

      <div className="plant-card-actions">
        <WateringButton
          onWater={() => onWater(plant)}
          overdue={legacyStatus === 'overdue'}
        />
      </div>

      <CareInfoPanel
        scheduleNote={plant.scheduleNote}
        suggestedAmount={suggestedAmountText(plant)}
        howToWater={howToWaterCopy(plant)}
        watchFor={warningSignsCopy(plant)}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
    </article>
  )
}
