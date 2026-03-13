'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/formatters'
import { useUrlFilters } from '@/lib/use-url-filters'
import { SummaryCard } from '@/components/ui/summary-card'
import { fetchInvoiceDetail, fetchLoanDetailById } from '@/lib/actions'
import { InvoicesFilters } from './invoices-filters'
import { InvoicesTable } from './invoices-table'
import { InvoiceExpandContent } from './invoice-expand-content'
import { LoanExpandContent } from './loan-expand-content'
import type {
  InvoicesPageRow,
  InvoiceDetailData,
  LoanDetailData,
  InvoiceAgingBucketId as BucketId,
  InvoiceAgingBuckets as BucketCounts,
} from '@/lib/types'

type Summary = {
  payable: { pen: number; usd: number; commercialPen: number; commercialUsd: number; loanPen: number; loanUsd: number }
  receivable: { pen: number; usd: number }
}

type Props = {
  data: InvoicesPageRow[]
  totalCount: number
  page: number
  pageSize: number
  payableBuckets: BucketCounts
  receivableBuckets: BucketCounts
  summary: Summary
  projects: { id: string; project_code: string; name: string }[]
  uniqueEntities: string[]
  currentFilters: {
    direction: string
    type: string
    status: string
    projectId: string
    entity: string
    bucket: string
  }
}

export function InvoicesClient({
  data,
  totalCount,
  page,
  pageSize,
  payableBuckets,
  receivableBuckets,
  summary,
  projects,
  uniqueEntities,
  currentFilters,
}: Props) {
  const router = useRouter()
  const { setFilter, setFilters } = useUrlFilters()

  // Inline expand state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [expandLoading, setExpandLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<InvoicesPageRow | null>(null)

  const activeBucket = currentFilters.bucket as BucketId

  function handleBucketClick(bucket: BucketId, direction: 'payable' | 'receivable') {
    // If clicking the same bucket+direction that's active, clear it
    if (activeBucket === bucket && currentFilters.direction === direction) {
      setFilters({ bucket: '', direction: '' })
    } else {
      setFilters({ bucket: bucket, direction: direction })
    }
  }

  const hasActiveFilters =
    currentFilters.direction !== '' ||
    currentFilters.type !== '' ||
    currentFilters.status !== '' ||
    currentFilters.projectId !== '' ||
    currentFilters.entity !== ''

  function clearFilters() {
    const params = new URLSearchParams(window.location.search)
    params.delete('direction')
    params.delete('type')
    params.delete('status')
    params.delete('project')
    params.delete('entity')
    params.delete('bucket')
    params.delete('page')
    window.location.search = params.toString()
  }

  const handleRowClick = useCallback(async (row: InvoicesPageRow) => {
    // Toggle: if clicking the same row, collapse
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
      if (row.type === 'loan' && row.loan_id) {
        const detail = await fetchLoanDetailById(row.loan_id)
        setExpandedDetail(detail)
      } else {
        const detail = await fetchInvoiceDetail(row.id)
        setExpandedDetail(detail)
      }
    } catch {
      setExpandedDetail(null)
    } finally {
      setExpandLoading(false)
    }
  }, [expandedId])

  const handlePaymentSuccess = useCallback(() => {
    // Refetch detail for the expanded row, then refresh page data
    if (expandedRow) {
      handleRowClick(expandedRow)
    }
    router.refresh()
  }, [expandedRow, handleRowClick, router])

  function renderExpandContent(row: InvoicesPageRow) {
    if (!expandedDetail) {
      return <p className="px-4 py-3 text-sm text-zinc-400">Could not load detail.</p>
    }

    if (row.type === 'loan') {
      return (
        <LoanExpandContent
          detail={expandedDetail as LoanDetailData}
          onRepaymentSuccess={handlePaymentSuccess}
        />
      )
    }

    return (
      <InvoiceExpandContent
        detail={expandedDetail as InvoiceDetailData}
        onPaymentSuccess={handlePaymentSuccess}
      />
    )
  }

  return (
    <div>
      {/* Summary cards: Payable (left) + Receivable (right) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payable section */}
        <div>
          <div className="mb-2 flex items-baseline gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Payable</h3>
            <span className="text-lg font-semibold text-zinc-900">{formatCurrency(summary.payable.pen, 'PEN')}</span>
            {summary.payable.usd > 0 && (
              <span className="text-sm text-zinc-600">{formatCurrency(summary.payable.usd, 'USD')}</span>
            )}
          </div>
          {(summary.payable.commercialPen > 0 || summary.payable.loanPen > 0 || summary.payable.commercialUsd > 0 || summary.payable.loanUsd > 0) && (
            <div className="mb-3 flex gap-4 text-xs text-zinc-500">
              <span>Commercial: {formatCurrency(summary.payable.commercialPen, 'PEN')}{summary.payable.commercialUsd > 0 ? ` + ${formatCurrency(summary.payable.commercialUsd, 'USD')}` : ''}</span>
              <span>Loans: {formatCurrency(summary.payable.loanPen, 'PEN')}{summary.payable.loanUsd > 0 ? ` + ${formatCurrency(summary.payable.loanUsd, 'USD')}` : ''}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <SummaryCard
              title="Current"
              count={payableBuckets.current.count}
              totalPEN={payableBuckets.current.pen}
              totalUSD={payableBuckets.current.usd}
              variant="future"
              isActive={activeBucket === 'current' && currentFilters.direction === 'payable'}
              onClick={() => handleBucketClick('current', 'payable')}
            />
            <SummaryCard
              title="1-30 Days"
              count={payableBuckets['1-30'].count}
              totalPEN={payableBuckets['1-30'].pen}
              totalUSD={payableBuckets['1-30'].usd}
              variant="this-week"
              isActive={activeBucket === '1-30' && currentFilters.direction === 'payable'}
              onClick={() => handleBucketClick('1-30', 'payable')}
            />
            <SummaryCard
              title="31-60 Days"
              count={payableBuckets['31-60'].count}
              totalPEN={payableBuckets['31-60'].pen}
              totalUSD={payableBuckets['31-60'].usd}
              variant="today"
              isActive={activeBucket === '31-60' && currentFilters.direction === 'payable'}
              onClick={() => handleBucketClick('31-60', 'payable')}
            />
            <SummaryCard
              title="61-90 Days"
              count={payableBuckets['61-90'].count}
              totalPEN={payableBuckets['61-90'].pen}
              totalUSD={payableBuckets['61-90'].usd}
              variant="overdue"
              isActive={activeBucket === '61-90' && currentFilters.direction === 'payable'}
              onClick={() => handleBucketClick('61-90', 'payable')}
            />
            <SummaryCard
              title="90+ Days"
              count={payableBuckets['90+'].count}
              totalPEN={payableBuckets['90+'].pen}
              totalUSD={payableBuckets['90+'].usd}
              variant="overdue"
              isActive={activeBucket === '90+' && currentFilters.direction === 'payable'}
              onClick={() => handleBucketClick('90+', 'payable')}
            />
          </div>
        </div>

        {/* Receivable section */}
        <div>
          <div className="mb-2 flex items-baseline gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Receivable</h3>
            <span className="text-lg font-semibold text-zinc-900">{formatCurrency(summary.receivable.pen, 'PEN')}</span>
            {summary.receivable.usd > 0 && (
              <span className="text-sm text-zinc-600">{formatCurrency(summary.receivable.usd, 'USD')}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-[1.625rem]">
            <SummaryCard
              title="Current"
              count={receivableBuckets.current.count}
              totalPEN={receivableBuckets.current.pen}
              totalUSD={receivableBuckets.current.usd}
              variant="future"
              isActive={activeBucket === 'current' && currentFilters.direction === 'receivable'}
              onClick={() => handleBucketClick('current', 'receivable')}
            />
            <SummaryCard
              title="1-30 Days"
              count={receivableBuckets['1-30'].count}
              totalPEN={receivableBuckets['1-30'].pen}
              totalUSD={receivableBuckets['1-30'].usd}
              variant="this-week"
              isActive={activeBucket === '1-30' && currentFilters.direction === 'receivable'}
              onClick={() => handleBucketClick('1-30', 'receivable')}
            />
            <SummaryCard
              title="31-60 Days"
              count={receivableBuckets['31-60'].count}
              totalPEN={receivableBuckets['31-60'].pen}
              totalUSD={receivableBuckets['31-60'].usd}
              variant="today"
              isActive={activeBucket === '31-60' && currentFilters.direction === 'receivable'}
              onClick={() => handleBucketClick('31-60', 'receivable')}
            />
            <SummaryCard
              title="61-90 Days"
              count={receivableBuckets['61-90'].count}
              totalPEN={receivableBuckets['61-90'].pen}
              totalUSD={receivableBuckets['61-90'].usd}
              variant="overdue"
              isActive={activeBucket === '61-90' && currentFilters.direction === 'receivable'}
              onClick={() => handleBucketClick('61-90', 'receivable')}
            />
            <SummaryCard
              title="90+ Days"
              count={receivableBuckets['90+'].count}
              totalPEN={receivableBuckets['90+'].pen}
              totalUSD={receivableBuckets['90+'].usd}
              variant="overdue"
              isActive={activeBucket === '90+' && currentFilters.direction === 'receivable'}
              onClick={() => handleBucketClick('90+', 'receivable')}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <InvoicesFilters
        currentFilters={currentFilters}
        setFilter={setFilter}
        projects={projects}
        uniqueEntities={uniqueEntities}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {/* Table with inline expand */}
      <InvoicesTable
        data={data}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        expandedId={expandedId}
        expandLoading={expandLoading}
        expandedDetail={expandedDetail}
        onRowClick={handleRowClick}
        renderExpandContent={renderExpandContent}
      />
    </div>
  )
}
