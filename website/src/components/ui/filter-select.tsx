import { selectClass } from '@/lib/styles'

type FilterSelectOption = {
  value: string
  label: string
}

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  options: FilterSelectOption[]
  placeholder?: string
}

export function FilterSelect({ label, value, onChange, options, placeholder = 'All' }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
