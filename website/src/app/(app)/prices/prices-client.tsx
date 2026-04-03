'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { FilterBar } from '@/components/ui/filter-bar'
import { Pagination } from '@/components/ui/pagination'
import { SectionCard } from '@/components/ui/section-card'
import { HeaderPortal } from '@/components/ui/header-portal'
import { ImportButton } from '@/components/ui/import-button'
import { Modal } from '@/components/ui/modal'
import { StatusBadge } from '@/components/ui/status-badge'
import { FK } from '@/lib/filter-keys'
import { formatCategory } from '@/lib/formatters'
import { importPendingInvoices } from '@/lib/import-actions'
import { fetchInvoiceDetail } from '@/lib/actions'
import { PricesTable } from './prices-table'
import { QuoteDetailContent } from './quote-detail-content'
import type { PriceHistoryRow, PriceFilterOptions, InvoiceDetailData } from '@/lib/types'

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
  const router = useRouter()
  const [showImport, setShowImport] = useState(false)

  // Modal state
  const [modalRow, setModalRow] = useState<PriceHistoryRow | null>(null)
  const [modalDetail, setModalDetail] = useState<InvoiceDetailData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const handleRowClick = useCallback(async (row: PriceHistoryRow) => {
    setModalRow(row)
    setModalDetail(null)
    setModalLoading(true)
    try {
      const detail = await fetchInvoiceDetail(row.invoiceId)
      setModalDetail(detail)
    } catch (err) {
      console.error('Failed to load quote detail:', err)
    } finally {
      setModalLoading(false)
    }
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalRow(null)
    setModalDetail(null)
  }, [])

  const handleMutationSuccess = useCallback(() => {
    handleCloseModal()
    router.refresh()
  }, [handleCloseModal, router])

  // Modal title from the clicked row
  const modalTitle = modalRow
    ? modalRow.entityName !== '—'
      ? `Quote — ${modalRow.entityName}`
      : 'Quote Detail'
    : ''

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
        <PricesTable data={data} onRowClick={handleRowClick} />
        <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </SectionCard>

      {/* Quote detail modal */}
      <Modal
        isOpen={!!modalRow}
        onClose={handleCloseModal}
        title={modalTitle}
        headerLeft={modalRow ? (
          <StatusBadge
            label={modalRow.quoteStatus === 'accepted' ? 'Accepted' : modalRow.quoteStatus === 'rejected' ? 'Rejected' : 'Pending'}
            variant={modalRow.quoteStatus === 'accepted' ? 'green' : modalRow.quoteStatus === 'rejected' ? 'red' : 'blue'}
          />
        ) : undefined}
        headerRight={modalRow ? (
          <span className="text-xs font-medium text-muted">{modalRow.currency}</span>
        ) : undefined}
      >
        {modalLoading ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-sm text-faint">Loading detail...</span>
          </div>
        ) : modalDetail ? (
          <QuoteDetailContent
            detail={modalDetail}
            entityName={modalRow?.entityName ?? '—'}
            projectCode={modalRow?.projectCode ?? '—'}
            onMutationSuccess={handleMutationSuccess}
          />
        ) : (
          <p className="px-4 py-3 text-sm text-faint">Could not load detail.</p>
        )}
      </Modal>

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Import Quotes"
        onImport={importPendingInvoices}
      />
    </div>
  )
}
