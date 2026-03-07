import { FilterSelect } from '@/components/ui/filter-select'
import { SearchInput } from '@/components/ui/search-input'

type Props = {
  currentFilters: {
    projectId: string
    supplier: string
    currency: string
    search: string
  }
  setFilter: (key: string, value: string) => void
  projects: { id: string; project_code: string; name: string }[]
  uniqueSuppliers: string[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function ApCalendarFilters({
  currentFilters,
  setFilter,
  projects,
  uniqueSuppliers,
  hasActiveFilters,
  onClearFilters,
}: Props) {
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <FilterSelect
        label="Project"
        value={currentFilters.projectId}
        onChange={(v) => setFilter('project', v)}
        options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
        placeholder="All projects"
      />

      <FilterSelect
        label="Supplier"
        value={currentFilters.supplier}
        onChange={(v) => setFilter('supplier', v)}
        options={uniqueSuppliers.map((name) => ({ value: name, label: name }))}
        placeholder="All suppliers"
      />

      <FilterSelect
        label="Currency"
        value={currentFilters.currency}
        onChange={(v) => setFilter('currency', v)}
        options={[
          { value: 'PEN', label: 'PEN' },
          { value: 'USD', label: 'USD' },
        ]}
        placeholder="All"
      />

      <SearchInput
        placeholder="Search title…"
        defaultValue={currentFilters.search}
      />

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
