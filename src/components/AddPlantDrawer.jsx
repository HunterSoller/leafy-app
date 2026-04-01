import { useCallback, useEffect, useState } from 'react'
import { PotSizeSelector } from './PotSizeSelector'

const emptyForm = () => ({
  name: '',
  location: 'indoor',
  potSize: 'M',
  imageUrl: null,
})

export function AddPlantDrawer({
  open,
  plantToEdit,
  onClose,
  onCreate,
  onUpdate,
}) {
  const [form, setForm] = useState(emptyForm)
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSaveError(null)
    if (plantToEdit) {
      setForm({
        name: plantToEdit.name || '',
        location: plantToEdit.location || 'indoor',
        potSize: plantToEdit.potSize || 'M',
        imageUrl: plantToEdit.imageUrl ?? null,
      })
    } else {
      setForm(emptyForm())
    }
  }, [open, plantToEdit])

  const set = useCallback((patch) => {
    setForm((f) => ({ ...f, ...patch }))
  }, [])

  const onFile = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      set({ imageUrl: reader.result })
    }
    reader.readAsDataURL(file)
  }, [set])

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      setSaveError('Add a name or type so we know what you’re growing.')
      return
    }
    setSaving(true)
    setSaveError(null)
    const trimmed = form.name.trim()
    try {
      if (plantToEdit?.id) {
        await onUpdate(plantToEdit.id, {
          name: trimmed,
          location: form.location,
          potSize: form.potSize || 'M',
          imageUrl: form.imageUrl,
          lastWateredAtForCare:
            plantToEdit.lastWatered?.toDate?.() ?? plantToEdit.lastWatered ?? null,
          totalWaterCountForCare: plantToEdit.totalWaterCount ?? 0,
        })
      } else {
        await onCreate({
          name: trimmed,
          location: form.location,
          potSize: form.potSize || 'M',
          imageUrl: form.imageUrl,
        })
      }
      onClose()
    } catch (err) {
      setSaveError(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }, [form, onClose, onCreate, onUpdate, plantToEdit])

  if (!open) return null

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="drawer drawer--sheet"
        role="dialog"
        aria-modal="true"
        aria-label={plantToEdit ? 'Edit plant' : 'Add a plant'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-handle" aria-hidden />
        <div className="drawer-scroll">
          <p className="drawer-step">Quick setup</p>
          <h2 className="drawer-title">
            {plantToEdit ? 'Update this plant' : 'New plant'}
          </h2>
          <p className="drawer-lede">
            A few basics are enough — Leafy will shape watering and care from there.
          </p>

          <label className="field field--spaced">
            <span className="field-label-row">
              <span className="field-label field-label-lg">Name or type</span>
              <span className="field-pill field-pill-req">Required</span>
            </span>
            <input
              className="field-input field-input-lg"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Monstera, patio tomatoes"
              autoComplete="off"
            />
          </label>

          <div className="field field--spaced">
            <span className="field-label-row">
              <span className="field-label field-label-lg">Photo</span>
              <span className="field-pill field-pill-opt">Optional</span>
            </span>
            <p className="field-micro">Adds a thumbnail to your card</p>
            <label className="upload-zone upload-zone--soft">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={onFile}
              />
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="upload-preview" />
              ) : (
                <div className="upload-placeholder">
                  <span className="upload-cam" aria-hidden>
                    ✦
                  </span>
                  <span>Tap to add</span>
                </div>
              )}
            </label>
          </div>

          <div className="field field--spaced">
            <span className="field-label-row">
              <span className="field-label field-label-lg">Where it lives</span>
              <span className="field-pill field-pill-req">Required</span>
            </span>
            <div className="loc-toggle loc-toggle--polished">
              <button
                type="button"
                className={form.location === 'indoor' ? 'is-on' : ''}
                onClick={() => set({ location: 'indoor' })}
              >
                Indoor
              </button>
              <button
                type="button"
                className={form.location === 'outdoor' ? 'is-on' : ''}
                onClick={() => set({ location: 'outdoor' })}
              >
                Outdoor
              </button>
            </div>
          </div>

          <div className="field field--spaced field--last">
            <span className="field-label field-label-lg">
              Pot size <span className="field-optional">(optional)</span>
            </span>
            <p className="field-hint">
              Fine-tunes how much water we suggest — defaults work for most pots.
            </p>
            <PotSizeSelector value={form.potSize} onChange={(ps) => set({ potSize: ps })} />
          </div>

          {saveError && <p className="field-error">{saveError}</p>}
        </div>

        <div className="drawer-footer drawer-footer--sticky">
          <button type="button" className="btn-outline btn-footer" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary btn-primary--large"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : plantToEdit ? 'Save changes' : 'Save & plan care'}
          </button>
        </div>
      </div>
    </div>
  )
}
