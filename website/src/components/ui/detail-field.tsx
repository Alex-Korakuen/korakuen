export function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-faint">{label}</span>
      <p className="text-sm text-ink">{value}</p>
    </div>
  )
}
