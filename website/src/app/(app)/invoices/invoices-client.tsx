'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useUrlFilters } from '@/lib/use-url-filters'
import { FK } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailById } from '@/lib/actions'
import { importInvoices } from '@/lib/import-actions'
import { Modal } from '@/components/ui/modal'
import { HeaderPortal } from '@/components/ui/header-portal'
import { Pagination } from '@/components/ui/pagination'
import { SectionCard } from '@/components/ui/section-card'

const ImportModal = dynamic(() => import('@/components/ui/import-modal').then(m => ({ default: m.ImportModal })))
import { InvoicesFilters } from './invoices-filters'
import { InvoicesTable } from './invoices-table'
import { InvoiceExpandContent } from './invoice-expand-content'
import { LoanExpandContent } from './loan-expand-content'
import type {
  InvoicesPageRow,
  InvoiceDetailData,
  LoanDetailData,
  CategoryOption,
  PartnerOption,
} from '@/lib/types'

type Props = {
  data: InvoicesPageRow[]
  totalCount: number
  page: number
  pageSize: number
  projects: { id: string; project_code: string; name: string }[]
  uniqueEntities: string[]
  uniqueCategories: { value: string; label: string }[]
  categories: CategoryOption[]
  partners: PartnerOption[]
  currentFilters: {
    month: string
    partnerId: string
    projectId: string
    category: string
    entity: string
    direction: string
    type: string
    status: string
  }
}

export function InvoicesClient({
  data,
  totalCount,
  page,
  pageSize,
  projects,
  uniqueEntities,
  uniqueCategories,
  categories,
  partners,
  currentFilters,
}: Props) {
  const router = useRouter()
  const { setFilter, clearFilters } = useUrlFilters()

  const [showImport, setShowImport] = useState(false)
  const [modalRow, setModalRow] = useState<InvoicesPageRow | null>(null)
  const [modalDetail, setModalDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'delete'>('view')

  const hasActiveFilters =
    currentFilters.month !== '' ||
    currentFilters.partnerId !== '' ||
    currentFilters.projectId !== '' ||
    currentFilters.category !== '' ||
    currentFilters.entity !== '' ||
    currentFilters.direction !== '' ||
    currentFilters.type !== '' ||
    currentFilters.status !== ''

  const handleClearFilters = () => clearFilters([
    FK.month, FK.partner, FK.project, FK.category, FK.entity,
    FK.direction, FK.type, FK.status,
  ])

  const fetchDetail = useCallback(async (row: InvoicesPageRow) => {
    setModalDetail(null)
    setModalLoading(true)
    try {
      if (row.type === 'loan' && row.loan_id) {
        setModalDetail(await fetchLoanDetailById(row.loan_id))
      } else {
        setModalDetail(await fetchInvoiceDetail(row.id))
      }
    } catch (err) {
      console.error('Failed to load invoice detail:', err)
      setModalDetail(null)
    } finally {
      setModalLoading(false)
    }
  }, [])

  const handleRowClick = useCallback(async (row: InvoicesPageRow) => {
    setModalRow(row)
    setModalMode('view')
    await fetchDetail(row)
  }, [fetchDetail])

  const handleCloseModal = useCallback(() => {
    setModalRow(null)
    setModalDetail(null)
    setModalMode('view')
  }, [])

  const handleMutationSuccess = useCallback(() => {
    handleCloseModal()
    router.refresh()
  }, [handleCloseModal, router])

  const handlePaymentSuccess = useCallback(() => {
    if (modalRow) fetchDetail(modalRow)
    router.refresh()
  }, [modalRow, fetchDetail, router])

  // Modal title
  const modalTitle = modalRow
    ? modalRow.type === 'loan'
      ? 'Loan Detail'
      : modalMode === 'edit'
        ? 'Edit Invoice'
        : modalRow.invoice_number
          ? `Invoice ${modalRow.invoice_number}`
          : 'Invoice Detail'
    : ''

  return (
    <div>
      <HeaderPortal>
        <button onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-edge-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
          </svg>
          Import
        </button>
      </HeaderPortal>

      <InvoicesFilters
        currentFilters={currentFilters}
        setFilter={setFilter}
        projects={projects}
        partners={partners}
        uniqueEntities={uniqueEntities}
        uniqueCategories={uniqueCategories}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      <SectionCard className="mt-4 overflow-hidden">
        <InvoicesTable
          data={data}
          onRowClick={handleRowClick}
        />
        <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </SectionCard>

      <Modal isOpen={modalRow !== null} onClose={handleCloseModal} title={modalTitle}>
        {modalLoading ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-sm text-faint">Loading detail...</span>
          </div>
        ) : modalRow && modalDetail ? (
          modalRow.type === 'loan' ? (
            <LoanExpandContent detail={modalDetail as LoanDetailData} onRepaymentSuccess={handlePaymentSuccess} />
          ) : (
            <InvoiceExpandContent
              detail={modalDetail as InvoiceDetailData} row={modalRow} mode={modalMode}
              onSetMode={setModalMode} onMutationSuccess={handleMutationSuccess}
              onPaymentSuccess={handlePaymentSuccess} categories={categories}
            />
          )
        ) : null}
      </Modal>

      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)}
        title="Import Invoices" onImport={importInvoices} />

    </div>
  )
}
