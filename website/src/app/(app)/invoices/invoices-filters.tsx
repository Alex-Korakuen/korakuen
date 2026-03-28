'use client'

import { FilterSelect } from '@/components/ui/filter-select'
import { FK } from '@/lib/filter-keys'

type Props = {
  currentFilters: {
    month: string
    partnerId: string
    projectId: string
    category: string
    entity: string
    direction: string
    type: string
    status: string
  }
  setFilter: (key: string, value: string) => void
  projects: { id: string; project_code: string; name: string }[]
  partners: { id: string; name: string }[]
  uniqueEntities: string[]
  uniqueCategories: { value: string; label: string }[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function InvoicesFilters({
  currentFilters,
  setFilter,
  projects,
  partners,
  uniqueEntities,
  uniqueCategories,
  hasActiveFilters,
  onClearFilters,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Month picker */}
      <input
        type="month"
        defaultValue={currentFilters.month}
        onChange={(e) => setFilter(FK.month, e.target.value)}
        className="rounded border border-edge bg-white px-2 py-1 text-xs text-muted"
      />

      {/* Partner dropdown */}
      <FilterSelect
        value={currentFilters.partnerId}
        onChange={(v) => setFilter(FK.partner, v)}
        options={partners.map((p) => ({ value: p.id, label: p.name }))}
        placeholder="All partners"
      />

      {/* Project dropdown */}
      <FilterSelect
        value={currentFilters.projectId}
        onChange={(v) => setFilter(FK.project, v)}
        options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
        placeholder="All projects"
      />

      {/* Category dropdown */}
      <FilterSelect
        value={currentFilters.category}
        onChange={(v) => setFilter(FK.category, v)}
        options={uniqueCategories}
        placeholder="All categories"
      />

      {/* Entity dropdown */}
      <FilterSelect
        value={currentFilters.entity}
        onChange={(v) => setFilter(FK.entity, v)}
        options={uniqueEntities.map((name) => ({ value: name, label: name }))}
        placeholder="All entities"
      />

      {/* Direction dropdown */}
      <FilterSelect
        value={currentFilters.direction || currentFilters.type}
        onChange={(v) => {
          if (v === 'loan') {
            setFilter(FK.direction, '')
            setFilter(FK.type, 'loan')
          } else {
            setFilter(FK.type, '')
            setFilter(FK.direction, v)
          }
        }}
        options={[
          { value: 'payable', label: 'Outflow' },
          { value: 'receivable', label: 'Inflow' },
          { value: 'loan', label: 'Loan' },
        ]}
        placeholder="All directions"
      />

      {/* Status dropdown */}
      <FilterSelect
        value={currentFilters.status}
        onChange={(v) => setFilter(FK.status, v)}
        options={[
          { value: 'pending', label: 'Pending' },
          { value: 'partial', label: 'Partial' },
          { value: 'paid', label: 'Paid' },
          { value: 'overdue', label: 'Overdue' },
        ]}
        placeholder="All statuses"
      />

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded px-2 py-1 text-xs text-faint transition-colors hover:text-negative"
        >
          Clear
        </button>
      )}
    </div>
  )
}
