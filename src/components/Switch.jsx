export default function Switch({ checked, onChange, label, hint, disabled }) {
  return (
    <div className="switch-row">
      <div>
        <b>{label}</b>
        {hint && <p className="muted small">{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
        className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  )
}
