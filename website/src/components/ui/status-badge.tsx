const variantClasses: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  zinc: 'bg-zinc-100 text-zinc-600',
}

type Props = {
  label: string
  variant: 'green' | 'yellow' | 'red' | 'blue' | 'zinc'
}

export function StatusBadge({ label, variant }: Props) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {label}
    </span>
  )
}
