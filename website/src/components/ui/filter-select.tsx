import { selectClass, filterLabel } from '@/lib/styles'

type FilterSelectOption = {
  value: string
  label: string
}

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  options: FilterSelectOption[]
  placeholder?: string
  className?: string
}

export function FilterSelect({ label, value, onChange, options, placeholder = 'All', className }: Props) {
  const select = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${selectClass} ${className ?? ''}`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )

  if (!label) return select

  return (
    <div className="flex flex-col gap-1">
      <label className={filterLabel}>{label}</label>
      {select}
    </div>
  )
}
