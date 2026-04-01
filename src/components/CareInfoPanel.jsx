export function CareInfoPanel({
  scheduleNote,
  suggestedAmount,
  howToWater,
  watchFor,
  setupDescription,
  weatherEffectNote,
  expanded,
  onToggle,
}) {
  return (
    <div className={`care-info-wrap ${expanded ? 'is-open' : ''}`}>
      <button
        type="button"
        className="care-info-toggle"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="care-info-toggle-text">
          <span className="care-info-toggle-main">
            {expanded ? 'Hide details' : 'View care'}
          </span>
          <span className="care-info-toggle-hint">
            Setup, weather context, how to water
          </span>
        </span>
        <span className={`chevron ${expanded ? 'is-up' : ''}`} aria-hidden>
          ▼
        </span>
      </button>
      <div className="care-info-panel" aria-hidden={!expanded}>
        <div className="care-info-inner">
          {scheduleNote && (
            <p className="care-plan-note">{scheduleNote}</p>
          )}
          {setupDescription ? (
            <div className="care-row care-row--meta">
              <span className="care-ico" aria-hidden>
                📍
              </span>
              <div>
                <div className="care-label">How this care is set up</div>
                <div className="care-value care-value--meta">
                  {setupDescription.replace(/^Setup:\s*/i, '')}
                </div>
              </div>
            </div>
          ) : null}
          {weatherEffectNote ? (
            <div className="care-row care-row--meta">
              <span className="care-ico" aria-hidden>
                ☁️
              </span>
              <div>
                <div className="care-label">Weather</div>
                <div className="care-value care-value--meta">
                  {weatherEffectNote.replace(/^Weather effect:\s*/i, '')}
                </div>
              </div>
            </div>
          ) : null}
          <div className="care-row">
            <span className="care-ico" aria-hidden>
              💧
            </span>
            <div>
              <div className="care-label">Suggested amount</div>
              <div className="care-value">{suggestedAmount || '—'}</div>
            </div>
          </div>
          <div className="care-row">
            <span className="care-ico" aria-hidden>
              🪣
            </span>
            <div>
              <div className="care-label">How to water</div>
              <div className="care-value">{howToWater || '—'}</div>
            </div>
          </div>
          <div className="care-row">
            <span className="care-ico" aria-hidden>
              👀
            </span>
            <div>
              <div className="care-label">Watch for</div>
              <div className="care-value">{watchFor || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
