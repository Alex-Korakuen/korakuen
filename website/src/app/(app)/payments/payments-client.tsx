'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { FK } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailById, fetchLoanDetailByScheduleId, fetchBankAccountsForPayment } from '@/lib/actions'
import type { BankAccountOption } from '@/lib/actions'
import { importPayments } from '@/lib/import-actions'
import { useAuth } from '@/lib/auth-context'
import { DualAmount } from '@/components/ui/dual-amount'
import { Modal } from '@/components/ui/modal'
import { StatusBadge } from '@/components/ui/status-badge'
import { HeaderPortal } from '@/components/ui/header-portal'
import { ImportButton } from '@/components/ui/import-button'
import { Pagination } from '@/components/ui/pagination'
import { SectionCard } from '@/components/ui/section-card'
import { FilterBar } from '@/components/ui/filter-bar'
import { PaymentsTable } from './payments-table'
import { PaymentExpandContent } from './payment-expand-content'
import { getDirectionColorClass, getPaymentTypeLabel, getPaymentTypeBadgeVariant } from './helpers'
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
  partners: { id: string; label: string }[]
  categories: { value: string; label: string }[]
  entities: { value: string; label: string }[]
  currentFilters: {
    month: string
    partnerId: string
    projectId: string
    category: string
    entity: string
    bankAccountId: string
    direction: string
    paymentType: string
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
  partners,
  categories,
  entities,
  currentFilters,
}: Props) {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [showImport, setShowImport] = useState(false)
  const [modalRow, setModalRow] = useState<PaymentsPageRow | null>(null)
  const [modalDetail, setModalDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'delete'>('view')
  const [modalBankAccounts, setModalBankAccounts] = useState<BankAccountOption[]>([])

  // Keep modal row in sync after router.refresh() updates the data prop.
  // Intentionally depends on `data` only — re-running on `modalRow` changes
  // would overwrite local state while the user is actively interacting with the modal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (modalRow) {
      const updated = data.find(r => r.id === modalRow.id)
      if (updated) setModalRow(updated)
    }
  }, [data])

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

  const modalTitle = 'Payment Detail'
  const modalHeaderRight = modalRow ? (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block rounded-full px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.04em] ${getDirectionColorClass(modalRow.direction)}`}>
        {modalRow.direction === 'inbound' ? 'Inbound' : 'Outbound'}
      </span>
      <StatusBadge label={getPaymentTypeLabel(modalRow.payment_type)} variant={getPaymentTypeBadgeVariant(modalRow.payment_type)} />
    </div>
  ) : undefined

  return (
    <div>
      {isAdmin && (
        <HeaderPortal>
          <ImportButton onClick={() => setShowImport(true)} />
        </HeaderPortal>
      )}

      <FilterBar
        currentFilters={currentFilters}
        filters={[
          { type: 'month', key: FK.month },
          { type: 'select', key: FK.partner, options: partners.map(p => ({ value: p.id, label: p.label })), placeholder: 'All partners' },
          { type: 'select', key: FK.project, options: projects.map(p => ({ value: p.id, label: p.project_code })), placeholder: 'All projects' },
          { type: 'select', key: FK.category, options: categories, placeholder: 'All categories' },
          { type: 'select', key: FK.entity, options: entities, placeholder: 'All entities' },
          { type: 'select', key: FK.bank, options: bankAccounts.map(b => ({ value: b.id, label: b.label })), placeholder: 'All banks' },
          { type: 'select', key: FK.direction, options: [{ value: 'outbound', label: 'Outflow' }, { value: 'inbound', label: 'Inflow' }], placeholder: 'All directions' },
          { type: 'select', key: FK.type, options: [{ value: 'regular', label: 'Regular' }, { value: 'detraccion', label: 'Detracción' }, { value: 'retencion', label: 'Retención' }], placeholder: 'All types' },
        ]}
      />

      {/* Table card: table + footer summary + pagination */}
      <SectionCard className="mt-4 overflow-hidden">
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
      </SectionCard>

      {/* Detail modal */}
      <Modal
        isOpen={modalRow !== null}
        onClose={handleCloseModal}
        title={modalTitle}
        headerRight={modalHeaderRight}
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
      {isAdmin && (
        <ImportModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          title="Import Payments"
          onImport={importPayments}
        />
      )}
    </div>
  )
}
