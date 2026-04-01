import { normalizeAiPlantResult } from './normalizeAiPlantResult'

const DEFAULT_TIMEOUT_MS = 55_000

export function getIdentifyPlantUrl() {
  const base = import.meta.env.VITE_API_URL
  if (import.meta.env.DEV && base) {
    return `${base.replace(/\/$/, '')}/api/identify-plant`
  }
  return '/api/identify-plant'
}

/** @param {string} dataUrl */
function splitDataUrl(dataUrl) {
  const m = /^data:(image\/[a-z+0-9.-]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return { mediaType: 'image/jpeg', base64: dataUrl }
  let mediaType = m[1].toLowerCase()
  if (mediaType === 'image/jpg') mediaType = 'image/jpeg'
  return { mediaType, base64: m[2] }
}

/**
 * @param {{
 *   imageDataUrl: string,
 *   environment: 'indoor'|'outdoor',
 *   nameHint?: string,
 *   potSize?: string,
 *   signal?: AbortSignal,
 * }} params
 * @returns {Promise<ReturnType<typeof normalizeAiPlantResult>>}
 */
export async function identifyPlantRequest(params) {
  const {
    imageDataUrl,
    environment,
    nameHint,
    potSize,
    signal: outerSignal,
  } = params

  const { mediaType, base64 } = splitDataUrl(imageDataUrl)

  const controller = new AbortController()
  const t = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  const onParentAbort = () => controller.abort()
  if (outerSignal) {
    if (outerSignal.aborted) {
      window.clearTimeout(t)
      throw new DOMException('Aborted', 'AbortError')
    }
    outerSignal.addEventListener('abort', onParentAbort)
  }

  let res
  try {
    res = await fetch(getIdentifyPlantUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaType,
        imageBase64: base64,
        environment,
        nameHint: nameHint?.trim() || undefined,
      }),
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(t)
    outerSignal?.removeEventListener('abort', onParentAbort)
  }

  let json
  try {
    json = await res.json()
  } catch {
    throw new Error('Invalid response from server')
  }

  if (!res.ok || !json?.ok) {
    const msg =
      json?.error ||
      (res.status >= 500
        ? 'Server error — try again in a moment.'
        : `Could not analyze (${res.status})`)
    throw new Error(msg)
  }

  return normalizeAiPlantResult(json.result, {
    environment,
    potSize: potSize || '',
    nameHint: nameHint?.trim() || '',
    jitterKey: nameHint?.trim() || json.result?.displayName || 'ai',
    jitterEventIndex: 0,
  })
}
