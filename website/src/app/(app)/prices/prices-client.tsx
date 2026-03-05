'use client'

import { useState, useMemo } from 'react'
import { formatCurrency, formatDate, formatCategory } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { useSort, sortRows } from '@/lib/sort-utils'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { FilterSelect } from '@/components/ui/filter-select'
import type { PriceHistoryRow, PriceFilters, PriceSortColumn, PriceFilterOptions } from '@/lib/types'

type Props = {
  data: PriceHistoryRow[]
  filterOptions: PriceFilterOptions
}

export function PricesClient({ data, filterOptions }: Props) {
  const [filters, setFilters] = useState<PriceFilters>({
    titleSearch: '',
    category: '',
    entityId: '',
    projectId: '',
    tagId: '',
    dateFrom: '',
    dateTo: '',
  })
  const { sortColumn, sortDirection, handleSort } = useSort<PriceSortColumn>('date', 'desc')

  // --- Filtering and sorting ---
  const filteredData = useMemo(() => {
    let rows = data

    if (filters.titleSearch) {
      const search = filters.titleSearch.toLowerCase()
      rows = rows.filter((r) => r.title.toLowerCase().includes(search))
    }

    if (filters.category) {
      rows = rows.filter((r) => r.source === 'quote' || r.category === filters.category)
    }

    if (filters.entityId) {
      rows = rows.filter((r) => r.entityId === filters.entityId)
    }

    if (filters.projectId) {
      rows = rows.filter((r) => r.projectId === filters.projectId)
    }

    if (filters.tagId) {
      // Look up tag name from filterOptions, then check entityTags array
      const tag = filterOptions.tags.find((t) => t.id === filters.tagId)
      if (tag) {
        rows = rows.filter((r) => r.entityTags.includes(tag.name))
      }
    }

    if (filters.dateFrom) {
      rows = rows.filter((r) => r.date >= filters.dateFrom)
    }

    if (filters.dateTo) {
      rows = rows.filter((r) => r.date <= filters.dateTo)
    }

    // Sort
    return sortRows(rows, sortColumn, sortDirection, (row, col) => {
      switch (col) {
        case 'date': return row.date
        case 'title': return row.title
        case 'entityName': return row.entityName
        case 'projectCode': return row.projectCode
        case 'unit_price': return row.unit_price
        case 'quantity': return row.quantity
        default: return null
      }
    })
  }, [data, filters, sortColumn, sortDirection, filterOptions.tags])

  const hasActiveFilters =
    filters.titleSearch !== '' ||
    filters.category !== '' ||
    filters.entityId !== '' ||
    filters.projectId !== '' ||
    filters.tagId !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== ''

  // --- Event handlers ---

  function clearFilters() {
    setFilters({
      titleSearch: '',
      category: '',
      entityId: '',
      projectId: '',
      tagId: '',
      dateFrom: '',
      dateTo: '',
    })
  }

  // --- Render ---

  return (
    <div>
      {/* Search */}
      <div className="mt-6">
        <input
          type="text"
          value={filters.titleSearch}
          onChange={(e) => setFilters((f) => ({ ...f, titleSearch: e.target.value }))}
          placeholder="Search by item title..."
          className="w-full rounded border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
        />
      </div>

      {/* Filter row */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <FilterSelect
          label="Category"
          value={filters.category}
          onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
          options={filterOptions.categories.map((cat) => ({ value: cat, label: formatCategory(cat) }))}
          placeholder="All categories"
        />

        <FilterSelect
          label="Supplier"
          value={filters.entityId}
          onChange={(v) => setFilters((f) => ({ ...f, entityId: v }))}
          options={filterOptions.entities.map((e) => ({ value: e.id, label: e.name }))}
          placeholder="All suppliers"
        />

        <FilterSelect
          label="Project"
          value={filters.projectId}
          onChange={(v) => setFilters((f) => ({ ...f, projectId: v }))}
          options={filterOptions.projects.map((p) => ({ value: p.id, label: p.project_code }))}
          placeholder="All projects"
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Date from</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Date to</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
          />
        </div>

        <FilterSelect
          label="Tag"
          value={filters.tagId}
          onChange={(v) => setFilters((f) => ({ ...f, tagId: v }))}
          options={filterOptions.tags.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="All tags"
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="self-end rounded px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mt-4 text-sm text-zinc-500">
        {filteredData.length === 0
          ? 'No results found'
          : `${filteredData.length} result${filteredData.length === 1 ? '' : 's'}`}
      </div>

      {/* Table */}
      <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200">
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
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                  No matching price records found
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                    {row.date ? formatDate(row.date) : '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge
                      label={row.source === 'cost' ? 'Cost' : 'Quote'}
                      variant={row.source === 'cost' ? 'zinc' : 'blue'}
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
                      ? formatCurrency(row.unit_price, row.currency as 'PEN' | 'USD')
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

      {/* Row count */}
      <div className="mt-2 text-xs text-zinc-400">
        {filteredData.length} of {data.length} items
      </div>
    </div>
  )
}
