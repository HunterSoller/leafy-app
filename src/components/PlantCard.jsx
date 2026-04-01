import { useState, useRef, useEffect } from 'react'
import { StatusBadge } from './StatusBadge'
import { CareInfoPanel } from './CareInfoPanel'
import { WateringButton } from './WateringButton'
import { getWateringStatus } from '../lib/wateringLogic'
import { getSmartPlantStatus, softPersonaLine } from '../lib/smartPlantStatus'
import {
  getScanFriendlyStatus,
  getTierBadgeShort,
  formatNextDueSummary,
  getTimingContextNote,
} from '../lib/plantUrgencyLabels'
import { formatTimeAgo } from '../lib/timeFormat'
import {
  getPlantIntervalDays,
  suggestedAmountText,
  howToWaterCopy,
  warningSignsCopy,
  plantTypeDetectedLabel,
} from '../lib/plantCareRules'
import { hydrationRhythmPhrase } from '../lib/hydrationModel'
import {
  getCareBasisChip,
  getOutdoorSetupLine,
  getWeatherEffectCareLine,
} from '../lib/statusReasonText'

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

export function PlantCard({
  plant,
  index,
  outdoorDelayDays,
  weatherOptions,
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
  const liveLevel =
    typeof weatherOptions?.liveHydrationScore === 'number'
      ? weatherOptions.liveHydrationScore
      : weatherOptions?.liveWaterLevel
  const useBalance = typeof liveLevel === 'number'

  const accent = useBalance
    ? liveLevel < 20
      ? 'accent-overdue'
      : liveLevel < 40
        ? 'accent-due'
        : 'accent-ok'
    : accentForStatus(legacyStatus)

  const smart = getSmartPlantStatus(nextRaw, delay, weatherOptions ?? {})
  const urgency = cardUrgencyClass(smart.tier, smart.daysUntil)
  const tierBadge = getTierBadgeShort(smart)
  const scanLine = getScanFriendlyStatus(smart)
  const nextDueLine = formatNextDueSummary(nextRaw, delay)
  const timingCtx = getTimingContextNote(plant, weatherOptions?.weatherContext)
  const weatherAdjusted = Boolean(smart.rainChipLabel)

  const cardOverdue =
    (useBalance && liveLevel < 20) || legacyStatus === 'overdue'

  const heroTone = useBalance
    ? liveLevel < 20
      ? 'status-overdue'
      : liveLevel < 40
        ? 'status-due-today'
        : 'status-ok'
    : legacyStatus === 'overdue'
      ? 'status-overdue'
      : legacyStatus === 'due_today'
        ? 'status-due-today'
        : 'status-ok'

  const lastLine = formatTimeAgo(plant.lastWatered?.toDate?.() ?? plant.lastWatered)
  const intervalDays = getPlantIntervalDays(plant)
  const typeLabel = plantTypeDetectedLabel(plant)
  const sceneLabel = plantingSceneLabel(plant)
  const careBasisChip = getCareBasisChip(plant)
  const waterCount = plant.totalWaterCount ?? 0
  const reasonText = smart.reasonLine ?? smart.subline
  const personaLine =
    useBalance && reasonText
      ? null
      : softPersonaLine(smart.tier, smart.nextInDays, plant.id)
  const setupCare = getOutdoorSetupLine(plant)
  const weatherCare =
    plant.location === 'outdoor'
      ? getWeatherEffectCareLine(
          plant,
          weatherOptions?.weatherContext,
          weatherOptions?.balanceMeta,
        )
      : null

  const rhythmText = hydrationRhythmPhrase(intervalDays)

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
      className={`plant-card plant-card--urgency-${urgency} ${accent} ${cardOverdue ? 'card-overdue' : ''} ${weatherAdjusted ? 'plant-card--weather-adjusted' : ''} ${waterFlash ? 'plant-card--water-flash' : ''}`}
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
          <h3 className="plant-name-heading">
            <button
              type="button"
              className="plant-name-tap"
              onClick={() => onEdit(plant)}
              aria-label={`View or edit ${plant.name}`}
            >
              {plant.name}
            </button>
          </h3>
          <div className="plant-card-badges">
            <StatusBadge location={plant.location} />
            {sceneLabel && (
              <span className="plant-scene-chip">{sceneLabel}</span>
            )}
            {smart.rainChipLabel ? (
              <span className="plant-scene-chip plant-rain-chip">
                {smart.rainChipLabel}
              </span>
            ) : null}
            {careBasisChip ? (
              <span className="plant-care-basis-chip">{careBasisChip}</span>
            ) : null}
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

      <div className="plant-status-strip plant-status-strip--split">
        <span
          className={`plant-status-pill plant-status-pill--${urgency} ${weatherAdjusted ? 'plant-status-pill--with-weather' : ''}`}
        >
          {tierBadge}
          {weatherAdjusted ? (
            <span className="plant-status-weather-mark" aria-hidden>
              {' '}
              · rain
            </span>
          ) : null}
        </span>
        <p className={`plant-scan-line ${heroTone}`}>{scanLine}</p>
      </div>

      {typeLabel && <p className="plant-type-subtle">{typeLabel}</p>}

      <div className="plant-card-status-block">
        <p className="plant-next-label">Schedule</p>
        <p className={`plant-due-next-line ${heroTone}`}>{nextDueLine}</p>
        {reasonText ? (
          <p className="plant-due-reason">{reasonText}</p>
        ) : null}
        {timingCtx ? (
          <p className="plant-timing-ctx">{timingCtx}</p>
        ) : null}
        {smart.checkSoilHint ? (
          <p className="plant-due-soil-hint">{smart.checkSoilHint}</p>
        ) : null}
        {personaLine && (
          <p className="plant-persona">{personaLine}</p>
        )}
        <p className="plant-rhythm">{rhythmText}</p>
      </div>

      <div className="plant-care-facts" aria-label="Watering details">
        <div className="plant-care-fact">
          <span className="plant-care-fact-label">Last watered (manual)</span>
          <p className="plant-care-fact-value">
            {smart.manualWaterLine ?? lastLine}
          </p>
        </div>
        {smart.weatherAdjustmentLine ? (
          <div className="plant-care-fact">
            <span className="plant-care-fact-label">Weather / rain layer</span>
            <p className="plant-care-fact-value">{smart.weatherAdjustmentLine}</p>
          </div>
        ) : null}
      </div>

      {habitLine && <p className="plant-habit">{habitLine}</p>}

      <div className="plant-card-actions">
        <WateringButton
          onWater={() => onWater(plant)}
          overdue={
            useBalance
              ? liveLevel < 40
              : legacyStatus === 'overdue' || legacyStatus === 'due_today'
          }
        />
      </div>

      <CareInfoPanel
        scheduleNote={plant.scheduleNote}
        suggestedAmount={suggestedAmountText(plant)}
        howToWater={howToWaterCopy(plant)}
        watchFor={warningSignsCopy(plant)}
        setupDescription={setupCare}
        weatherEffectNote={weatherCare}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
    </article>
  )
}
