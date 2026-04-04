export function HomeRoute() {
  return (
    <div className="nfc-shell nfc-setup">
      <div className="nfc-setup-card nfc-fade-in">
        <span className="nfc-brand-leaf" aria-hidden>
          🌿
        </span>
        <h1 className="nfc-title">Leafy</h1>
        <p className="nfc-lede">
          Open Leafy from your plant’s NFC tag. Each tag should use its own link,
          for example{' '}
          <code className="nfc-code-sample">#/group/front-yard</code>
          — that opens a private dashboard for that space only (plants, watering
          history, and care notes stay separate from every other tag).
        </p>
        <p className="nfc-lede nfc-lede--muted">
          If you’ve opened a group on this device before, we’ll send you there
          automatically the next time you open the app without a tag link.
        </p>
      </div>
    </div>
  )
}
