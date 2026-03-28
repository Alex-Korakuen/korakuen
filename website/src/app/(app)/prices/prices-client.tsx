'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useUrlFilters } from '@/lib/use-url-filters'
import { Pagination } from '@/components/ui/pagination'
import { SectionCard } from '@/components/ui/section-card'
import { HeaderPortal } from '@/components/ui/header-portal'
import { FK, hasActiveFilters } from '@/lib/filter-keys'
import { importQuotes } from '@/lib/import-actions'
import { PricesFilters } from './prices-filters'
import { PricesTable } from './prices-table'
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
  const { setFilter, clearFilters } = useUrlFilters()

  const filtersActive = hasActiveFilters(currentFilters)

  const handleClearFilters = () => {
    clearFilters([FK.search, FK.category, FK.entity, FK.project, FK.tag, FK.dateFrom, FK.dateTo])
  }

  return (
    <div>
      <HeaderPortal>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-edge-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
          </svg>
          Import
        </button>
      </HeaderPortal>

      <PricesFilters
        currentFilters={currentFilters}
        filterOptions={filterOptions}
        setFilter={setFilter}
        hasActiveFilters={filtersActive}
        onClearFilters={handleClearFilters}
      />

      <SectionCard className="mt-4 overflow-hidden">
        <PricesTable data={data} />
        <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </SectionCard>

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Import Quotes"
        onImport={importQuotes}
      />
    </div>
  )
}
