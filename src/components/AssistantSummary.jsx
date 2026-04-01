import { useMemo } from 'react'
import { summarizeGroupSmart } from '../lib/smartPlantStatus'

export function AssistantSummary({
  plants,
  delayForPlant,
  weatherOptionsForPlant,
}) {
  const summary = useMemo(
    () =>
      summarizeGroupSmart(plants, delayForPlant, weatherOptionsForPlant),
    [plants, delayForPlant, weatherOptionsForPlant],
  )

  const lines = useMemo(() => {
    const out = []
    const { today, soon, onTrack } = summary

    if (today > 0) {
      out.push({
        key: 'today',
        text:
          today === 1
            ? '1 plant needs water today.'
            : `${today} plants need water today.`,
        emphasis: true,
      })
    } else if (soon === 0) {
      out.push({
        key: 'well',
        text: 'All plants are doing well.',
        emphasis: false,
      })
    } else {
      out.push({
        key: 'calm',
        text: 'Nothing urgent today.',
        emphasis: false,
      })
    }

    if (soon > 0) {
      out.push({
        key: 'soon',
        text:
          soon === 1
            ? 'One is worth checking in the next day or two.'
            : `${soon} are worth checking in the next day or two.`,
        emphasis: false,
      })
    }

    if (today > 0 && onTrack > 0) {
      out.push({
        key: 'other',
        text:
          onTrack === 1
            ? 'The rest are fine for now.'
            : `The other ${onTrack} are fine for now.`,
        emphasis: false,
      })
    }

    if (today === 0 && soon > 0 && onTrack > 0) {
      out.push({
        key: 'other2',
        text:
          onTrack === 1
            ? 'One more is all good for now.'
            : `${onTrack} more are all good for now.`,
        emphasis: false,
      })
    }

    return out
  }, [summary])

  if (!plants.length) return null

  return (
    <section className="assistant-summary" aria-label="Do I need to water?">
      <p className="assistant-summary-kicker">At a glance</p>
      <ul className="assistant-summary-list">
        {lines.map((line) => (
          <li
            key={line.key}
            className={`assistant-summary-line ${line.emphasis ? 'is-emphasis' : ''}`}
          >
            {line.text}
          </li>
        ))}
      </ul>
    </section>
  )
}
