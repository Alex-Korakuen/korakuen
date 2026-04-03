'use client'

import { useUrlFilters } from '@/lib/use-url-filters'
import { hasActiveFilters } from '@/lib/filter-keys'
import { FilterSelect } from '@/components/ui/filter-select'
import { SearchInput } from '@/components/ui/search-input'

// --- Filter definition types ---

type SelectDef = {
  type: 'select'
  key: string
  label?: string
  options: { value: string; label: string }[]
  placeholder?: string
  width?: string
  value?: string
  onChange?: (value: string, helpers: FilterHelpers) => void
}

type MonthDef = {
  type: 'month'
  key: string
}

type MonthRangeDef = {
  type: 'month-range'
  fromKey: string
  toKey: string
}

type SearchDef = {
  type: 'search'
  placeholder?: string
  width?: string
}

export type FilterDef = SelectDef | MonthDef | MonthRangeDef | SearchDef

type FilterHelpers = {
  setFilter: (key: string, value: string) => void
  setFilters: (updates: Record<string, string>) => void
}

type FilterBarProps = {
  filters: FilterDef[]
  currentFilters: Record<string, string>
  clearKeys?: string[]
  className?: string
}

function deriveClearKeys(filters: FilterDef[]): string[] {
  const keys: string[] = []
  for (const f of filters) {
    switch (f.type) {
      case 'select': keys.push(f.key); break
      case 'month': keys.push(f.key); break
      case 'month-range': keys.push(f.fromKey, f.toKey); break
      case 'search': keys.push('search'); break
    }
  }
  return keys
}

export function FilterBar({ filters, currentFilters, clearKeys, className }: FilterBarProps) {
  const { setFilter, setFilters, clearFilters } = useUrlFilters()
  const active = hasActiveFilters(currentFilters)
  const keysToReset = clearKeys ?? deriveClearKeys(filters)

  return (
    <div className={className ?? 'flex flex-wrap items-end gap-3'}>
      {filters.map((def, i) => {
        switch (def.type) {
          case 'select':
            return (
              <FilterSelect
                key={def.key}
                label={def.label}
                value={def.value ?? currentFilters[def.key] ?? ''}
                onChange={(v) => def.onChange ? def.onChange(v, { setFilter, setFilters }) : setFilter(def.key, v)}
                options={def.options}
                placeholder={def.placeholder}
                className={def.width ?? 'w-32'}
              />
            )

          case 'month':
            return (
              <input
                key={def.key}
                type="month"
                defaultValue={currentFilters[def.key] ?? ''}
                onChange={(e) => setFilter(def.key, e.target.value)}
                className="w-32 rounded border border-edge bg-white px-2 py-1.5 text-xs text-muted"
              />
            )

          case 'month-range':
            return (
              <span key={`${def.fromKey}-${def.toKey}`} className="flex items-center gap-1">
                <input
                  type="month"
                  defaultValue={currentFilters[def.fromKey] ?? ''}
                  onChange={(e) => setFilter(def.fromKey, e.target.value)}
                  className="w-32 rounded border border-edge bg-white px-2 py-1.5 text-xs text-muted"
                />
                <span className="text-xs text-faint">—</span>
                <input
                  type="month"
                  defaultValue={currentFilters[def.toKey] ?? ''}
                  onChange={(e) => setFilter(def.toKey, e.target.value)}
                  className="w-32 rounded border border-edge bg-white px-2 py-1.5 text-xs text-muted"
                />
              </span>
            )

          case 'search':
            return (
              <div key={`search-${i}`} className={def.width}>
                <SearchInput
                  placeholder={def.placeholder}
                  defaultValue={currentFilters.search ?? ''}
                  label=""
                  showButton={false}
                />
              </div>
            )
        }
      })}

      {active && (
        <button
          type="button"
          onClick={() => clearFilters(keysToReset)}
          className="rounded px-2 py-1.5 text-xs text-faint transition-colors hover:text-negative"
        >
          Clear
        </button>
      )}
    </div>
  )
}
