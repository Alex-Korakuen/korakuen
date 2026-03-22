'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useUrlFilters } from '@/lib/use-url-filters'
import { FK } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailById, fetchLoanDetailByScheduleId, fetchBankAccountsForPayment } from '@/lib/actions'
import type { BankAccountOption } from '@/lib/actions'
import { importPayments } from '@/lib/import-actions'
import { DualAmount } from '@/components/ui/dual-amount'
import { Modal } from '@/components/ui/modal'
import { HeaderPortal } from '@/components/ui/header-portal'
import { Pagination } from '@/components/ui/pagination'
import { PaymentsFilters } from './payments-filters'
import { PaymentsTable } from './payments-table'
import { PaymentExpandContent } from './payment-expand-content'
import type { PaymentsPageRow, PaymentsSummary, InvoiceDetailData, LoanDetailData } from '@/lib/types'

const ImportModal = dynamic(() => import('@/components/ui/import-modal').then(m => ({ default: m.ImportModal })))

type Props = {
  data: PaymentsPageRow[]
  totalCount: number
  page: number
  pageSize: number
  summary: PaymentsSummary
  projects: { id: string; project_code: string }[]
  bankAccounts: { id: string; label: string }[]
  currentFilters: {
    direction: string
    paymentType: string
    relatedTo: string
    projectId: string
    bankAccountId: string
    search: string
    month: string
  }
}

export function PaymentsClient({
  data,
  totalCount,
  page,
  pageSize,
  summary,
  projects,
  bankAccounts,
  currentFilters,
}: Props) {
  const router = useRouter()
  const { setFilter, clearFilters } = useUrlFilters()

  const [showImport, setShowImport] = useState(false)
  const [modalRow, setModalRow] = useState<PaymentsPageRow | null>(null)
  const [modalDetail, setModalDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'delete'>('view')
  const [modalBankAccounts, setModalBankAccounts] = useState<BankAccountOption[]>([])

  const hasActiveFilters =
    currentFilters.direction !== '' ||
    currentFilters.paymentType !== '' ||
    currentFilters.relatedTo !== '' ||
    currentFilters.projectId !== '' ||
    currentFilters.bankAccountId !== '' ||
    currentFilters.search !== '' ||
    currentFilters.month !== ''

  const handleClearFilters = () => clearFilters([
    FK.direction, FK.type, FK.related, FK.project, FK.bank, FK.search,
    FK.month,
  ])

  const handleRowClick = useCallback(async (row: PaymentsPageRow) => {
    setModalRow(row)
    setModalDetail(null)
    setModalLoading(true)
    setModalMode('view')
    setModalBankAccounts([])

    try {
      // Load related detail and bank accounts in parallel
      const detailPromise = row.related_to === 'loan' && row.related_id
        ? fetchLoanDetailById(row.related_id)
        : row.related_to === 'loan_schedule' && row.related_id
          ? fetchLoanDetailByScheduleId(row.related_id)
          : row.related_id
            ? fetchInvoiceDetail(row.related_id)
            : Promise.resolve(null)

      const bankPromise = row.partner_id
        ? fetchBankAccountsForPayment(row.partner_id)
        : Promise.resolve([])

      const [detail, banks] = await Promise.all([detailPromise, bankPromise])
      setModalDetail(detail)
      setModalBankAccounts(banks)
    } catch (err) {
      console.error('Failed to load payment detail:', err)
      setModalDetail(null)
    } finally {
      setModalLoading(false)
    }
  }, [])

  const handleCloseModal = () => {
    setModalRow(null)
    setModalDetail(null)
    setModalMode('view')
  }

  const handleMutationSuccess = () => {
    setModalRow(null)
    setModalDetail(null)
    setModalMode('view')
    router.refresh()
  }

  const modalTitle = modalMode === 'edit' ? 'Edit Payment'
    : modalMode === 'delete' ? 'Payment Detail'
    : 'Payment Detail'

  return (
    <div>
      {/* Import button in header via portal */}
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

      <PaymentsFilters
        currentFilters={currentFilters}
        setFilter={setFilter}
        projects={projects}
        bankAccounts={bankAccounts}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Table card: table + footer summary + pagination */}
      <div className="mt-4 overflow-hidden rounded-[10px] border border-edge bg-white">
        <PaymentsTable
          data={data}
          onRowClick={handleRowClick}
        />

        {/* Footer summary */}
        {summary.count > 0 && (
          <div className="border-t border-edge bg-panel/80 px-4 py-2.5">
            <div className="flex items-center gap-6 text-xs">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-positive">In</span>
                <DualAmount pen={summary.inflows.pen} usd={summary.inflows.usd} />
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-negative">Out</span>
                <DualAmount pen={summary.outflows.pen} usd={summary.outflows.usd} />
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-indigo-600">Net</span>
                <DualAmount pen={summary.net.pen} usd={summary.net.usd} />
              </span>
            </div>
          </div>
        )}

        <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </div>

      {/* Detail modal */}
      <Modal
        isOpen={modalRow !== null}
        onClose={handleCloseModal}
        title={modalTitle}
      >
        {modalLoading ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-sm text-faint">Loading detail...</span>
          </div>
        ) : modalRow ? (
          <PaymentExpandContent
            row={modalRow}
            relatedDetail={modalDetail}
            mode={modalMode}
            onSetMode={setModalMode}
            onMutationSuccess={handleMutationSuccess}
            bankAccounts={modalBankAccounts}
          />
        ) : null}
      </Modal>

      {/* Import modal */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Import Payments"
        onImport={importPayments}
      />
    </div>
  )
}
