'use client'

import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { useUrlFilters } from '@/lib/use-url-filters'
import { FK } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailByScheduleId } from '@/lib/actions'
import { PaymentsFilters } from './payments-filters'
import { PaymentsTable } from './payments-table'
import { PaymentExpandContent } from './payment-expand-content'
import type { PaymentsPageRow, PaymentsSummary, PaymentBucketId, PaymentBucketSummary, InvoiceDetailData, LoanDetailData } from '@/lib/types'

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
  { id: 'today', label: 'Today' },
  { id: 'last-7', label: 'Last 7 Days' },
  { id: 'last-30', label: 'Last 30 Days' },
]

function getBucketColors(id: PaymentBucketId): { border: string; text: string } {
  switch (id) {
    case 'today': return { border: 'border-orange-400', text: 'text-orange-700' }
    case 'last-7': return { border: 'border-blue-400', text: 'text-blue-700' }
    case 'last-30': return { border: 'border-violet-400', text: 'text-violet-700' }
    case 'previous': return { border: 'border-zinc-300', text: 'text-zinc-600' }
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

function BucketSummaryRow({ id, label, bucket }: { id: PaymentBucketId; label: string; bucket: PaymentBucketSummary }) {
  const colors = getBucketColors(id)
  return (
    <>
      <div className="flex items-center gap-2">
        <div className={`w-0.5 self-stretch ${colors.border} border-l-2`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
          {label}
        </span>
      </div>
      <span className="text-right font-mono text-xs text-zinc-600">
        <DualAmount pen={bucket.inflows.pen} usd={bucket.inflows.usd} />
      </span>
      <span className="text-right font-mono text-xs text-zinc-600">
        <DualAmount pen={bucket.outflows.pen} usd={bucket.outflows.usd} />
      </span>
      <span className="text-right font-mono text-xs font-medium text-zinc-800">
        <DualAmount pen={bucket.net.pen} usd={bucket.net.usd} />
      </span>
      <span className="text-right text-[10px] text-zinc-400">
        {bucket.count}
      </span>
    </>
  )
}

function PaymentsTotalBar({ summary }: { summary: PaymentsSummary }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-300 bg-zinc-50/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-green-600">Total In</span>
            <DualAmount pen={summary.inflows.pen} usd={summary.inflows.usd} />
          </span>
          <span className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-red-500">Total Out</span>
            <DualAmount pen={summary.outflows.pen} usd={summary.outflows.usd} />
          </span>
          <span className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-zinc-600">Net</span>
            <DualAmount pen={summary.net.pen} usd={summary.net.usd} />
          </span>
        </div>
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

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [expandLoading, setExpandLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<PaymentsPageRow | null>(null)

  const hasActiveFilters =
    currentFilters.direction !== '' ||
    currentFilters.paymentType !== '' ||
    currentFilters.relatedTo !== '' ||
    currentFilters.projectId !== '' ||
    currentFilters.bankAccountId !== ''

  const handleClearFilters = () => clearFilters([FK.direction, FK.type, FK.related, FK.project, FK.bank])

  const handleRowClick = useCallback(async (row: PaymentsPageRow) => {
    if (expandedId === row.id) {
      setExpandedId(null)
      setExpandedDetail(null)
      setExpandedRow(null)
      return
    }

    setExpandedId(row.id)
    setExpandedRow(row)
    setExpandedDetail(null)
    setExpandLoading(true)

    try {
      if (row.related_to === 'loan_schedule' && row.related_id) {
        const detail = await fetchLoanDetailByScheduleId(row.related_id)
        setExpandedDetail(detail)
      } else if (row.related_id) {
        const detail = await fetchInvoiceDetail(row.related_id)
        setExpandedDetail(detail)
      }
    } catch {
      setExpandedDetail(null)
    } finally {
      setExpandLoading(false)
    }
  }, [expandedId])

  function renderExpandContent(row: PaymentsPageRow) {
    return (
      <PaymentExpandContent
        row={row}
        relatedDetail={expandedDetail}
      />
    )
  }

  return (
    <div className="pb-16">
      {/* Bucket summary grid */}
      <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-x-6 gap-y-1.5">
        {/* Column headers */}
        <span />
        <span className="text-right text-[10px] font-medium uppercase tracking-wider text-green-600">In</span>
        <span className="text-right text-[10px] font-medium uppercase tracking-wider text-red-500">Out</span>
        <span className="text-right text-[10px] font-medium uppercase tracking-wider text-zinc-500">Net</span>
        <span />
        {BUCKET_ORDER.map(({ id, label }) => {
          const bucket = summary.buckets[id]
          if (bucket.count === 0) return null
          return <BucketSummaryRow key={id} id={id} label={label} bucket={bucket} />
        })}
      </div>

      {/* Filters */}
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
        expandedId={expandedId}
        expandLoading={expandLoading}
        onRowClick={handleRowClick}
        renderExpandContent={renderExpandContent}
      />

      <PaymentsTotalBar summary={summary} />
    </div>
  )
}
