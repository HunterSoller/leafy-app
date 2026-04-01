const MODEL = 'claude-sonnet-4-20250514'

function stripJsonFences(text) {
  let s = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(s)
  if (fence) s = fence[1].trim()
  return s
}

export async function identifyPlantFromImage(dataUrl) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Add VITE_ANTHROPIC_API_KEY to use photo ID')

  const m = /^data:(image\/[a-z+]+);base64,([\s\S]+)$/i.exec(dataUrl)
  if (!m) throw new Error('Invalid image data')
  const mediaType = m[1] === 'image/jpg' ? 'image/jpeg' : m[1]
  const base64 = m[2]

  const userPrompt = `Identify this plant. Respond ONLY in raw JSON (no markdown, no backticks):
{
  "commonName": string,
  "scientificName": string,
  "wateringFrequencyDaysIndoor": number,
  "wateringFrequencyDaysOutdoor": number,
  "waterAmount": string,
  "wateringMethod": string,
  "warningSign": string,
  "careTip": string
}

Use this guidance:
- waterAmount: e.g. "~250ml, about 1 cup for a medium pot"
- wateringMethod: max 10 words, e.g. "Water at base, avoid wetting leaves"
- warningSign: max 10 words, e.g. "Yellow leaves indicate overwatering"
- careTip: max 12 words`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: 'You are a plant identification and care assistant.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText || `Claude API error ${res.status}`)
  }

  const body = await res.json()
  const text = body?.content?.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('No text in Claude response')

  const raw = stripJsonFences(text)
  return JSON.parse(raw)
}
