import type { EntityListItem, EntitiesFilterOptions, EntityFilters } from '@/lib/types'
import { FilterSelect } from '@/components/ui/filter-select'
import { tagColor } from './helpers'

type Props = {
  entities: EntityListItem[]
  filtered: EntityListItem[]
  filterOptions: EntitiesFilterOptions
  filters: EntityFilters
  setFilters: React.Dispatch<React.SetStateAction<EntityFilters>>
  selectedId: string | null
  onSelect: (id: string | null) => void
  hidden: boolean
}

export function EntitiesListPanel({
  entities,
  filtered,
  filterOptions,
  filters,
  setFilters,
  selectedId,
  onSelect,
  hidden,
}: Props) {
  return (
    <div className={`w-full shrink-0 md:w-[320px] ${hidden ? 'hidden md:block' : ''}`}>
      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search entities..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 placeholder-zinc-400"
        />
      </div>

      {/* Filter row */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <FilterSelect
          label="Type"
          value={filters.entityType}
          onChange={(v) => setFilters((f) => ({ ...f, entityType: v }))}
          options={[
            { value: 'company', label: 'Company' },
            { value: 'individual', label: 'Individual' },
          ]}
          placeholder="All Types"
        />
        <FilterSelect
          label="Tag"
          value={filters.tagId}
          onChange={(v) => setFilters((f) => ({ ...f, tagId: v }))}
          options={filterOptions.tags.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="All Tags"
        />
        <FilterSelect
          label="City"
          value={filters.city}
          onChange={(v) => setFilters((f) => ({ ...f, city: v }))}
          options={filterOptions.cities.map((c) => ({ value: c, label: c }))}
          placeholder="All Cities"
        />
        <FilterSelect
          label="Region"
          value={filters.region}
          onChange={(v) => setFilters((f) => ({ ...f, region: v }))}
          options={filterOptions.regions.map((r) => ({ value: r, label: r }))}
          placeholder="All Regions"
        />
      </div>

      {/* Entity list */}
      <div className="rounded-lg border border-zinc-200">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            No entities match filters
          </div>
        ) : (
          <div className="max-h-[calc(100vh-260px)] divide-y divide-zinc-100 overflow-y-auto">
            {filtered.map((entity) => (
              <button
                key={entity.id}
                onClick={() => onSelect(entity.id)}
                className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-blue-50 ${
                  selectedId === entity.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800">
                      {entity.common_name || entity.legal_name}
                    </p>
                    {entity.common_name && entity.common_name !== entity.legal_name && (
                      <p className="truncate text-xs text-zinc-500">{entity.legal_name}</p>
                    )}
                  </div>
                  {entity.document_number && (
                    <span className="shrink-0 text-xs font-mono text-zinc-400">
                      {entity.document_number}
                    </span>
                  )}
                </div>
                {entity.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entity.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tagColor(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-zinc-400">
        {filtered.length} of {entities.length} entities
      </p>
    </div>
  )
}
