'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useUrlFilters } from '@/lib/use-url-filters'
import { FK, hasActiveFilters } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailById } from '@/lib/actions'
import { importInvoices } from '@/lib/import-actions'
import { Modal } from '@/components/ui/modal'
import { HeaderPortal } from '@/components/ui/header-portal'
import { ImportButton } from '@/components/ui/import-button'
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

  const filtersActive = hasActiveFilters(currentFilters)

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
        <ImportButton onClick={() => setShowImport(true)} />
      </HeaderPortal>

      <InvoicesFilters
        currentFilters={currentFilters}
        setFilter={setFilter}
        projects={projects}
        partners={partners}
        uniqueEntities={uniqueEntities}
        uniqueCategories={uniqueCategories}
        hasActiveFilters={filtersActive}
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
