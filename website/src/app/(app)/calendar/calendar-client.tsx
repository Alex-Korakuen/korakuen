'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUrlFilters } from '@/lib/use-url-filters'
import { getCalendarBucket } from '@/lib/date-utils'
import { FK } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailById } from '@/lib/actions'
import { Modal } from '@/components/ui/modal'
import { HeaderPortal } from '@/components/ui/header-portal'
import { DirectTransactionModal } from '@/components/ui/direct-transaction-modal'
import { InvoiceExpandContent } from '../invoices/invoice-expand-content'
import { LoanExpandContent } from '../invoices/loan-expand-content'
import { CalendarFilters } from './calendar-filters'
import { CalendarTable } from './calendar-table'
import type {
  Currency,
  ObligationCalendarRow,
  InvoicesPageRow,
  InvoiceDetailData,
  LoanDetailData,
  CalendarBucketId as BucketId,
  CategoryOption,
  PartnerCompanyOption,
} from '@/lib/types'

export type SectionTotals = {
  pay: { pen: number; usd: number; count: number }
  collect: { pen: number; usd: number; count: number }
}

type Props = {
  data: ObligationCalendarRow[]
  projects: { id: string; project_code: string; name: string }[]
  uniqueEntities: string[]
  categories: CategoryOption[]
  partners: PartnerCompanyOption[]
  currentFilters: {
    type: string
    projectId: string
    entity: string
    currency: string
    search: string
  }
}

const BUCKET_ORDER: { id: Exclude<BucketId, 'all'>; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'next-7', label: 'Next 7 Days' },
  { id: 'next-30', label: 'Next 30 Days' },
  { id: 'later', label: 'Later' },
]

function computeTotals(rows: ObligationCalendarRow[]): SectionTotals {
  const totals: SectionTotals = {
    pay: { pen: 0, usd: 0, count: 0 },
    collect: { pen: 0, usd: 0, count: 0 },
  }
  for (const r of rows) {
    const side = r.direction === 'receivable' ? totals.collect : totals.pay
    side.count++
    const amt = r.outstanding ?? 0
    if (r.currency === 'USD') side.usd += amt
    else side.pen += amt
  }
  return totals
}

/** Map a calendar row to the shape InvoiceExpandContent expects for its `row` prop */
function toInvoicesPageRow(r: ObligationCalendarRow): InvoicesPageRow {
  return {
    id: r.invoice_id ?? '',
    type: (r.type as 'commercial' | 'loan') ?? 'commercial',
    direction: (r.direction as 'payable' | 'receivable') ?? 'payable',
    partner_company_id: r.partner_company_id ?? null,
    project_id: r.project_id ?? null,
    project_code: r.project_code ?? null,
    entity_id: r.entity_id ?? null,
    entity_name: r.entity_name ?? null,
    title: r.title ?? null,
    invoice_number: r.invoice_number ?? null,
    invoice_date: r.date ?? null,
    due_date: r.due_date ?? null,
    currency: (r.currency ?? 'PEN') as Currency,
    total: r.total ?? 0,
    amount_paid: r.amount_paid ?? 0,
    outstanding: r.outstanding ?? 0,
    bdn_outstanding: r.bdn_outstanding ?? 0,
    bdn_outstanding_pen: r.bdn_outstanding_pen ?? 0,
    payment_status: r.payment_status ?? 'pending',
    loan_id: r.loan_id ?? null,
  }
}

export function CalendarClient({
  data,
  projects,
  uniqueEntities,
  categories,
  partners,
  currentFilters,
}: Props) {
  const router = useRouter()
  const { setFilter, clearFilters } = useUrlFilters()

  // Direct transaction modal
  const [showDirectTransaction, setShowDirectTransaction] = useState(false)

  // Modal state
  const [modalRow, setModalRow] = useState<ObligationCalendarRow | null>(null)
  const [modalPageRow, setModalPageRow] = useState<InvoicesPageRow | null>(null)
  const [modalDetail, setModalDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'delete'>('view')

  const hasActiveFilters =
    currentFilters.projectId !== '' ||
    currentFilters.entity !== '' ||
    currentFilters.type !== '' ||
    currentFilters.currency !== '' ||
    currentFilters.search !== ''

  const handleClearFilters = () => clearFilters([FK.project, FK.entity, FK.type, FK.currency, FK.search])

  const fetchDetail = useCallback(async (row: ObligationCalendarRow) => {
    setModalDetail(null)
    setModalLoading(true)
    try {
      if (row.type === 'loan' && row.loan_id) {
        const detail = await fetchLoanDetailById(row.loan_id)
        setModalDetail(detail)
      } else if (row.invoice_id) {
        const detail = await fetchInvoiceDetail(row.invoice_id)
        setModalDetail(detail)
      }
    } catch (err) {
      console.error('Failed to load calendar detail:', err)
      setModalDetail(null)
    } finally {
      setModalLoading(false)
    }
  }, [])

  const handleRowClick = useCallback(async (row: ObligationCalendarRow) => {
    setModalRow(row)
    setModalPageRow(toInvoicesPageRow(row))
    setModalMode('view')
    await fetchDetail(row)
  }, [fetchDetail])

  const handleCloseModal = () => {
    setModalRow(null)
    setModalPageRow(null)
    setModalDetail(null)
    setModalMode('view')
  }

  const handleMutationSuccess = useCallback(() => {
    handleCloseModal()
    router.refresh()
  }, [router])

  const handlePaymentSuccess = useCallback(() => {
    if (modalRow) {
      fetchDetail(modalRow)
    }
    router.refresh()
  }, [modalRow, fetchDetail, router])

  // Group rows by urgency bucket and compute totals per section
  const groups = BUCKET_ORDER.map(({ id, label }) => {
    const rows = data.filter(r => getCalendarBucket(r.days_remaining) === id)
    return { id, label, rows, totals: computeTotals(rows) }
  })

  const grandTotals = computeTotals(data)

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

  function renderModalContent() {
    if (!modalRow) return null

    if (modalLoading) {
      return (
        <div className="flex items-center justify-center py-6">
          <span className="text-sm text-faint">Loading detail...</span>
        </div>
      )
    }

    if (!modalDetail) {
      return <p className="px-4 py-3 text-sm text-faint">Could not load detail.</p>
    }

    if (modalRow.type === 'loan') {
      return (
        <LoanExpandContent
          detail={modalDetail as LoanDetailData}
          onRepaymentSuccess={handlePaymentSuccess}
        />
      )
    }

    if (!modalPageRow) return null

    return (
      <InvoiceExpandContent
        detail={modalDetail as InvoiceDetailData}
        row={modalPageRow}
        mode={modalMode}
        onSetMode={setModalMode}
        onMutationSuccess={handleMutationSuccess}
        onPaymentSuccess={handlePaymentSuccess}
        categories={categories}
      />
    )
  }

  return (
    <div className="pb-16">
      <HeaderPortal>
        <button onClick={() => setShowDirectTransaction(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover">
          + Direct transaction
        </button>
      </HeaderPortal>

      <CalendarFilters
        currentFilters={currentFilters}
        setFilter={setFilter}
        projects={projects}
        uniqueEntities={uniqueEntities}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      <CalendarTable groups={groups} grandTotals={grandTotals} onRowClick={handleRowClick} />

      <Modal isOpen={!!modalRow} onClose={handleCloseModal} title={modalTitle}>
        {renderModalContent()}
      </Modal>

      <DirectTransactionModal
        isOpen={showDirectTransaction}
        onClose={() => setShowDirectTransaction(false)}
        partners={partners}
        projects={projects}
        categories={categories}
      />
    </div>
  )
}
