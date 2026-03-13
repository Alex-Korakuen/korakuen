import { FilterSelect } from '@/components/ui/filter-select'
import { SearchInput } from '@/components/ui/search-input'

type Props = {
  currentFilters: {
    projectId: string
    entity: string
    type: string
    currency: string
    search: string
  }
  setFilter: (key: string, value: string) => void
  projects: { id: string; project_code: string; name: string }[]
  uniqueEntities: string[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function CalendarFilters({
  currentFilters,
  setFilter,
  projects,
  uniqueEntities,
  hasActiveFilters,
  onClearFilters,
}: Props) {
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <FilterSelect
        label="Type"
        value={currentFilters.type}
        onChange={(v) => setFilter('type', v)}
        options={[
          { value: 'commercial', label: 'Commercial' },
          { value: 'loan', label: 'Loan' },
        ]}
        placeholder="All types"
      />

      <FilterSelect
        label="Project"
        value={currentFilters.projectId}
        onChange={(v) => setFilter('project', v)}
        options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
        placeholder="All projects"
      />

      <FilterSelect
        label="Entity"
        value={currentFilters.entity}
        onChange={(v) => setFilter('entity', v)}
        options={uniqueEntities.map((name) => ({ value: name, label: name }))}
        placeholder="All entities"
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
