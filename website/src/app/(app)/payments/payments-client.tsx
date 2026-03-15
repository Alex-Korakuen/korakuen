'use client'

import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { useUrlFilters } from '@/lib/use-url-filters'
import { FK } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailByScheduleId } from '@/lib/actions'
import { PaymentsFilters } from './payments-filters'
import { PaymentsTable } from './payments-table'
import { PaymentExpandContent } from './payment-expand-content'
import type { PaymentsPageRow, PaymentsSummary, InvoiceDetailData, LoanDetailData } from '@/lib/types'

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

function SummaryPanel({
  title,
  pen,
  usd,
  colorClass,
}: {
  title: string
  pen: number
  usd: number
  colorClass: string
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${colorClass}`}>{title}</h3>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-lg font-semibold text-zinc-900">{formatCurrency(pen, 'PEN')}</span>
        {usd > 0 && (
          <span className="text-sm text-zinc-500">{formatCurrency(usd, 'USD')}</span>
        )}
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
    <div>
      {/* Summary panels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryPanel
          title="Inflows"
          pen={summary.inflows.pen}
          usd={summary.inflows.usd}
          colorClass="text-green-600"
        />
        <SummaryPanel
          title="Outflows"
          pen={summary.outflows.pen}
          usd={summary.outflows.usd}
          colorClass="text-red-500"
        />
        <SummaryPanel
          title="Net"
          pen={summary.net.pen}
          usd={summary.net.usd}
          colorClass="text-zinc-400"
        />
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
    </div>
  )
}
