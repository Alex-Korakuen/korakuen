'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { FilterBar } from '@/components/ui/filter-bar'
import { Pagination } from '@/components/ui/pagination'
import { SectionCard } from '@/components/ui/section-card'
import { HeaderPortal } from '@/components/ui/header-portal'
import { ImportButton } from '@/components/ui/import-button'
import { FK } from '@/lib/filter-keys'
import { formatCategory } from '@/lib/formatters'
import { importPendingInvoices } from '@/lib/import-actions'
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

  return (
    <div>
      <HeaderPortal>
        <ImportButton onClick={() => setShowImport(true)} />
      </HeaderPortal>

      <FilterBar
        currentFilters={currentFilters}
        filters={[
          { type: 'search', placeholder: 'Search by item title...', width: 'min-w-[160px] max-w-[240px] flex-1' },
          { type: 'select', key: FK.category, options: filterOptions.categories.map(cat => ({ value: cat, label: formatCategory(cat) })), placeholder: 'All categories' },
          { type: 'select', key: FK.entity, options: filterOptions.entities.map(e => ({ value: e.id, label: e.name })), placeholder: 'All suppliers' },
          { type: 'select', key: FK.project, options: filterOptions.projects.map(p => ({ value: p.id, label: p.project_code })), placeholder: 'All projects' },
          { type: 'select', key: FK.tag, options: filterOptions.tags.map(t => ({ value: t.id, label: t.name })), placeholder: 'All tags' },
          { type: 'month-range', fromKey: FK.dateFrom, toKey: FK.dateTo },
        ]}
      />

      <SectionCard className="mt-4 overflow-hidden">
        <PricesTable data={data} />
        <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </SectionCard>

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Import Quotes"
        onImport={importPendingInvoices}
      />
    </div>
  )
}
