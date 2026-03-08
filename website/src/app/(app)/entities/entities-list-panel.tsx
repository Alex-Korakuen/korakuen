import type { EntityListItem, EntitiesFilterOptions } from '@/lib/types'
import { FilterSelect } from '@/components/ui/filter-select'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { useUrlFilters } from '@/lib/use-url-filters'
import { tagColor } from './helpers'

type Props = {
  entities: EntityListItem[]
  totalCount: number
  page: number
  pageSize: number
  filterOptions: EntitiesFilterOptions
  currentFilters: {
    search: string
    entityType: string
    tagId: string
    city: string
    region: string
  }
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreateEntity: () => void
  hidden: boolean
}

export function EntitiesListPanel({
  entities,
  totalCount,
  page,
  pageSize,
  filterOptions,
  currentFilters,
  selectedId,
  onSelect,
  onCreateEntity,
  hidden,
}: Props) {
  const { setFilter } = useUrlFilters()

  return (
    <div className={`w-full shrink-0 md:w-[320px] ${hidden ? 'hidden md:block' : ''}`}>
      {/* Search + Create */}
      <div className="mb-3 flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchInput
            placeholder="Search entities..."
            defaultValue={currentFilters.search}
          />
        </div>
        <button
          onClick={onCreateEntity}
          className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          + Create
        </button>
      </div>

      {/* Filter row */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <FilterSelect
          label="Type"
          value={currentFilters.entityType}
          onChange={(v) => setFilter('entityType', v)}
          options={[
            { value: 'company', label: 'Company' },
            { value: 'individual', label: 'Individual' },
          ]}
          placeholder="All Types"
        />
        <FilterSelect
          label="Tag"
          value={currentFilters.tagId}
          onChange={(v) => setFilter('tagId', v)}
          options={filterOptions.tags.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="All Tags"
        />
        <FilterSelect
          label="City"
          value={currentFilters.city}
          onChange={(v) => setFilter('city', v)}
          options={filterOptions.cities.map((c) => ({ value: c, label: c }))}
          placeholder="All Cities"
        />
        <FilterSelect
          label="Region"
          value={currentFilters.region}
          onChange={(v) => setFilter('region', v)}
          options={filterOptions.regions.map((r) => ({ value: r, label: r }))}
          placeholder="All Regions"
        />
      </div>

      {/* Entity list */}
      <div className="rounded-lg border border-zinc-200">
        {entities.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            No entities match filters
          </div>
        ) : (
          <div className="max-h-[calc(100vh-340px)] divide-y divide-zinc-100 overflow-y-auto">
            {entities.map((entity) => (
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

      <div className="mt-2">
        <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </div>
    </div>
  )
}
