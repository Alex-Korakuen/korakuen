'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { FK } from '@/lib/filter-keys'
import { selectClass } from '@/lib/styles'

type Props = {
  currentFilters: {
    direction: string
    type: string
    status: string
    projectId: string
    entity: string
    search: string
  }
  setFilter: (key: string, value: string) => void
  projects: { id: string; project_code: string; name: string }[]
  uniqueEntities: string[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function InvoicesFilters({
  currentFilters,
  setFilter,
  projects,
  uniqueEntities,
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
      params.set(FK.search, searchValue.trim())
    } else {
      params.delete(FK.search)
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
          placeholder="Search by invoice #, entity..."
          className="w-full rounded-md border border-edge-strong py-1.5 pl-8 pr-3 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Direction */}
      <select
        value={currentFilters.direction || currentFilters.type}
        onChange={(e) => {
          const v = e.target.value
          if (v === 'loan') {
            setFilter(FK.direction, '')
            setFilter(FK.type, 'loan')
          } else {
            setFilter(FK.type, '')
            setFilter(FK.direction, v)
          }
        }}
        className={selectClass}
      >
        <option value="">All Directions</option>
        <option value="payable">Payable</option>
        <option value="receivable">Receivable</option>
        <option value="loan">Loan</option>
      </select>

      {/* Status */}
      <select
        value={currentFilters.status}
        onChange={(e) => setFilter(FK.status, e.target.value)}
        className={selectClass}
      >
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="partial">Partial</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
      </select>

      {/* Project */}
      <select
        value={currentFilters.projectId}
        onChange={(e) => setFilter(FK.project, e.target.value)}
        className={selectClass}
      >
        <option value="">All Projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.project_code}</option>
        ))}
      </select>

      {/* Entity */}
      <select
        value={currentFilters.entity}
        onChange={(e) => setFilter(FK.entity, e.target.value)}
        className={selectClass}
      >
        <option value="">All Entities</option>
        {uniqueEntities.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>

      {/* Clear */}
      {hasActiveFilters && (
        <button type="button" onClick={onClearFilters}
          className="rounded px-2 py-1.5 text-sm text-muted transition-colors hover:text-negative">
          Clear
        </button>
      )}
    </div>
  )
}
