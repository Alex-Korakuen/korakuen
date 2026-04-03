'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { FK } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailById } from '@/lib/actions'
import { importInvoices } from '@/lib/import-actions'
import { Modal } from '@/components/ui/modal'
import { StatusBadge } from '@/components/ui/status-badge'
import { HeaderPortal } from '@/components/ui/header-portal'
import { ImportButton } from '@/components/ui/import-button'
import { Pagination } from '@/components/ui/pagination'
import { SectionCard } from '@/components/ui/section-card'

const ImportModal = dynamic(() => import('@/components/ui/import-modal').then(m => ({ default: m.ImportModal })))
import { FilterBar } from '@/components/ui/filter-bar'
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
    kind: string
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
  const [showImport, setShowImport] = useState(false)
  const [modalRow, setModalRow] = useState<InvoicesPageRow | null>(null)
  const [modalDetail, setModalDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'delete'>('view')

  // Keep modal row in sync after router.refresh() updates the data prop
  useEffect(() => {
    if (modalRow) {
      const updated = data.find(r => r.id === modalRow.id)
      if (updated) setModalRow(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

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
      : modalRow.invoice_number
        ? `Invoice ${modalRow.invoice_number}`
        : 'Invoice Detail'
    : ''

  return (
    <div>
      <HeaderPortal>
        <ImportButton onClick={() => setShowImport(true)} />
      </HeaderPortal>

      <FilterBar
        currentFilters={currentFilters}
        clearKeys={[FK.month, FK.partner, FK.project, FK.category, FK.entity, FK.direction, FK.type, FK.kind, FK.status]}
        filters={[
          { type: 'month', key: FK.month },
          { type: 'select', key: FK.partner, options: partners.map(p => ({ value: p.id, label: p.name })), placeholder: 'All partners' },
          { type: 'select', key: FK.project, options: projects.map(p => ({ value: p.id, label: p.project_code })), placeholder: 'All projects' },
          { type: 'select', key: FK.category, options: uniqueCategories, placeholder: 'All categories' },
          { type: 'select', key: FK.entity, options: uniqueEntities.map(n => ({ value: n, label: n })), placeholder: 'All entities' },
          {
            type: 'select', key: FK.direction,
            value: currentFilters.direction || currentFilters.type,
            onChange: (v, { setFilters }) => {
              if (v === 'loan') setFilters({ [FK.direction]: '', [FK.type]: 'loan' })
              else setFilters({ [FK.type]: '', [FK.direction]: v })
            },
            options: [{ value: 'payable', label: 'Outflow' }, { value: 'receivable', label: 'Inflow' }, { value: 'loan', label: 'Loan' }],
            placeholder: 'All directions',
          },
          { type: 'select', key: FK.kind, options: [{ value: 'quote', label: 'Quotes' }, { value: 'invoice', label: 'Invoices' }], placeholder: 'All types' },
          { type: 'select', key: FK.status, options: [{ value: 'pending', label: 'Pending' }, { value: 'partial', label: 'Partial' }, { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' }], placeholder: 'All statuses' },
        ]}
      />

      <SectionCard className="mt-4 overflow-hidden">
        <InvoicesTable
          data={data}
          onRowClick={handleRowClick}
        />
        <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </SectionCard>

      <Modal
        isOpen={modalRow !== null}
        onClose={handleCloseModal}
        title={modalTitle}
        headerLeft={modalRow && modalRow.type !== 'loan' ? (
          <div className="flex items-center gap-2">
            <StatusBadge
              label={modalRow.direction === 'receivable' ? 'Receivable' : 'Payable'}
              variant={modalRow.direction === 'receivable' ? 'green' : 'blue'}
            />
            {modalRow.comprobante_type === 'pending' && (
              <StatusBadge label="Pending" variant="yellow" />
            )}
          </div>
        ) : undefined}
        headerRight={modalRow && modalRow.type !== 'loan' ? (
          <span className="text-xs font-medium text-muted">{modalRow.currency}</span>
        ) : undefined}
      >
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
