import { useCallback, useEffect, useState } from 'react'
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
  const [outdoorInContainer, setOutdoorInContainer] = useState(false)

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
      setOutdoorInContainer(
        plantToEdit.location === 'outdoor' && Boolean(ps),
      )
    } else {
      setForm(emptyForm())
      setOutdoorInContainer(false)
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
        setSaveError('Add a short name so we can plan watering.')
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
          ? 'That took a little long. You can try again or save with a name.'
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

  const showPotSection =
    form.location === 'indoor' ||
    (form.location === 'outdoor' && outdoorInContainer)

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`drawer drawer--sheet ${showAnalyzing ? 'drawer--analyzing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-busy={showAnalyzing || saving}
        aria-label={plantToEdit ? 'Edit plant' : 'Add a plant'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-handle" aria-hidden />
        <div className="drawer-scroll">
          {showAnalyzing ? (
            <div className="ai-loading-premium">
              <div className="ai-loading-glow" aria-hidden />
              <h2 className="drawer-title drawer-title--center">{loadingCopy}</h2>
              <p className="drawer-lede drawer-lede--center muted">
                A quick, quiet look at your photo — no need to change anything.
              </p>
            </div>
          ) : showConfirm ? (
            <div className="add-confirm-panel">
              <h2 className="drawer-title">Almost there</h2>
              <p className="add-confirm-lead">
                We think this is{' '}
                <span className="add-confirm-name">
                  {aiNormalized?.displayName}
                </span>
                .
              </p>
              <p className="add-confirm-hint">{confirmExplanationLine(aiNormalized)}</p>

              {confirmSubstep === 'edit' ? (
                <label className="field field--spaced">
                  <span className="field-label field-label-subtle">
                    Name on your list
                  </span>
                  <input
                    className="field-input field-input-lg field-input--soft"
                    value={reviewName}
                    onChange={(e) => setReviewName(e.target.value)}
                    autoComplete="off"
                  />
                </label>
              ) : null}

              {saveError && <p className="field-error">{saveError}</p>}
            </div>
          ) : (
            <>
              <h2 className="drawer-title">
                {plantToEdit ? 'Edit plant' : 'New plant'}
              </h2>
              <p className="drawer-lede drawer-lede--tight">
                Take a photo or add a name — Leafy will build the care plan.
              </p>

              <div className="field field--hero-upload">
                <label className="upload-zone upload-zone--premium">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={onFile}
                    disabled={imageBusy || saving}
                  />
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="" className="upload-preview" />
                  ) : (
                    <div className="upload-placeholder upload-placeholder--premium">
                      <span className="upload-cam-premium" aria-hidden>
                        +
                      </span>
                      <span className="upload-primary-line">Add a photo</span>
                      <span className="upload-secondary-line">
                        Tap to take or choose — best in natural light
                      </span>
                    </div>
                  )}
                </label>
                {imageBusy && (
                  <p className="field-micro field-micro--center">
                    Preparing image…
                  </p>
                )}
              </div>

              <div className="field field--spaced">
                <div className="loc-toggle loc-toggle--polished">
                  <button
                    type="button"
                    className={form.location === 'indoor' ? 'is-on' : ''}
                    onClick={() => {
                      set({ location: 'indoor' })
                      setOutdoorInContainer(false)
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
                      if (!outdoorInContainer) set({ potSize: '' })
                    }}
                    disabled={saving}
                  >
                    Outdoor
                  </button>
                </div>
              </div>

              <label className="field field--secondary-name">
                <span className="field-label field-label-subtle">
                  Plant name (optional)
                </span>
                <span className="field-micro">
                  If you know it, add it. Otherwise Leafy will identify it.
                </span>
                <input
                  className="field-input field-input--soft"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder=" "
                  autoComplete="off"
                  disabled={saving}
                />
              </label>

              {form.location === 'outdoor' && !outdoorInContainer ? (
                <button
                  type="button"
                  className="btn-disclosure"
                  onClick={() => setOutdoorInContainer(true)}
                  disabled={saving}
                >
                  Growing in a container?
                </button>
              ) : null}

              {showPotSection ? (
                <div className="field field--spaced field--last">
                  <span className="field-label field-label-subtle">
                    Pot size <span className="field-optional">(optional)</span>
                  </span>
                  <p className="field-hint">
                    For potted plants — skip for in-ground beds and open soil.
                  </p>
                  <PotSizeSelector
                    value={form.potSize}
                    onChange={(ps) => set({ potSize: ps })}
                  />
                </div>
              ) : null}

              {analyzeError && (
                <div className="ai-soft-error" role="status">
                  <p>
                    We couldn’t identify it from the photo. You can still save
                    it manually.
                  </p>
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
            </>
          )}
        </div>

        <div className="drawer-footer drawer-footer--sticky">
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
                  className="btn-primary btn-primary--large"
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
                  className="btn-primary btn-primary--large"
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
                disabled={
                  saving ||
                  (showAnalyzing && !plantToEdit) ||
                  imageBusy ||
                  (plantToEdit && !form.name.trim()) ||
                  (!plantToEdit &&
                    !manualFallback &&
                    !hasPhoto &&
                    !form.name.trim()) ||
                  (!plantToEdit && manualFallback && !form.name.trim())
                }
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
