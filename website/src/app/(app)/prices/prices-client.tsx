'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { formatCurrency, formatDate, formatCategory } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { useUrlSort } from '@/lib/sort-utils'
import { useUrlFilters } from '@/lib/use-url-filters'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { FilterSelect } from '@/components/ui/filter-select'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { FK } from '@/lib/filter-keys'
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
  const { sortColumn, sortDirection, handleSort } = useUrlSort('date', 'desc')
  const { setFilter, clearFilters } = useUrlFilters()

  const hasActiveFilters =
    currentFilters.search !== '' ||
    currentFilters.category !== '' ||
    currentFilters.entityId !== '' ||
    currentFilters.projectId !== '' ||
    currentFilters.tagId !== '' ||
    currentFilters.dateFrom !== '' ||
    currentFilters.dateTo !== ''

  const handleClearFilters = () => clearFilters([FK.search, FK.category, FK.entity, FK.project, FK.tag, FK.dateFrom, FK.dateTo])

  return (
    <div>
      {/* Search + Import */}
      <div className="mt-6 flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchInput
            placeholder="Search by item title..."
            defaultValue={currentFilters.search}
          />
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="shrink-0 self-end rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          Import
        </button>
      </div>

      {/* Filter row */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Date from</label>
          <input
            type="date"
            defaultValue={currentFilters.dateFrom}
            onChange={(e) => setFilter(FK.dateFrom, e.target.value)}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Date to</label>
          <input
            type="date"
            defaultValue={currentFilters.dateTo}
            onChange={(e) => setFilter(FK.dateTo, e.target.value)}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
          />
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
            className="self-end rounded px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                onClick={() => handleSort('date')}
              >
                Date <SortIndicator column="date" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th className="px-4 py-3">Source</th>
              <th
                className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                onClick={() => handleSort('entityName')}
              >
                Supplier <SortIndicator column="entityName" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th
                className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                onClick={() => handleSort('projectCode')}
              >
                Project <SortIndicator column="projectCode" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th
                className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                onClick={() => handleSort('title')}
              >
                Title <SortIndicator column="title" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                onClick={() => handleSort('quantity')}
              >
                Qty <SortIndicator column="quantity" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th className="px-4 py-3">Unit</th>
              <th
                className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                onClick={() => handleSort('unit_price')}
              >
                Unit Price <SortIndicator column="unit_price" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th className="px-4 py-3">Cur.</th>
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
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                    {row.date ? formatDate(row.date) : '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge
                      label={row.source === 'invoice' ? 'Invoice' : 'Quote'}
                      variant={row.source === 'invoice' ? 'zinc' : 'blue'}
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {row.entityName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                    {row.projectCode}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-zinc-700">
                    {row.title || '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-600">
                    {row.quantity !== null ? row.quantity : '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                    {row.unit_of_measure ?? '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                    {row.unit_price !== null
                      ? formatCurrency(row.unit_price, row.currency)
                      : '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                    {row.currency}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
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
