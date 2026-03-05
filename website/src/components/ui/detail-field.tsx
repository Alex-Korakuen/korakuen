export function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <p className="text-sm text-zinc-700">{value}</p>
    </div>
  )
}
