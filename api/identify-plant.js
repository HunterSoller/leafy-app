/**
 * Vercel serverless: POST /api/identify-plant
 * Uses ANTHROPIC_API_KEY (never exposed to the client).
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
const REQUEST_MS = 52_000

function stripJsonFences(text) {
  let s = String(text).trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(s)
  if (fence) s = fence[1].trim()
  return s
}

function sendJson(res, status, body) {
  if (typeof res.status === 'function') {
    res.status(status).json(body)
  } else {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }
}

const SYSTEM = `You identify plants and outdoor plantings from photos for a home app called Leafy.

Rules:
- Respond with VALID JSON ONLY. No markdown fences, no commentary, no keys outside the schema.
- If the image shows multiple plants, a bed, border, or wide area, prefer a descriptive AREA label (e.g. "Tomato patch", "Mixed herb planter", "Front flower bed", "Backyard garden area") instead of inventing one exact species.
- If uncertain about species, lower confidence and set matchKind to category or unknown; never fake precision.
- Prefer slightly conservative (less frequent) watering intervals when unsure.
- For outdoor in-ground or beds: never use cup measurements in waterAmountText. Use phrases like "Water deeply around the base", "Water evenly until the soil feels moist", or "Give the area a deep soak".
- For single indoor potted plants, cup-style estimates are acceptable.
- howToWaterText and warningSignsText: one sentence each when possible.

Return this exact JSON shape:
{
  "displayName": string,
  "detectedType": string (short slug, e.g. "monstera" or "tomato_bed"),
  "matchKind": "specific" | "category" | "area" | "unknown",
  "sceneType": "single_plant" | "multiple_plants" | "garden_area" | "unclear",
  "confidence": number between 0 and 1,
  "wateringIntervalDays": integer,
  "waterAmountText": string,
  "howToWaterText": string,
  "warningSignsText": string,
  "scheduleNote": string,
  "careMatchQuality": "specific" | "general" | "area",
  "fallbackUsed": false
}`

function buildUserPrompt(environment, nameHint) {
  const lines = [
    `Environment: ${environment === 'outdoor' ? 'Outdoor' : 'Indoor'}.`,
    nameHint ? `Owner hint: "${nameHint}". Use only if it matches the image.` : 'No owner name hint.',
    'Classify sceneType and matchKind honestly from the image.',
    'Output JSON only.',
  ]
  return lines.join('\n')
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.status(204).end()
    } else {
      res.statusCode = 204
      res.end()
    }
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || typeof apiKey !== 'string') {
    sendJson(res, 503, {
      ok: false,
      error: 'AI is not configured on the server',
    })
    return
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      sendJson(res, 400, { ok: false, error: 'Invalid JSON body' })
      return
    }
  }
  if (!body || typeof body !== 'object') {
    sendJson(res, 400, { ok: false, error: 'Invalid request body' })
    return
  }

  const imageBase64 = body.imageBase64
  const mediaTypeRaw = typeof body.mediaType === 'string' ? body.mediaType : 'image/jpeg'
  const mediaType = mediaTypeRaw === 'image/jpg' ? 'image/jpeg' : mediaTypeRaw.toLowerCase()

  if (!mediaType.startsWith('image/')) {
    sendJson(res, 400, { ok: false, error: 'mediaType must be an image/* type' })
    return
  }

  const environment = body.environment === 'outdoor' ? 'outdoor' : 'indoor'
  const nameHint =
    typeof body.nameHint === 'string' ? body.nameHint.trim().slice(0, 120) : ''

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    sendJson(res, 400, { ok: false, error: 'imageBase64 is required' })
    return
  }
  if (imageBase64.length > 5_200_000) {
    sendJson(res, 400, { ok: false, error: 'Image payload too large' })
    return
  }

  const userPrompt = buildUserPrompt(environment, nameHint)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_MS)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(
        '[identify-plant] anthropic_http',
        response.status,
        errText.slice(0, 400),
      )
      sendJson(res, 502, {
        ok: false,
        error: 'Analysis service returned an error. Try again shortly.',
      })
      return
    }

    const data = await response.json()
    const textBlock = data?.content?.find((b) => b.type === 'text')?.text
    if (!textBlock) {
      sendJson(res, 502, { ok: false, error: 'Empty model response' })
      return
    }

    let parsed
    try {
      parsed = JSON.parse(stripJsonFences(textBlock))
    } catch {
      console.error('[identify-plant] json_parse', textBlock.slice(0, 300))
      sendJson(res, 502, {
        ok: false,
        error: 'Could not read model output. Try another photo.',
      })
      return
    }

    sendJson(res, 200, { ok: true, result: parsed })
  } catch (err) {
    const name = err?.name || ''
    if (name === 'AbortError') {
      console.error('[identify-plant] timeout')
      sendJson(res, 504, {
        ok: false,
        error: 'Analysis timed out. Try again with a slightly smaller photo.',
      })
      return
    }
    console.error('[identify-plant] error', name || err)
    sendJson(res, 500, { ok: false, error: 'Unexpected server error' })
  } finally {
    clearTimeout(timer)
  }
}
