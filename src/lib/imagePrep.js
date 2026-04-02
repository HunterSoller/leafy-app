/**
 * Resize & compress an image for vision API (client-side only).
 * Falls back to the original data URL if compression fails but the payload is still reasonable.
 * @param {string} dataUrl
 * @param {{ maxEdge?: number, quality?: number, maxBytes?: number, maxOriginalChars?: number }} opts
 * @returns {Promise<string>} data:image/jpeg;base64,...
 */
export async function prepareImageForIdentify(dataUrl, opts = {}) {
  const maxEdge = opts.maxEdge ?? 1280
  const maxBytes = opts.maxBytes ?? 1.55 * 1024 * 1024
  const maxOriginalChars = opts.maxOriginalChars ?? 4_800_000
  let quality = opts.quality ?? 0.82

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid image')
  }

  try {
    const bitmap = await loadImageBitmapFromDataUrl(dataUrl)
    const { width, height } = bitmap

    const scale = Math.min(1, maxEdge / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')
    ctx.drawImage(bitmap, 0, 0, w, h)

    let jpeg = canvas.toDataURL('image/jpeg', quality)
    let attempts = 0
    while (jpeg.length > maxBytes * 1.38 && attempts < 7 && quality > 0.42) {
      quality -= 0.07
      jpeg = canvas.toDataURL('image/jpeg', quality)
      attempts += 1
    }

    bitmap.close?.()
    return jpeg
  } catch {
    if (dataUrl.length <= maxOriginalChars) {
      return dataUrl
    }
    throw new Error('Could not prepare this image — try a smaller photo.')
  }
}

/**
 * Smaller image for persisting in Firestore (stay under ~1 MiB doc limit).
 * @param {string} dataUrl
 * @returns {Promise<string>}
 */
export async function prepareImageForStorage(dataUrl, opts = {}) {
  const maxEdge = opts.maxEdge ?? 880
  const maxBytes = opts.maxBytes ?? 320_000
  let quality = opts.quality ?? 0.68

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid image')
  }

  try {
    const bitmap = await loadImageBitmapFromDataUrl(dataUrl)
    const { width, height } = bitmap
    const scale = Math.min(1, maxEdge / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')
    ctx.drawImage(bitmap, 0, 0, w, h)

    let jpeg = canvas.toDataURL('image/jpeg', quality)
    let attempts = 0
    while (jpeg.length > maxBytes * 1.37 && attempts < 10 && quality > 0.38) {
      quality -= 0.06
      jpeg = canvas.toDataURL('image/jpeg', quality)
      attempts += 1
    }

    bitmap.close?.()
    return jpeg
  } catch {
    throw new Error('Could not prepare this image — try a smaller photo.')
  }
}

function loadImageBitmapFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        createImageBitmap(img).then(resolve, reject)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = dataUrl
  })
}
