import { FilterSelect } from '@/components/ui/filter-select'
import type { ApCalendarFilters as Filters } from '@/lib/types'

type Props = {
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  projects: { id: string; project_code: string; name: string }[]
  uniqueSuppliers: string[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function ApCalendarFilters({
  filters,
  setFilters,
  projects,
  uniqueSuppliers,
  hasActiveFilters,
  onClearFilters,
}: Props) {
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <FilterSelect
        label="Project"
        value={filters.projectId}
        onChange={(v) => setFilters((f) => ({ ...f, projectId: v }))}
        options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
        placeholder="All projects"
      />

      <FilterSelect
        label="Supplier"
        value={filters.supplier}
        onChange={(v) => setFilters((f) => ({ ...f, supplier: v }))}
        options={uniqueSuppliers.map((name) => ({ value: name, label: name }))}
        placeholder="All suppliers"
      />

      <FilterSelect
        label="Currency"
        value={filters.currency}
        onChange={(v) => setFilters((f) => ({ ...f, currency: v }))}
        options={[
          { value: 'PEN', label: 'PEN' },
          { value: 'USD', label: 'USD' },
        ]}
        placeholder="All"
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Search title</label>
        <input
          type="text"
          value={filters.titleSearch}
          onChange={(e) => setFilters((f) => ({ ...f, titleSearch: e.target.value }))}
          placeholder="Filter by title..."
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
        />
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="self-end rounded px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
