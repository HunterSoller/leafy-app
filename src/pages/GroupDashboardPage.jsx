import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isValidGroupId } from '../lib/groupRoutes'
import { useGroupPlants } from '../hooks/useGroupPlants'
import { getIndoorWateringStatus } from '../lib/indoorWatering'

export function GroupInvalid() {
  return (
    <div className="nfc-shell nfc-setup">
      <div className="nfc-setup-card">
        <span className="nfc-brand-leaf" aria-hidden>
          🌿
        </span>
        <h1 className="nfc-title">Group link not valid</h1>
        <p className="nfc-lede">
          This URL doesn’t look like a Leafy group. Use letters, numbers, hyphens,
          or underscores only (for example <code className="nfc-code-sample">dayton-home</code>
          ).
        </p>
      </div>
    </div>
  )
}

function GroupLoading() {
  return (
    <div className="nfc-shell nfc-loading">
      <div className="nfc-loading-dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p className="nfc-loading-text">Loading your plants…</p>
    </div>
  )
}

export function GroupDashboardPage() {
  const { groupId: raw } = useParams()
  const groupId = raw?.trim() ?? ''
  const navigate = useNavigate()
  const ok = isValidGroupId(groupId)

  const { plants, loading, configured } = useGroupPlants(ok ? groupId : null)

  const plantsWithStatus = useMemo(() => {
    if (!Array.isArray(plants)) return []
    return plants.map((p) => ({
      plant: p,
      status: getIndoorWateringStatus(p, new Date()),
    }))
  }, [plants])

  if (!ok) {
    return <GroupInvalid />
  }

  if (loading) {
    return <GroupLoading />
  }

  const gidEnc = encodeURIComponent(groupId)

  return (
    <div className="nfc-shell nfc-plant" key={groupId}>
      <header className="nfc-plant-header">
        <span className="nfc-brand-leaf" aria-hidden>
          🌿
        </span>
        <span className="nfc-brand-word">Leafy</span>
      </header>

      <div className="nfc-plant-body nfc-fade-in">
        <p className="nfc-eyebrow">Group</p>
        <h1 className="nfc-plant-name nfc-group-title">{groupId}</h1>
        <p className="nfc-plant-type">
          {plants?.length
            ? `${plants.length} plant${plants.length === 1 ? '' : 's'} in this space`
            : 'No plants yet — add one to get started.'}
        </p>

        {!configured ? (
          <div className="nfc-setup-card" style={{ marginTop: 16 }}>
            <p className="nfc-lede">
              Firebase isn’t configured. Add your environment keys so this group
              can save plants.
            </p>
          </div>
        ) : null}

        <div className="nfc-plant-cta-wrap" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="nfc-btn nfc-btn-water"
            onClick={() => navigate(`/group/${gidEnc}/setup`)}
          >
            Add a plant
          </button>
        </div>

        {plantsWithStatus.length > 0 ? (
          <ul className="nfc-group-plant-list">
            {plantsWithStatus.map(({ plant: p, status }) => {
              const name = p.displayName || p.name || 'Plant'
              const sub =
                p.canonicalPlantName || p.identifiedPlantName || p.type || ''
              const to = `/group/${gidEnc}/plant/${encodeURIComponent(p.plantId)}`
              return (
                <li key={p.plantId}>
                  <Link className="nfc-group-plant-card" to={to}>
                    <div className="nfc-group-plant-thumb">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" />
                      ) : (
                        <span aria-hidden>🌿</span>
                      )}
                    </div>
                    <div className="nfc-group-plant-meta">
                      <span className="nfc-group-plant-name">{name}</span>
                      {sub ? (
                        <span className="nfc-group-plant-type">{sub}</span>
                      ) : null}
                      <span className={`nfc-group-plant-status nfc-group-plant-status--${status.kind}`}>
                        {status.title}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
