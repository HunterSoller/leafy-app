import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePlants } from '../hooks/usePlants'
import { useWeather } from '../hooks/useWeather'
import { useGroupId } from '../hooks/useGroupId'
import { getGroupSpaceLabel } from '../lib/group'
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
import { AssistantSummary } from '../components/AssistantSummary'

function PlantSection({ title, children, sectionRef, className = '' }) {
  return (
    <section
      className={`plant-section ${className}`.trim()}
      ref={sectionRef}
    >
      <h2 className="plant-section-title">{title}</h2>
      {children}
    </section>
  )
}

function renderPlantList(plants, startIndex, delayForPlant, waterPlant, openEdit, handleDelete, flashPlantId) {
  return (
    <ul className="plant-list plant-list--section">
      {plants.map((plant, i) => (
        <li key={plant.id} className="plant-list-item">
          <PlantCard
            plant={plant}
            index={startIndex + i}
            outdoorDelayDays={delayForPlant(plant)}
            onWater={() => waterPlant(plant, delayForPlant(plant))}
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

  const { bannerMessage, delayForPlant } = useWeather()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [plantToEdit, setPlantToEdit] = useState(null)
  const [weatherDismissed, setWeatherDismissed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [firstPlantTip, setFirstPlantTip] = useState(false)
  const [flashPlantId, setFlashPlantId] = useState(null)
  const [allSetToday, setAllSetToday] = useState(false)
  const [carePlanToast, setCarePlanToast] = useState(null)

  const urgentSectionRef = useRef(null)
  const didAutoScrollRef = useRef(false)
  const prevUrgentCountRef = useRef(null)
  const allSetToastTimersRef = useRef({ show: null, hide: null })

  const sorted = useMemo(
    () => sortPlants(plants, delayForPlant),
    [plants, delayForPlant],
  )

  const grouped = useMemo(
    () => groupPlantsByTodayFocus(sorted, delayForPlant),
    [sorted, delayForPlant],
  )

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
    const s = summarizeGroupSmart(plants, delayForPlant)
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
  }, [plants, delayForPlant])

  const handleWaterPlant = useCallback(
    async (plant) => {
      setFlashPlantId(plant.id)
      window.setTimeout(() => setFlashPlantId(null), 480)
      await waterPlant(plant, delayForPlant(plant))
    },
    [waterPlant, delayForPlant],
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

  const onPhotoPlanReady = useCallback((displayName) => {
    const t = displayName?.trim()
    setCarePlanToast(t || null)
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand">
            <span className="brand-leaf" aria-hidden>
              🌿
            </span>
            <span className="brand-name">Leafy</span>
          </div>
          <p className="brand-tagline">Calm care for your plants</p>
          <p className="group-context">{spaceLabel}</p>
        </div>
        <button
          type="button"
          className="btn-header-add"
          onClick={openAdd}
          style={{ touchAction: 'manipulation' }}
        >
          Add plant
        </button>
      </header>

      {showWeather && (
        <WeatherBanner
          message={bannerMessage}
          onDismiss={() => setWeatherDismissed(true)}
        />
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
          Care plan ready for{' '}
          <span className="care-plan-toast-name">{carePlanToast}</span>
        </div>
      ) : null}

      <main className="app-main">
        {loading && (
          <p className="loading-simple muted center" role="status">
            Checking your plants...
          </p>
        )}

        {!loading && plants.length === 0 && (
          <EmptyState onAdd={openAdd} firebaseReady={configured} />
        )}

        {!loading && plants.length > 0 && (
          <>
            <AssistantSummary plants={plants} delayForPlant={delayForPlant} />

            <div className="plant-sections">
              {grouped.today.length > 0 && (
                <PlantSection
                  title="Needs water today"
                  sectionRef={urgentSectionRef}
                  className="plant-section--urgent"
                >
                  {renderPlantList(
                    grouped.today,
                    0,
                    delayForPlant,
                    handleWaterPlant,
                    openEdit,
                    handleDelete,
                    flashPlantId,
                  )}
                </PlantSection>
              )}

              {grouped.today.length === 0 && grouped.soon.length > 0 && (
                <p className="plant-nothing-urgent">Nothing urgent today</p>
              )}

              {grouped.soon.length > 0 && (
                <PlantSection title="Up next">
                  {renderPlantList(
                    grouped.soon,
                    idxSoon,
                    delayForPlant,
                    handleWaterPlant,
                    openEdit,
                    handleDelete,
                    flashPlantId,
                  )}
                </PlantSection>
              )}

              {grouped.good.length > 0 && (
                <PlantSection title="All good">
                  {renderPlantList(
                    grouped.good,
                    idxGood,
                    delayForPlant,
                    handleWaterPlant,
                    openEdit,
                    handleDelete,
                    flashPlantId,
                  )}
                </PlantSection>
              )}
            </div>
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
    </div>
  )
}
