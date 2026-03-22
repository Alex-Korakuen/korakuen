'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { FilterSelect } from '@/components/ui/filter-select'
import { FK } from '@/lib/filter-keys'
import { selectClass } from '@/lib/styles'
import { formatCategory } from '@/lib/formatters'
import type { PriceFilterOptions } from '@/lib/types'

type Props = {
  currentFilters: {
    search: string
    category: string
    entityId: string
    projectId: string
    tagId: string
    dateFrom: string
    dateTo: string
  }
  filterOptions: PriceFilterOptions
  setFilter: (key: string, value: string) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function PricesFilters({
  currentFilters,
  filterOptions,
  setFilter,
  hasActiveFilters,
  onClearFilters,
}: Props) {
  const [searchValue, setSearchValue] = useState(currentFilters.search)
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  function submitSearch() {
    const params = new URLSearchParams(searchParams.toString())
    if (searchValue.trim()) {
      params.set('search', searchValue.trim())
    } else {
      params.delete('search')
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 320 }}>
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </span>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
          placeholder="Search by item title..."
          className="w-full rounded-md border border-edge-strong py-1.5 pl-8 pr-3 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Category */}
      <FilterSelect
        value={currentFilters.category}
        onChange={(v) => setFilter(FK.category, v)}
        options={filterOptions.categories.map((cat) => ({ value: cat, label: formatCategory(cat) }))}
        placeholder="All categories"
      />

      {/* Supplier */}
      <FilterSelect
        value={currentFilters.entityId}
        onChange={(v) => setFilter(FK.entity, v)}
        options={filterOptions.entities.map((e) => ({ value: e.id, label: e.name }))}
        placeholder="All suppliers"
      />

      {/* Project */}
      <FilterSelect
        value={currentFilters.projectId}
        onChange={(v) => setFilter(FK.project, v)}
        options={filterOptions.projects.map((p) => ({ value: p.id, label: p.project_code }))}
        placeholder="All projects"
      />

      {/* Tag */}
      <FilterSelect
        value={currentFilters.tagId}
        onChange={(v) => setFilter(FK.tag, v)}
        options={filterOptions.tags.map((t) => ({ value: t.id, label: t.name }))}
        placeholder="All tags"
      />

      {/* Date range */}
      <input
        type="date"
        defaultValue={currentFilters.dateFrom}
        onChange={(e) => setFilter(FK.dateFrom, e.target.value)}
        className={selectClass}
      />
      <span className="text-xs text-faint">—</span>
      <input
        type="date"
        defaultValue={currentFilters.dateTo}
        onChange={(e) => setFilter(FK.dateTo, e.target.value)}
        className={selectClass}
      />

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded px-2 py-1.5 text-sm text-muted transition-colors hover:text-negative"
        >
          Clear
        </button>
      )}
    </div>
  )
}
