'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { formatCurrency } from '@/lib/formatters'
import { useUrlFilters } from '@/lib/use-url-filters'
import { FK } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailByScheduleId } from '@/lib/actions'
import { importPayments } from '@/lib/import-actions'
import { Modal } from '@/components/ui/modal'
import { HeaderPortal } from '@/components/ui/header-portal'
import { PaymentsFilters } from './payments-filters'
import { PaymentsTable } from './payments-table'
import { PaymentExpandContent } from './payment-expand-content'
import type { PaymentsPageRow, PaymentsSummary, PaymentBucketId, PaymentBucketSummary, InvoiceDetailData, LoanDetailData } from '@/lib/types'

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
  }
}

const BUCKET_ORDER: { id: PaymentBucketId; label: string }[] = [
  { id: 'last-30', label: 'Last 30 Days' },
]

function getBucketColors(id: PaymentBucketId): { text: string } {
  switch (id) {
    case 'last-30': return { text: 'text-violet-700' }
    default: return { text: 'text-zinc-600' }
  }
}

function DualAmount({ pen, usd }: { pen: number; usd: number }) {
  if (pen === 0 && usd === 0) return <span className="text-zinc-400">--</span>
  return (
    <span className="font-mono text-xs">
      {pen !== 0 && formatCurrency(Math.abs(pen), 'PEN')}
      {pen !== 0 && usd !== 0 && <span className="mx-1 text-zinc-300">|</span>}
      {usd !== 0 && formatCurrency(Math.abs(usd), 'USD')}
    </span>
  )
}

function BucketBar({ id, label, bucket }: { id: PaymentBucketId; label: string; bucket: PaymentBucketSummary }) {
  const colors = getBucketColors(id)
  return (
    <div className={`border-t border-zinc-200 bg-zinc-50/80 px-6 py-2`}>
      <div className="flex items-center gap-6">
        <span className={`w-28 text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
          {label}
        </span>
        <span className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-green-600">In</span>
          <DualAmount pen={bucket.inflows.pen} usd={bucket.inflows.usd} />
        </span>
        <span className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-red-500">Out</span>
          <DualAmount pen={bucket.outflows.pen} usd={bucket.outflows.usd} />
        </span>
        <span className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-zinc-600">Net</span>
          <DualAmount pen={bucket.net.pen} usd={bucket.net.usd} />
        </span>
      </div>
    </div>
  )
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
  const { setFilter, clearFilters } = useUrlFilters()

  const [showImport, setShowImport] = useState(false)
  const [modalRow, setModalRow] = useState<PaymentsPageRow | null>(null)
  const [modalDetail, setModalDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const hasActiveFilters =
    currentFilters.direction !== '' ||
    currentFilters.paymentType !== '' ||
    currentFilters.relatedTo !== '' ||
    currentFilters.projectId !== '' ||
    currentFilters.bankAccountId !== ''

  const handleClearFilters = () => clearFilters([FK.direction, FK.type, FK.related, FK.project, FK.bank])

  const handleRowClick = useCallback(async (row: PaymentsPageRow) => {
    setModalRow(row)
    setModalDetail(null)
    setModalLoading(true)

    try {
      if (row.related_to === 'loan_schedule' && row.related_id) {
        const detail = await fetchLoanDetailByScheduleId(row.related_id)
        setModalDetail(detail)
      } else if (row.related_id) {
        const detail = await fetchInvoiceDetail(row.related_id)
        setModalDetail(detail)
      }
    } catch {
      setModalDetail(null)
    } finally {
      setModalLoading(false)
    }
  }, [])

  const handleCloseModal = () => {
    setModalRow(null)
    setModalDetail(null)
  }

  return (
    <div>
      {/* Import button in header via portal */}
      <HeaderPortal>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
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

      {/* Table */}
      <PaymentsTable
        data={data}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onRowClick={handleRowClick}
      />

      {/* Bucket summary bar — sticky at bottom of scroll area */}
      {BUCKET_ORDER.map(({ id, label }) => {
        const bucket = summary.buckets[id]
        if (bucket.count === 0) return null
        return (
          <div key={id} className="sticky bottom-0 -mx-6 -mb-6 z-30">
            <BucketBar id={id} label={label} bucket={bucket} />
          </div>
        )
      })}

      {/* Detail modal */}
      <Modal
        isOpen={modalRow !== null}
        onClose={handleCloseModal}
        title="Payment Detail"
      >
        {modalLoading ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-sm text-zinc-400">Loading detail...</span>
          </div>
        ) : modalRow ? (
          <PaymentExpandContent
            row={modalRow}
            relatedDetail={modalDetail}
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
