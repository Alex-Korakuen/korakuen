const variantClasses: Record<string, string> = {
  green: 'bg-positive-bg text-positive',
  yellow: 'bg-caution-bg text-caution',
  red: 'bg-negative-bg text-negative',
  blue: 'bg-info-bg text-info',
  zinc: 'bg-surface text-muted',
}

type Props = {
  label: string
  variant: 'green' | 'yellow' | 'red' | 'blue' | 'zinc'
}

export function StatusBadge({ label, variant }: Props) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.04em] ${variantClasses[variant]}`}
    >
      {label}
    </span>
  )
}
