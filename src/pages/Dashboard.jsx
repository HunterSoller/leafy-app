import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePlants } from '../hooks/usePlants'
import { useWeather } from '../hooks/useWeather'
import { useGroupId } from '../hooks/useGroupId'
import { useGroupSettings } from '../hooks/useGroupSettings'
import { getGroupSpaceLabel, DEFAULT_GROUP_ID } from '../lib/group'
import {
  isGroupLocationPromptSkipped,
  setGroupLocationPromptSkipped,
} from '../lib/groupLocalSettings'
import { persistPlantWaterBalance, timestampFromDate } from '../lib/firebase'
import {
  computeSyncedHydration,
  hydrationNeedsPersist,
} from '../lib/hydrationModel'
import { sortPlants } from '../lib/wateringLogic'
import {
  groupPlantsByTodayFocus,
  summarizeGroupSmart,
} from '../lib/smartPlantStatus'
import { PlantCard } from '../components/PlantCard'
import { AddPlantDrawer } from '../components/AddPlantDrawer'
import { WeatherBanner } from '../components/WeatherBanner'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GroupDashboardSummary } from '../components/GroupDashboardSummary'
import { GroupLocationModal } from '../components/GroupLocationModal'
import { GroupWeatherPanel } from '../components/GroupWeatherPanel'
import { RecentActivitySection } from '../components/RecentActivitySection'

function PlantSection({ title, count, children, sectionRef, className = '' }) {
  return (
    <section
      className={`plant-section ${className}`.trim()}
      ref={sectionRef}
    >
      <h2 className="plant-section-title">
        <span className="plant-section-title-text">{title}</span>
        {count != null ? (
          <span className="plant-section-count" aria-hidden>
            {count}
          </span>
        ) : null}
      </h2>
      {children}
    </section>
  )
}

function renderPlantList(
  plants,
  startIndex,
  delayForPlant,
  weatherOptionsForPlant,
  waterPlant,
  openEdit,
  handleDelete,
  flashPlantId,
) {
  return (
    <ul className="plant-list plant-list--section">
      {plants.map((plant, i) => (
        <li key={plant.id} className="plant-list-item">
          <PlantCard
            plant={plant}
            index={startIndex + i}
            outdoorDelayDays={delayForPlant(plant)}
            weatherOptions={weatherOptionsForPlant(plant)}
            onWater={() => waterPlant(plant)}
            onEdit={openEdit}
            onDelete={handleDelete}
            waterFlash={flashPlantId === plant.id}
          />
        </li>
      ))}
    </ul>
  )
}

export function Dashboard() {
  const groupId = useGroupId()
  const spaceLabel = useMemo(() => getGroupSpaceLabel(groupId), [groupId])

  const {
    plants,
    loading,
    configured,
    addPlant,
    updatePlant,
    deletePlant,
    waterPlant,
  } = usePlants()

  const {
    settings: groupSettings,
    loading: groupSettingsLoading,
    hasSavedLocation,
    saveLocation: saveGroupLocationFields,
  } = useGroupSettings()

  const isDefaultGroup = groupId === DEFAULT_GROUP_ID

  const {
    bannerMessage,
    delayForPlant,
    weatherOptionsForPlant: baseWeatherOptions,
    weatherContext,
    error: weatherFetchError,
  } = useWeather(groupId, groupSettings, groupSettingsLoading)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [plantToEdit, setPlantToEdit] = useState(null)
  const [weatherDismissed, setWeatherDismissed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [firstPlantTip, setFirstPlantTip] = useState(false)
  const [flashPlantId, setFlashPlantId] = useState(null)
  const [allSetToday, setAllSetToday] = useState(false)
  const [carePlanToast, setCarePlanToast] = useState(null)
  const [groupLocModalOpen, setGroupLocModalOpen] = useState(false)

  const urgentSectionRef = useRef(null)
  const didAutoScrollRef = useRef(false)
  const prevUrgentCountRef = useRef(null)
  const allSetToastTimersRef = useRef({ show: null, hide: null })

  const balanceById = useMemo(() => {
    const m = new Map()
    const now = new Date()
    for (const p of plants) {
      m.set(p.id, computeSyncedHydration(p, weatherContext, now))
    }
    return m
  }, [plants, weatherContext])

  const weatherOptionsForPlant = useCallback(
    (plant) => {
      const meta = balanceById.get(plant.id)
      return {
        ...baseWeatherOptions(plant),
        liveHydrationScore: meta?.hydrationScore,
        liveWaterLevel: meta?.hydrationScore,
        balanceMeta: meta,
      }
    },
    [baseWeatherOptions, balanceById],
  )

  const sorted = useMemo(
    () =>
      sortPlants(
        plants,
        delayForPlant,
        (pl) => balanceById.get(pl.id)?.hydrationScore,
      ),
    [plants, delayForPlant, balanceById],
  )

  const grouped = useMemo(
    () =>
      groupPlantsByTodayFocus(sorted, delayForPlant, weatherOptionsForPlant),
    [sorted, delayForPlant, weatherOptionsForPlant],
  )

  useEffect(() => {
    if (!configured || !plants.length) return
    const now = new Date()
    for (const p of plants) {
      const next = computeSyncedHydration(p, weatherContext, now)
      if (!hydrationNeedsPersist(p, next)) continue
      void persistPlantWaterBalance(p.id, {
        hydrationScore: next.hydrationScore,
        hydrationCalculatedAt: timestampFromDate(next.hydrationCalculatedAt),
        waterLevel: next.hydrationScore,
        rainMmBalanceSnapshot: next.rainMmBalanceSnapshot,
        waterBalanceUpdatedAt: timestampFromDate(next.hydrationCalculatedAt),
        nextWaterDue: timestampFromDate(next.nextWaterDue),
        lastRainAmount: next.lastRainAmount,
        rainContribution: next.rainContribution,
        weatherAdjustmentNote: next.weatherAdjustmentNote ?? null,
        ...(next.lastRainAt instanceof Date
          ? { lastRainAt: timestampFromDate(next.lastRainAt) }
          : {}),
      }).catch(() => {})
    }
  }, [configured, plants, weatherContext])

  const addPlantAndMaybeCelebrate = useCallback(
    async (payload) => {
      const wasEmpty = plants.length === 0
      await addPlant(payload)
      if (wasEmpty) setFirstPlantTip(true)
    },
    [plants.length, addPlant],
  )

  useEffect(() => {
    if (!firstPlantTip) return undefined
    const t = window.setTimeout(() => setFirstPlantTip(false), 10000)
    return () => window.clearTimeout(t)
  }, [firstPlantTip])

  useEffect(() => {
    didAutoScrollRef.current = false
    prevUrgentCountRef.current = null
    const { show, hide } = allSetToastTimersRef.current
    if (show) window.clearTimeout(show)
    if (hide) window.clearTimeout(hide)
    allSetToastTimersRef.current = { show: null, hide: null }
    const t = window.setTimeout(() => setAllSetToday(false), 0)
    return () => window.clearTimeout(t)
  }, [groupId])

  useEffect(() => {
    if (groupSettingsLoading) return
    if (isDefaultGroup) return
    if (hasSavedLocation) return
    if (isGroupLocationPromptSkipped(groupId)) return
    setGroupLocModalOpen(true)
  }, [groupSettingsLoading, isDefaultGroup, hasSavedLocation, groupId])

  useEffect(() => {
    if (loading || didAutoScrollRef.current || grouped.today.length === 0) {
      return
    }
    didAutoScrollRef.current = true
    window.requestAnimationFrame(() => {
      urgentSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [loading, grouped.today.length, plants.length])

  useEffect(() => {
    const s = summarizeGroupSmart(
      plants,
      delayForPlant,
      weatherOptionsForPlant,
    )
    if (prevUrgentCountRef.current === null) {
      prevUrgentCountRef.current = s.today
      return undefined
    }
    if (prevUrgentCountRef.current > 0 && s.today === 0) {
      allSetToastTimersRef.current.show = window.setTimeout(() => {
        setAllSetToday(true)
        allSetToastTimersRef.current.hide = window.setTimeout(() => {
          setAllSetToday(false)
          allSetToastTimersRef.current.hide = null
        }, 3200)
        allSetToastTimersRef.current.show = null
      }, 0)
    }
    prevUrgentCountRef.current = s.today
    return () => {
      const { show, hide } = allSetToastTimersRef.current
      if (show) window.clearTimeout(show)
      if (hide) window.clearTimeout(hide)
      allSetToastTimersRef.current = { show: null, hide: null }
    }
  }, [plants, delayForPlant, weatherOptionsForPlant])

  const handleWaterPlant = useCallback(
    async (plant) => {
      setFlashPlantId(plant.id)
      window.setTimeout(() => setFlashPlantId(null), 480)
      await waterPlant(plant, {
        outdoorDelayDays: delayForPlant(plant),
        rainMmSnapshot: weatherContext.mmCombined48h,
      })
    },
    [waterPlant, delayForPlant, weatherContext.mmCombined48h],
  )

  const openAdd = useCallback(() => {
    setPlantToEdit(null)
    setDrawerOpen(true)
  }, [])

  const openEdit = useCallback((plant) => {
    setPlantToEdit(plant)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setPlantToEdit(null)
  }, [])

  const onPhotoPlanReady = useCallback((info) => {
    if (info == null) {
      setCarePlanToast(null)
      return
    }
    const name =
      typeof info === 'string'
        ? info.trim()
        : String(info.displayName || '').trim()
    setCarePlanToast(
      name
        ? {
            headline: `Care plan ready for ${name}`,
            subline: 'Added to this space',
          }
        : { headline: 'Care plan ready', subline: 'Added to this space' },
    )
  }, [])

  useEffect(() => {
    if (!carePlanToast) return undefined
    const t = window.setTimeout(() => setCarePlanToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [carePlanToast])

  const handleDelete = useCallback((plant) => {
    setConfirmDelete(plant)
  }, [])

  const confirmDeletePlant = useCallback(async () => {
    if (!confirmDelete?.id) return
    await deletePlant(confirmDelete.id)
    setConfirmDelete(null)
  }, [confirmDelete, deletePlant])

  const showWeather = bannerMessage && !weatherDismissed

  const idxSoon = grouped.today.length
  const idxGood = grouped.today.length + grouped.soon.length
  const forecastActive = weatherContext?.adjustmentsActive === true

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-main">
          <div className="app-header-brand-row">
            <div className="brand-block">
              <div className="brand">
                <span className="brand-leaf" aria-hidden>
                  🌿
                </span>
                <span className="brand-name">Leafy</span>
              </div>
              <p className="brand-tagline">Calm care for your plants</p>
            </div>
            <button
              type="button"
              className="btn-header-add"
              onClick={openAdd}
              style={{ touchAction: 'manipulation' }}
            >
              Add plant
            </button>
          </div>
          <p className="group-eyebrow">This space</p>
          <h1 className="group-title">{spaceLabel}</h1>
          <GroupWeatherPanel
            isDefaultGroup={isDefaultGroup}
            hasSavedLocation={hasSavedLocation}
            locationLabel={groupSettings?.location_label}
            forecastActive={forecastActive}
            weatherFetchError={Boolean(weatherFetchError)}
            onUpdateLocation={() => setGroupLocModalOpen(true)}
          />
        </div>
      </header>

      {showWeather && (
        <WeatherBanner
          message={bannerMessage}
          onDismiss={() => setWeatherDismissed(true)}
        />
      )}

      {weatherFetchError && hasSavedLocation && (
        <p className="weather-fetch-hint" role="status">
          <span className="weather-fetch-hint-icon" aria-hidden>
            ☁️
          </span>
          Forecast couldn’t load — your watering rhythm is unchanged.
        </p>
      )}

      {firstPlantTip && (
        <div className="first-plant-banner" role="status">
          <p className="first-plant-banner-text">
            <strong>Care plan ready.</strong> We’ll point you here when it’s
            time to water — just tap &quot;Watered it&quot; when you do.
          </p>
          <button
            type="button"
            className="first-plant-banner-dismiss"
            onClick={() => setFirstPlantTip(false)}
            aria-label="Dismiss"
          >
            OK
          </button>
        </div>
      )}

      {allSetToday && (
        <div className="all-set-toast" role="status">
          All set for today — nothing else needs water right now.
        </div>
      )}

      {carePlanToast ? (
        <div className="care-plan-toast" role="status">
          <p className="care-plan-toast-headline">{carePlanToast.headline}</p>
          {carePlanToast.subline ? (
            <p className="care-plan-toast-subline">{carePlanToast.subline}</p>
          ) : null}
        </div>
      ) : null}

      <main className="app-main">
        {loading && (
          <div className="dashboard-loading" role="status" aria-busy="true">
            <div className="loading-dots" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="loading-text">Gathering your plants…</p>
            <div className="dashboard-skeleton" aria-hidden>
              <div className="skeleton-line skeleton-line--wide" />
              <div className="skeleton-line skeleton-line--card" />
              <div className="skeleton-line skeleton-line--card" />
            </div>
          </div>
        )}

        {!loading && plants.length === 0 && (
          <EmptyState onAdd={openAdd} firebaseReady={configured} />
        )}

        {!loading && plants.length > 0 && (
          <>
            <GroupDashboardSummary
              plants={plants}
              delayForPlant={delayForPlant}
              weatherOptionsForPlant={weatherOptionsForPlant}
              locationLabel={groupSettings?.location_label}
              hasSavedLocation={hasSavedLocation}
              forecastActive={forecastActive}
              weatherFetchError={Boolean(weatherFetchError)}
            />

            <div className="plant-sections">
              {grouped.today.length > 0 && (
                <PlantSection
                  title="Needs water now"
                  count={grouped.today.length}
                  sectionRef={urgentSectionRef}
                  className="plant-section--urgent"
                >
                  {renderPlantList(
                    grouped.today,
                    0,
                    delayForPlant,
                    weatherOptionsForPlant,
                    handleWaterPlant,
                    openEdit,
                    handleDelete,
                    flashPlantId,
                  )}
                </PlantSection>
              )}

              {grouped.today.length === 0 && (
                <div
                  className="plant-nothing-urgent plant-nothing-urgent--positive"
                  role="status"
                >
                  {grouped.soon.length > 0
                    ? 'Nothing needs water right now — check “Due soon” next.'
                    : 'Nothing urgent — every plant looks comfortable for now.'}
                </div>
              )}

              {grouped.soon.length > 0 && (
                <PlantSection title="Due soon" count={grouped.soon.length}>
                  {renderPlantList(
                    grouped.soon,
                    idxSoon,
                    delayForPlant,
                    weatherOptionsForPlant,
                    handleWaterPlant,
                    openEdit,
                    handleDelete,
                    flashPlantId,
                  )}
                </PlantSection>
              )}

              {grouped.good.length > 0 && (
                <PlantSection title="Okay for now" count={grouped.good.length}>
                  {renderPlantList(
                    grouped.good,
                    idxGood,
                    delayForPlant,
                    weatherOptionsForPlant,
                    handleWaterPlant,
                    openEdit,
                    handleDelete,
                    flashPlantId,
                  )}
                </PlantSection>
              )}
            </div>

            <RecentActivitySection plants={plants} />
          </>
        )}
      </main>

      <AddPlantDrawer
        open={drawerOpen}
        plantToEdit={plantToEdit}
        onClose={closeDrawer}
        onCreate={addPlantAndMaybeCelebrate}
        onUpdate={updatePlant}
        onPhotoPlanReady={onPhotoPlanReady}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Remove plant?"
        message={
          confirmDelete
            ? `Remove “${confirmDelete.name}”? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={confirmDeletePlant}
        onCancel={() => setConfirmDelete(null)}
      />

      <GroupLocationModal
        open={groupLocModalOpen}
        onClose={() => setGroupLocModalOpen(false)}
        groupLabel={spaceLabel.replace(/\s+plants$/i, '').trim() || spaceLabel}
        isDefaultGroup={isDefaultGroup}
        saveLocation={saveGroupLocationFields}
        onSkipNotNow={() => setGroupLocationPromptSkipped(groupId, true)}
      />
    </div>
  )
}
