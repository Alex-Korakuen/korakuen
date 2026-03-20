'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { formatCurrency, formatDate, formatCategory } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { useUrlSort } from '@/lib/sort-utils'
import { useUrlFilters } from '@/lib/use-url-filters'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { FilterSelect } from '@/components/ui/filter-select'
import { Pagination } from '@/components/ui/pagination'
import { HeaderPortal } from '@/components/ui/header-portal'
import { FK } from '@/lib/filter-keys'
import { tableHead, selectClass } from '@/lib/styles'
import { importQuotes } from '@/lib/import-actions'
import type { PriceHistoryRow, PriceFilterOptions } from '@/lib/types'

const ImportModal = dynamic(() => import('@/components/ui/import-modal').then(m => ({ default: m.ImportModal })))

type Props = {
  data: PriceHistoryRow[]
  totalCount: number
  page: number
  pageSize: number
  filterOptions: PriceFilterOptions
  currentFilters: {
    search: string
    category: string
    entityId: string
    projectId: string
    tagId: string
    dateFrom: string
    dateTo: string
  }
}

export function PricesClient({
  data,
  totalCount,
  page,
  pageSize,
  filterOptions,
  currentFilters,
}: Props) {
  const [showImport, setShowImport] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchValue, setSearchValue] = useState(currentFilters.search)
  const { sortColumn, sortDirection, handleSort } = useUrlSort('date', 'desc')
  const { setFilter, clearFilters } = useUrlFilters()

  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const hasActiveFilters =
    currentFilters.category !== '' ||
    currentFilters.entityId !== '' ||
    currentFilters.projectId !== '' ||
    currentFilters.tagId !== '' ||
    currentFilters.dateFrom !== '' ||
    currentFilters.dateTo !== ''

  const activeFilterCount = [
    currentFilters.category,
    currentFilters.entityId,
    currentFilters.projectId,
    currentFilters.tagId,
    currentFilters.dateFrom || currentFilters.dateTo ? 'date' : '',
  ].filter(Boolean).length

  // Auto-open filter panel if there are active filters on load
  const [autoOpened] = useState(() => hasActiveFilters)
  const isFiltersOpen = filtersOpen || autoOpened

  const handleClearFilters = () => {
    clearFilters([FK.category, FK.entity, FK.project, FK.tag, FK.dateFrom, FK.dateTo])
    setFiltersOpen(false)
  }

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
    <div>
      {/* Import button in header via portal */}
      <HeaderPortal>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
          </svg>
          Import
        </button>
      </HeaderPortal>

      {/* Toolbar: search + filter toggle */}
      <div className="mt-6 rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Search with icon */}
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
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
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-3 text-sm text-zinc-700 outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setFiltersOpen(!isFiltersOpen)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
              isFiltersOpen
                ? 'border-blue-200 bg-blue-50 text-blue-600'
                : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Collapsible filter panel */}
        {isFiltersOpen && (
          <div className="border-t border-zinc-100 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <FilterSelect
                label="Category"
                value={currentFilters.category}
                onChange={(v) => setFilter(FK.category, v)}
                options={filterOptions.categories.map((cat) => ({ value: cat, label: formatCategory(cat) }))}
                placeholder="All categories"
              />

              <FilterSelect
                label="Supplier"
                value={currentFilters.entityId}
                onChange={(v) => setFilter(FK.entity, v)}
                options={filterOptions.entities.map((e) => ({ value: e.id, label: e.name }))}
                placeholder="All suppliers"
              />

              <FilterSelect
                label="Project"
                value={currentFilters.projectId}
                onChange={(v) => setFilter(FK.project, v)}
                options={filterOptions.projects.map((p) => ({ value: p.id, label: p.project_code }))}
                placeholder="All projects"
              />

              {/* Date range: from — to */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Date range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    defaultValue={currentFilters.dateFrom}
                    onChange={(e) => setFilter(FK.dateFrom, e.target.value)}
                    className={selectClass}
                  />
                  <span className="text-xs text-zinc-400">—</span>
                  <input
                    type="date"
                    defaultValue={currentFilters.dateTo}
                    onChange={(e) => setFilter(FK.dateTo, e.target.value)}
                    className={selectClass}
                  />
                </div>
              </div>

              <FilterSelect
                label="Tag"
                value={currentFilters.tagId}
                onChange={(v) => setFilter(FK.tag, v)}
                options={filterOptions.tags.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="All tags"
              />

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="self-end rounded px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:text-red-500"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={tableHead}>
              <tr>
                <th
                  className="cursor-pointer px-4 py-3 text-center hover:text-zinc-700"
                  onClick={() => handleSort('date')}
                >
                  Date <SortIndicator column="date" sortColumn={sortColumn} sortDirection={sortDirection} />
                </th>
                <th className="px-4 py-3 text-center">Source</th>
                <th
                  className="cursor-pointer px-4 py-3 text-center hover:text-zinc-700"
                  onClick={() => handleSort('entityName')}
                >
                  Supplier <SortIndicator column="entityName" sortColumn={sortColumn} sortDirection={sortDirection} />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-center hover:text-zinc-700"
                  onClick={() => handleSort('projectCode')}
                >
                  Project <SortIndicator column="projectCode" sortColumn={sortColumn} sortDirection={sortDirection} />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-center hover:text-zinc-700"
                  onClick={() => handleSort('title')}
                >
                  Title <SortIndicator column="title" sortColumn={sortColumn} sortDirection={sortDirection} />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-center hover:text-zinc-700"
                  onClick={() => handleSort('quantity')}
                >
                  Qty <SortIndicator column="quantity" sortColumn={sortColumn} sortDirection={sortDirection} />
                </th>
                <th className="px-4 py-3 text-center">Unit</th>
                <th
                  className="cursor-pointer px-4 py-3 text-center hover:text-zinc-700"
                  onClick={() => handleSort('unit_price')}
                >
                  Unit Price <SortIndicator column="unit_price" sortColumn={sortColumn} sortDirection={sortDirection} />
                </th>
                <th className="px-4 py-3 text-center">Cur.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                    No matching price records found
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-4 py-3 text-center text-zinc-700">
                      {row.date ? formatDate(row.date) : '--'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <StatusBadge
                        label={row.source === 'invoice' ? 'Invoice' : 'Quote'}
                        variant={row.source === 'invoice' ? 'zinc' : 'blue'}
                      />
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-700">
                      {row.entityName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center font-mono text-xs text-zinc-500">
                      {row.projectCode}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-center text-zinc-700">
                      {row.title || '--'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-zinc-600">
                      {row.quantity !== null ? row.quantity : '--'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-zinc-500">
                      {row.unit_of_measure ?? '--'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center font-mono text-zinc-700">
                      {row.unit_price !== null
                        ? formatCurrency(row.unit_price, row.currency)
                        : '--'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-zinc-500">
                      {row.currency}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination inside the table card */}
        <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </div>

      {/* Import modal */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Import Quotes"
        onImport={importQuotes}
      />
    </div>
  )
}
