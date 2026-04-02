import { useCallback, useRef, useState } from 'react'
import { identifyPlantRequest } from '../lib/identifyPlantClient'
import { prepareImageForIdentify, prepareImageForStorage } from '../lib/imagePrep'

function v1IdentificationHeadline(n) {
  if (!n) return ''
  const name =
    String(n.typeLabel || n.displayName || '').trim() || 'a houseplant'
  const c = Math.min(1, Math.max(0, Number(n.confidence) || 0))
  if (c >= 0.72) return `This looks like ${name}`
  if (c >= 0.45) return `This may be ${name}`
  return `We’re not quite sure — could be ${name}`
}

function buildCareSummary(n) {
  if (!n) return ''
  const parts = [
    n.scheduleNote,
    n.howToWaterText,
    n.warningSignsText && `Watch for: ${n.warningSignsText}`,
  ].filter(Boolean)
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 620)
}

/** First clause from schedule if it reads like light guidance; else empty (dashboard uses default). */
function inferCareLightLine(scheduleNote) {
  const s = String(scheduleNote || '').trim()
  if (!s) return ''
  if (!/light|sun|window|shade|bright|indirect|low light/i.test(s)) return ''
  const first = s.split(/[.!?]/)[0]?.trim()
  if (first && first.length <= 140) return first
  return ''
}

export function NfcSetupFlow({ configured, createPlant, onCreated }) {
  const [step, setStep] = useState('welcome')
  const [imageDataUrl, setImageDataUrl] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [customName, setCustomName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const fileRef = useRef(null)
  const abortRef = useRef(null)

  const pickPhoto = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const onFile = useCallback(async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result
      if (typeof url === 'string') {
        setImageDataUrl(url)
        setStep('photo')
      }
    }
    reader.readAsDataURL(f)
  }, [])

  const runAnalyze = useCallback(async () => {
    if (!imageDataUrl) return
    setAnalyzeError(null)
    setStep('analyzing')
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const prepped = await prepareImageForIdentify(imageDataUrl)
      const n = await identifyPlantRequest({
        imageDataUrl: prepped,
        environment: 'indoor',
        nameHint: customName.trim() || undefined,
        signal: ac.signal,
      })
      setAiResult(n)
      setStep('result')
    } catch (err) {
      if (err?.name === 'AbortError') return
      setAnalyzeError(err?.message || 'Could not analyze this photo.')
      setStep('analyze_error')
    }
  }, [imageDataUrl, customName])

  const useManualGuess = useCallback(() => {
    const hint = customName.trim()
    setAiResult({
      displayName: hint || 'Your plant',
      typeLabel: hint || 'Indoor plant',
      wateringIntervalDays: 7,
      scheduleNote:
        'Start with a gentle rhythm and adjust as you see how fast the soil dries.',
      howToWaterText:
        'Water at the base until the top inch of soil feels lightly moist.',
      warningSignsText:
        'Wilting with wet soil can mean stress; crispy leaves often mean thirst.',
      waterAmountText:
        'Enough to moisten the soil without leaving it soggy.',
      confidence: 0.35,
      matchKind: 'unknown',
      detectedType: 'houseplant',
      scientificName: '',
      sceneType: 'single_plant',
    })
    setStep('result')
  }, [customName])

  const confirmSave = useCallback(async () => {
    if (!aiResult || !imageDataUrl) return
    setSaveError(null)
    setSaving(true)
    try {
      const storedImg = await prepareImageForStorage(imageDataUrl)
      const identified = String(
        aiResult.typeLabel || aiResult.displayName || 'Plant',
      ).trim()
      const display = String(customName.trim() || identified).trim()
      await createPlant({
        customName: customName.trim() || '',
        identifiedPlantName: identified,
        displayName: display,
        type: identified,
        imageUrl: storedImg,
        wateringIntervalDays: aiResult.wateringIntervalDays,
        careSummary: buildCareSummary(aiResult),
        careLightLine: inferCareLightLine(aiResult.scheduleNote),
        careScheduleNote: String(aiResult.scheduleNote || '')
          .trim()
          .slice(0, 500),
        waterAmountText: aiResult.waterAmountText,
        howToWaterText: aiResult.howToWaterText,
        warningSignsText: aiResult.warningSignsText,
        aiConfidence: aiResult.confidence,
        aiMatchKind: aiResult.matchKind,
        detectedType: aiResult.detectedType,
        scientificName: aiResult.scientificName || '',
      })
      onCreated?.()
    } catch (err) {
      setSaveError(
        err?.message ||
          'Could not save. Check your connection and try again.',
      )
    } finally {
      setSaving(false)
    }
  }, [aiResult, imageDataUrl, customName, createPlant, onCreated])

  if (!configured) {
    return (
      <div className="nfc-shell nfc-setup">
        <div className="nfc-setup-card">
          <span className="nfc-brand-leaf" aria-hidden>
            🌿
          </span>
          <h1 className="nfc-title">Leafy isn’t connected</h1>
          <p className="nfc-lede">
            This app needs Firebase configuration to remember your plant. Ask
            whoever set up Leafy to add the environment keys.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="nfc-shell nfc-setup">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="nfc-hidden-input"
        onChange={onFile}
      />

      {step === 'welcome' && (
        <div className="nfc-setup-card nfc-fade-in">
          <span className="nfc-brand-leaf" aria-hidden>
            🌿
          </span>
          <p className="nfc-eyebrow">Welcome to Leafy</p>
          <h1 className="nfc-title">Let’s meet your plant</h1>
          <p className="nfc-lede">
            Add a clear photo and we’ll suggest a name, watering rhythm, and
            simple care tips. You can change anything later.
          </p>
          <button
            type="button"
            className="nfc-btn nfc-btn-primary"
            onClick={pickPhoto}
          >
            Add a plant photo
          </button>
        </div>
      )}

      {step === 'photo' && (
        <div className="nfc-setup-card nfc-fade-in">
          <div className="nfc-photo-preview">
            <img src={imageDataUrl} alt="" className="nfc-photo-preview-img" />
          </div>
          <label className="nfc-field-label" htmlFor="nfc-name-early">
            Optional name
          </label>
          <input
            id="nfc-name-early"
            type="text"
            className="nfc-input"
            placeholder="e.g. Kitchen Monstera"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            maxLength={80}
            autoComplete="off"
          />
          <div className="nfc-setup-actions">
            <button
              type="button"
              className="nfc-btn nfc-btn-ghost"
              onClick={() => {
                setImageDataUrl(null)
                setStep('welcome')
              }}
            >
              Different photo
            </button>
            <button
              type="button"
              className="nfc-btn nfc-btn-primary"
              onClick={runAnalyze}
            >
              Identify plant
            </button>
          </div>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="nfc-setup-card nfc-fade-in" aria-busy="true">
          <div className="nfc-loading-dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <p className="nfc-title nfc-title--sm">Checking your photo…</p>
          <p className="nfc-lede">This usually takes a few seconds.</p>
        </div>
      )}

      {step === 'analyze_error' && (
        <div className="nfc-setup-card nfc-fade-in">
          <p className="nfc-title nfc-title--sm">We couldn’t read that photo</p>
          <p className="nfc-lede">{analyzeError}</p>
          <div className="nfc-setup-actions nfc-setup-actions--stack">
            <button
              type="button"
              className="nfc-btn nfc-btn-primary"
              onClick={() => {
                setStep('photo')
                setAnalyzeError(null)
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="nfc-btn nfc-btn-ghost"
              onClick={useManualGuess}
            >
              Continue with a name only
            </button>
          </div>
        </div>
      )}

      {step === 'result' && aiResult && (
        <div className="nfc-setup-card nfc-fade-in">
          <p className="nfc-eyebrow">Looks good</p>
          <h1 className="nfc-title nfc-title--sm">{v1IdentificationHeadline(aiResult)}</h1>
          <p className="nfc-lede nfc-lede--muted">
            Plant ID is a best guess. Wrong plant? You can edit details anytime.
          </p>
          <div className="nfc-result-block">
            <p className="nfc-result-meta">
              Usually every ~<strong>{aiResult.wateringIntervalDays}</strong> days
              · indoor
            </p>
            {aiResult.scheduleNote ? (
              <p className="nfc-care-snippet">{aiResult.scheduleNote}</p>
            ) : null}
          </div>
          <label className="nfc-field-label" htmlFor="nfc-name-final">
            What should we call it?
          </label>
          <input
            id="nfc-name-final"
            type="text"
            className="nfc-input"
            placeholder={aiResult.typeLabel || aiResult.displayName || 'Plant name'}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            maxLength={80}
          />
          {saveError ? (
            <p className="nfc-inline-error" role="alert">
              {saveError}
            </p>
          ) : null}
          <button
            type="button"
            className="nfc-btn nfc-btn-primary"
            disabled={saving}
            onClick={confirmSave}
          >
            {saving ? 'Saving…' : 'Save and open plant page'}
          </button>
        </div>
      )}
    </div>
  )
}
