import { useCallback, useEffect, useRef, useState } from 'react'
import { PotSizeSelector } from './PotSizeSelector'
import { prepareImageForIdentify } from '../lib/imagePrep'
import { identifyPlantRequest } from '../lib/identifyPlantClient'
import {
  shouldAutoSaveAfterAi,
  confirmExplanationLine,
} from '../lib/normalizeAiPlantResult'

const emptyForm = () => ({
  name: '',
  location: 'indoor',
  potSize: '',
  imageUrl: null,
})

export function AddPlantDrawer({
  open,
  plantToEdit,
  onClose,
  onCreate,
  onUpdate,
  onPhotoPlanReady,
}) {
  const fileInputRef = useRef(null)
  const [form, setForm] = useState(emptyForm)
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [flowStep, setFlowStep] = useState('form')
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [aiNormalized, setAiNormalized] = useState(null)
  const [confirmSubstep, setConfirmSubstep] = useState('pick')
  const [reviewName, setReviewName] = useState('')
  const [analyzeError, setAnalyzeError] = useState(false)
  /** Outdoor: growing in a pot vs in-ground / bed */
  const [outdoorIsContainer, setOutdoorIsContainer] = useState(false)

  useEffect(() => {
    if (!open) return
    setSaveError(null)
    setAnalyzeError(false)
    setFlowStep('form')
    setLoadingPhase(0)
    setAiNormalized(null)
    setConfirmSubstep('pick')
    setReviewName('')
    if (plantToEdit) {
      const ps =
        plantToEdit.potSize !== undefined && plantToEdit.potSize !== null
          ? plantToEdit.potSize
          : ''
      setForm({
        name: plantToEdit.name || '',
        location: plantToEdit.location || 'indoor',
        potSize: ps,
        imageUrl: plantToEdit.imageUrl ?? null,
      })
      setOutdoorIsContainer(
        plantToEdit.location === 'outdoor' && Boolean(ps),
      )
    } else {
      setForm(emptyForm())
      setOutdoorIsContainer(false)
    }
  }, [open, plantToEdit])

  useEffect(() => {
    if (flowStep !== 'analyzing' || plantToEdit) {
      setLoadingPhase(0)
      return undefined
    }
    setLoadingPhase(0)
    const t = window.setTimeout(() => setLoadingPhase(1), 2400)
    return () => window.clearTimeout(t)
  }, [flowStep, plantToEdit])

  const set = useCallback((patch) => {
    setForm((f) => ({ ...f, ...patch }))
  }, [])

  const clearPhoto = useCallback(() => {
    set({ imageUrl: null })
    setAnalyzeError(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [set])

  const onFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      setImageBusy(true)
      setSaveError(null)
      setAnalyzeError(false)
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const prepped = await prepareImageForIdentify(String(reader.result))
          set({ imageUrl: prepped })
        } catch {
          setSaveError('Could not process that image. Try another photo.')
        } finally {
          setImageBusy(false)
        }
      }
      reader.onerror = () => {
        setImageBusy(false)
        setSaveError('Could not read that file.')
      }
      reader.readAsDataURL(file)
    },
    [set],
  )

  const hasPhoto = Boolean(form.imageUrl)
  const manualFallback = analyzeError
  const isCreate = !plantToEdit?.id
  const nameRequiredForCreate = isCreate && !hasPhoto
  const nameRequired = nameRequiredForCreate || Boolean(plantToEdit)

  const showPotForOutdoor = form.location === 'outdoor' && outdoorIsContainer
  const showPotSection =
    form.location === 'indoor' || showPotForOutdoor

  const commitCreate = useCallback(
    async ({
      name,
      aiNormalized: norm,
      aiCorrectedByUser,
      aiFallback,
    }) => {
      await onCreate({
        name: name.trim(),
        location: form.location,
        potSize: form.potSize ?? '',
        imageUrl: form.imageUrl,
        aiNormalized: norm,
        aiCorrectedByUser,
        aiSuggestedDisplayName: norm?.displayName,
        aiFallback,
      })
      if (norm && !aiFallback && onPhotoPlanReady) {
        onPhotoPlanReady(name.trim())
      }
    },
    [form.imageUrl, form.location, form.potSize, onCreate, onPhotoPlanReady],
  )

  const saveRulesOnly = useCallback(
    async (opts = {}) => {
      const { aiFallback = false } = opts
      const trimmed = form.name.trim()
      if (!trimmed) {
        setSaveError('Add a name so Leafy can build the plan.')
        return
      }
      setSaving(true)
      setSaveError(null)
      try {
        await commitCreate({
          name: trimmed,
          aiNormalized: undefined,
          aiCorrectedByUser: false,
          aiFallback,
        })
        onClose()
      } catch (err) {
        setSaveError(err.message || 'Could not save')
      } finally {
        setSaving(false)
      }
    },
    [commitCreate, form.name, onClose],
  )

  const runAnalyze = useCallback(async () => {
    if (!hasPhoto) return
    setSaving(true)
    setSaveError(null)
    setAnalyzeError(false)
    setFlowStep('analyzing')
    try {
      const normalized = await identifyPlantRequest({
        imageDataUrl: form.imageUrl,
        environment: form.location,
        nameHint: form.name,
        potSize: form.potSize ?? '',
      })
      setAiNormalized(normalized)

      if (shouldAutoSaveAfterAi(normalized)) {
        await commitCreate({
          name: normalized.displayName,
          aiNormalized: normalized,
          aiCorrectedByUser: false,
          aiFallback: false,
        })
        onClose()
        return
      }

      setReviewName(normalized.displayName)
      setConfirmSubstep('pick')
      setFlowStep('confirm')
    } catch (err) {
      const quiet =
        err?.name === 'AbortError'
          ? 'That took a little long. Try again or save with a name.'
          : 'We couldn’t identify it from the photo. You can still save it manually.'
      setSaveError(quiet)
      setAnalyzeError(true)
      setFlowStep('form')
    } finally {
      setSaving(false)
    }
  }, [
    commitCreate,
    form.imageUrl,
    form.location,
    form.name,
    form.potSize,
    hasPhoto,
    onClose,
  ])

  const handleSaveEdit = useCallback(async () => {
    const trimmed = form.name.trim()
    if (!trimmed) {
      setSaveError('Add a name for this plant.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const suggested = (
        plantToEdit.aiSuggestedDisplayName ||
        plantToEdit.displayName ||
        ''
      ).trim()
      const aiCorrectedByUser = Boolean(
        plantToEdit.aiGenerated && suggested && trimmed !== suggested,
      )
      await onUpdate(plantToEdit.id, {
        name: trimmed,
        location: form.location,
        potSize: form.potSize ?? '',
        imageUrl: form.imageUrl,
        lastWateredAtForCare:
          plantToEdit.lastWatered?.toDate?.() ?? plantToEdit.lastWatered ?? null,
        totalWaterCountForCare: plantToEdit.totalWaterCount ?? 0,
        aiCorrectedByUser,
      })
      onClose()
    } catch (err) {
      setSaveError(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }, [form, onClose, onUpdate, plantToEdit])

  const handlePrimaryCreate = useCallback(async () => {
    if (manualFallback) {
      await saveRulesOnly({ aiFallback: true })
      return
    }
    if (hasPhoto) {
      await runAnalyze()
      return
    }
    await saveRulesOnly()
  }, [hasPhoto, manualFallback, runAnalyze, saveRulesOnly])

  const handlePrimary = useCallback(async () => {
    if (plantToEdit?.id) {
      await handleSaveEdit()
      return
    }
    await handlePrimaryCreate()
  }, [handlePrimaryCreate, handleSaveEdit, plantToEdit])

  const handleUseThis = useCallback(async () => {
    if (!aiNormalized) return
    setSaving(true)
    setSaveError(null)
    try {
      await commitCreate({
        name: aiNormalized.displayName,
        aiNormalized,
        aiCorrectedByUser: false,
        aiFallback: false,
      })
      onClose()
    } catch (err) {
      setSaveError(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }, [aiNormalized, commitCreate, onClose])

  const handleSaveEditedName = useCallback(async () => {
    const name = reviewName.trim()
    if (!name || !aiNormalized) return
    setSaving(true)
    setSaveError(null)
    try {
      const corrected =
        name !== String(aiNormalized.displayName || '').trim()
      await commitCreate({
        name,
        aiNormalized,
        aiCorrectedByUser: corrected,
        aiFallback: false,
      })
      onClose()
    } catch (err) {
      setSaveError(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }, [aiNormalized, commitCreate, onClose, reviewName])

  if (!open) return null

  const createPrimaryLabel = manualFallback
    ? saving
      ? 'Saving…'
      : 'Save & plan care'
    : flowStep === 'analyzing'
      ? '…'
      : hasPhoto
        ? saving
          ? '…'
          : 'Analyze & save'
        : saving
          ? 'Saving…'
          : 'Save & plan care'

  const showConfirm = flowStep === 'confirm' && !plantToEdit
  const showAnalyzing = flowStep === 'analyzing' && !plantToEdit

  const loadingCopy =
    loadingPhase === 0
      ? 'Looking at your plant…'
      : 'Building the care plan…'

  const primaryDisabled =
    saving ||
    (showAnalyzing && !plantToEdit) ||
    imageBusy ||
    (plantToEdit && !form.name.trim()) ||
    (isCreate && !manualFallback && nameRequiredForCreate && !form.name.trim()) ||
    (isCreate && manualFallback && !form.name.trim())

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`drawer drawer--sheet drawer--add-plant ${showAnalyzing ? 'drawer--analyzing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-busy={showAnalyzing || saving}
        aria-label={plantToEdit ? 'Edit plant' : 'New plant'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-handle" aria-hidden />
        <div className="drawer-scroll drawer-scroll--add-plant">
          {showAnalyzing ? (
            <div className="ai-loading-premium">
              <div className="ai-loading-glow" aria-hidden />
              <h2 className="drawer-title drawer-title--center">{loadingCopy}</h2>
              <p className="drawer-lede drawer-lede--center muted">
                Just a moment.
              </p>
            </div>
          ) : showConfirm ? (
            <div className="add-confirm-card">
              <p className="add-confirm-eyebrow">Quick check</p>
              <p className="add-confirm-lead">
                We think this is
                <span className="add-confirm-name">
                  {' '}
                  {aiNormalized?.displayName}
                </span>
              </p>
              <p className="add-confirm-hint">{confirmExplanationLine(aiNormalized)}</p>

              {confirmSubstep === 'edit' ? (
                <label className="field field--confirm-edit">
                  <span className="field-label field-label-subtle">Name</span>
                  <input
                    className="field-input field-input--soft"
                    value={reviewName}
                    onChange={(e) => setReviewName(e.target.value)}
                    autoComplete="off"
                  />
                </label>
              ) : null}

              {saveError && <p className="field-error">{saveError}</p>}
            </div>
          ) : (
            <div className="add-plant-stack">
              <header className="add-plant-header">
                <h2 className="drawer-title drawer-title--add">
                  {plantToEdit ? 'Edit plant' : 'New plant'}
                </h2>
                <p className="drawer-lede drawer-lede--add">
                  Take a photo or add a name — Leafy will build the care plan.
                </p>
              </header>

              {/* A — Photo first */}
              <section className="add-plant-photo-block" aria-label="Photo">
                <div className="add-plant-label-row">
                  <span className="field-label field-label-photo">Photo</span>
                </div>
                <p className="field-micro field-micro--below-label">
                  Let Leafy identify it from the photo
                </p>
                <input
                  ref={fileInputRef}
                  id="add-plant-photo-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={onFile}
                  disabled={imageBusy || saving}
                />
                {form.imageUrl ? (
                  <div className="upload-zone upload-zone--premium upload-zone--hero upload-zone--filled">
                    <div className="upload-preview-wrap">
                      <img src={form.imageUrl} alt="" className="upload-preview upload-preview--hero" />
                      <div className="upload-preview-actions">
                        <button
                          type="button"
                          className="btn-photo-action"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={imageBusy || saving}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          className="btn-photo-action btn-photo-action--muted"
                          onClick={clearPhoto}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="add-plant-photo-input"
                    className="upload-zone upload-zone--premium upload-zone--hero"
                  >
                    <div className="upload-placeholder upload-placeholder--premium">
                      <span className="upload-icon-circle" aria-hidden>
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </span>
                      <span className="upload-primary-line">Tap to add a photo</span>
                      <span className="upload-secondary-line">Best for plant ID</span>
                    </div>
                  </label>
                )}
                {imageBusy && (
                  <p className="field-micro field-micro--center add-plant-prep-hint">
                    Preparing…
                  </p>
                )}
              </section>

              {/* B — Environment */}
              <section className="add-plant-env" aria-label="Where is it">
                <span className="field-label field-label-photo">Where is it?</span>
                <div className="loc-toggle loc-toggle--polished add-plant-loc">
                  <button
                    type="button"
                    className={form.location === 'indoor' ? 'is-on' : ''}
                    onClick={() => {
                      set({ location: 'indoor' })
                      setOutdoorIsContainer(false)
                    }}
                    disabled={saving}
                  >
                    Indoor
                  </button>
                  <button
                    type="button"
                    className={form.location === 'outdoor' ? 'is-on' : ''}
                    onClick={() => {
                      set({ location: 'outdoor' })
                      if (!outdoorIsContainer) set({ potSize: '' })
                    }}
                    disabled={saving}
                  >
                    Outdoor
                  </button>
                </div>
              </section>

              {/* Primary action hint: env + photo answer "what to do"; name + pot are secondary */}
              <section className="add-plant-name-block">
                <label className="field field--name-dynamic">
                  <span className="field-label-row add-plant-name-row">
                    <span className="field-label field-label-subtle">
                      {plantToEdit
                        ? 'Name'
                        : hasPhoto
                          ? 'Name (optional)'
                          : 'Name'}
                    </span>
                    {nameRequired ? (
                      <span className="field-pill field-pill-req">Required</span>
                    ) : null}
                  </span>
                  <span className="field-micro">
                    {plantToEdit
                      ? 'How it appears on your list.'
                      : hasPhoto
                        ? 'If you know it, add it. Otherwise Leafy will identify it.'
                        : 'Add a simple name so Leafy can build the care plan.'}
                  </span>
                  <input
                    className={`field-input field-input--soft ${!nameRequired ? 'field-input--optional' : ''}`}
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder={nameRequiredForCreate ? 'e.g. Snake plant' : ''}
                    autoComplete="off"
                    disabled={saving}
                    aria-required={nameRequired}
                  />
                </label>
              </section>

              {form.location === 'outdoor' ? (
                <section className="add-plant-outdoor-mode field--deemphasized">
                  <span className="field-label field-label-subtle">
                    Growing in a container?
                  </span>
                  <div className="yorn-toggle">
                    <button
                      type="button"
                      className={outdoorIsContainer ? 'is-on' : ''}
                      onClick={() => setOutdoorIsContainer(true)}
                      disabled={saving}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={!outdoorIsContainer ? 'is-on' : ''}
                      onClick={() => {
                        setOutdoorIsContainer(false)
                        set({ potSize: '' })
                      }}
                      disabled={saving}
                    >
                      No · in ground
                    </button>
                  </div>
                </section>
              ) : null}

              {/* Pot — last, muted */}
              {showPotSection ? (
                <section className="field field--pot-muted field--last" aria-label="Container size">
                  <span className="field-label field-label-faint">
                    Container size <span className="field-optional">(optional)</span>
                  </span>
                  <PotSizeSelector
                    className="pot-size-selector--deemphasized"
                    value={form.potSize}
                    onChange={(ps) => set({ potSize: ps })}
                  />
                </section>
              ) : null}

              {analyzeError && (
                <div className="ai-soft-error" role="status">
                  <p>{saveError}</p>
                  <button
                    type="button"
                    className="btn-text-link"
                    onClick={() => {
                      setAnalyzeError(false)
                      setSaveError(null)
                    }}
                  >
                    Try photo again
                  </button>
                </div>
              )}

              {saveError && !analyzeError && (
                <p className="field-error">{saveError}</p>
              )}
            </div>
          )}
        </div>

        <div className="drawer-footer drawer-footer--sticky drawer-footer--add-plant">
          {showConfirm ? (
            confirmSubstep === 'pick' ? (
              <>
                <button
                  type="button"
                  className="btn-ghost-inline btn-footer"
                  onClick={() => setConfirmSubstep('edit')}
                  disabled={saving}
                >
                  Edit name
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--large btn-primary--premium"
                  onClick={handleUseThis}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Use this'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-outline btn-footer"
                  onClick={() => {
                    setConfirmSubstep('pick')
                    setReviewName(aiNormalized?.displayName || '')
                    setSaveError(null)
                  }}
                  disabled={saving}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--large btn-primary--premium"
                  onClick={handleSaveEditedName}
                  disabled={saving || !reviewName.trim()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            )
          ) : (
            <>
              <button
                type="button"
                className="btn-outline btn-footer"
                onClick={onClose}
                disabled={(saving && !showAnalyzing) || imageBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary btn-primary--large btn-primary--premium"
                onClick={handlePrimary}
                disabled={primaryDisabled}
              >
                {plantToEdit ? (saving ? 'Saving…' : 'Save changes') : createPrimaryLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
