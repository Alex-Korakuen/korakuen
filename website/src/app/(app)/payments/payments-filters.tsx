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
    bankAccountId: string
    direction: string
    paymentType: string
  }
  setFilter: (key: string, value: string) => void
  projects: { id: string; project_code: string }[]
  bankAccounts: { id: string; label: string }[]
  partners: { id: string; label: string }[]
  categories: { value: string; label: string }[]
  entities: { value: string; label: string }[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function PaymentsFilters({
  currentFilters,
  setFilter,
  projects,
  bankAccounts,
  partners,
  categories,
  entities,
  hasActiveFilters,
  onClearFilters,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      {/* Month picker */}
      <input
        type="month"
        defaultValue={currentFilters.month}
        onChange={(e) => setFilter(FK.month, e.target.value)}
        className="w-32 rounded border border-edge bg-white px-2 py-1.5 text-xs text-muted"
      />

      {/* Partner dropdown */}
      <FilterSelect
        value={currentFilters.partnerId}
        onChange={(v) => setFilter(FK.partner, v)}
        options={partners.map((p) => ({ value: p.id, label: p.label }))}
        placeholder="All partners"
        className="w-32"
      />

      {/* Project dropdown */}
      <FilterSelect
        value={currentFilters.projectId}
        onChange={(v) => setFilter(FK.project, v)}
        options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
        placeholder="All projects"
        className="w-32"
      />

      {/* Category dropdown */}
      <FilterSelect
        value={currentFilters.category}
        onChange={(v) => setFilter(FK.category, v)}
        options={categories}
        placeholder="All categories"
        className="w-32"
      />

      {/* Entity dropdown */}
      <FilterSelect
        value={currentFilters.entity}
        onChange={(v) => setFilter(FK.entity, v)}
        options={entities}
        placeholder="All entities"
        className="w-32"
      />

      {/* Bank dropdown */}
      <FilterSelect
        value={currentFilters.bankAccountId}
        onChange={(v) => setFilter(FK.bank, v)}
        options={bankAccounts.map((b) => ({ value: b.id, label: b.label }))}
        placeholder="All banks"
        className="w-32"
      />

      {/* Direction dropdown */}
      <FilterSelect
        value={currentFilters.direction}
        onChange={(v) => setFilter(FK.direction, v)}
        options={[
          { value: 'outbound', label: 'Outflow' },
          { value: 'inbound', label: 'Inflow' },
        ]}
        placeholder="All directions"
        className="w-32"
      />

      {/* Payment Type dropdown */}
      <FilterSelect
        value={currentFilters.paymentType}
        onChange={(v) => setFilter(FK.type, v)}
        options={[
          { value: 'regular', label: 'Regular' },
          { value: 'detraccion', label: 'Detracción' },
          { value: 'retencion', label: 'Retención' },
        ]}
        placeholder="All types"
        className="w-32"
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
