import { FilterSelect } from '@/components/ui/filter-select'
import { SearchInput } from '@/components/ui/search-input'
import { FK } from '@/lib/filter-keys'

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
    <div className="mt-4 flex items-end gap-2">
      <FilterSelect
        label="Type"
        value={currentFilters.type}
        onChange={(v) => setFilter(FK.type, v)}
        options={[
          { value: 'commercial', label: 'Commercial' },
          { value: 'loan', label: 'Loan' },
        ]}
        placeholder="All types"
        className="w-32"
      />

      <FilterSelect
        label="Project"
        value={currentFilters.projectId}
        onChange={(v) => setFilter(FK.project, v)}
        options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
        placeholder="All projects"
        className="w-32"
      />

      <FilterSelect
        label="Entity"
        value={currentFilters.entity}
        onChange={(v) => setFilter(FK.entity, v)}
        options={uniqueEntities.map((name) => ({ value: name, label: name }))}
        placeholder="All entities"
        className="w-32"
      />

      <FilterSelect
        label="Currency"
        value={currentFilters.currency}
        onChange={(v) => setFilter(FK.currency, v)}
        options={[
          { value: 'PEN', label: 'PEN' },
          { value: 'USD', label: 'USD' },
        ]}
        placeholder="All"
        className="w-32"
      />

      <SearchInput
        placeholder="Search title…"
        defaultValue={currentFilters.search}
      />

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="self-end rounded px-3 py-1.5 text-sm text-muted hover:text-ink hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
