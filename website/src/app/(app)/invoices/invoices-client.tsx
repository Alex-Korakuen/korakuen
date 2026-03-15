'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/formatters'
import { useUrlFilters } from '@/lib/use-url-filters'
import { FK } from '@/lib/filter-keys'
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
  BucketValue,
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

// --- Aging dot color by bucket ---
const agingDotColors: Record<string, string> = {
  current: 'bg-green-400',
  '1-30': 'bg-yellow-400',
  '31-60': 'bg-orange-400',
  '61-90': 'bg-red-400',
  '90+': 'bg-red-600',
}

function AgingRow({
  label,
  bucket,
  value,
  isActive,
  onClick,
}: {
  label: string
  bucket: string
  value: BucketValue
  isActive: boolean
  onClick: () => void
}) {
  const hasValue = value.pen > 0 || value.usd > 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 ${
        isActive ? 'bg-zinc-100 ring-1 ring-zinc-300' : ''
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${agingDotColors[bucket] ?? 'bg-zinc-300'}`} />
      <span className="w-20 text-zinc-600">{label}</span>
      <span className="flex-1 text-right font-mono text-zinc-800">
        {hasValue ? formatCurrency(value.pen, 'PEN') : '—'}
      </span>
      {value.usd > 0 && (
        <span className="w-24 text-right font-mono text-zinc-500">
          {formatCurrency(value.usd, 'USD')}
        </span>
      )}
      <span className="w-16 text-right text-xs text-zinc-400">
        {value.count} {value.count === 1 ? 'item' : 'items'}
      </span>
    </button>
  )
}

function SummaryPanel({
  title,
  totalPen,
  totalUsd,
  subtotals,
  buckets,
  activeBucket,
  activeDirection,
  direction,
  onBucketClick,
}: {
  title: string
  totalPen: number
  totalUsd: number
  subtotals?: { label: string; pen: number; usd: number }[]
  buckets: BucketCounts
  activeBucket: BucketId
  activeDirection: string
  direction: 'payable' | 'receivable'
  onBucketClick: (bucket: BucketId, direction: 'payable' | 'receivable') => void
}) {
  const isActiveDir = activeDirection === direction
  const agingRows: { label: string; key: keyof BucketCounts }[] = [
    { label: 'Current', key: 'current' },
    { label: '1-30 days', key: '1-30' },
    { label: '31-60 days', key: '31-60' },
    { label: '61-90 days', key: '61-90' },
    { label: '90+ days', key: '90+' },
  ]

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      {/* Header */}
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
          <span className="text-lg font-semibold text-zinc-900">{formatCurrency(totalPen, 'PEN')}</span>
          {totalUsd > 0 && (
            <span className="text-sm text-zinc-500">{formatCurrency(totalUsd, 'USD')}</span>
          )}
        </div>
        <div className="mt-1 flex gap-4 text-xs text-zinc-400">
          {subtotals && subtotals.length > 0
            ? subtotals.map(s => (
                <span key={s.label}>
                  {s.label}: {formatCurrency(s.pen, 'PEN')}
                  {s.usd > 0 ? ` + ${formatCurrency(s.usd, 'USD')}` : ''}
                </span>
              ))
            : <span>&nbsp;</span>
          }
        </div>
      </div>
      {/* Aging rows */}
      <div className="px-1 py-1">
        {agingRows.map(({ label, key }) => (
          <AgingRow
            key={key}
            label={label}
            bucket={key}
            value={buckets[key]}
            isActive={isActiveDir && activeBucket === key}
            onClick={() => onBucketClick(key, direction)}
          />
        ))}
      </div>
    </div>
  )
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
  const { setFilter, setFilters, clearFilters } = useUrlFilters()

  // Inline expand state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [expandLoading, setExpandLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<InvoicesPageRow | null>(null)

  const activeBucket = currentFilters.bucket as BucketId

  function handleBucketClick(bucket: BucketId, direction: 'payable' | 'receivable') {
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

  const handleClearFilters = () => clearFilters([FK.direction, FK.type, FK.status, FK.project, FK.entity, FK.bucket])

  const handleRowClick = useCallback(async (row: InvoicesPageRow) => {
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
      {/* Summary panels: Payable (left) + Receivable (right) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryPanel
          title="Payable"
          totalPen={summary.payable.pen}
          totalUsd={summary.payable.usd}
          subtotals={[
            { label: 'Commercial', pen: summary.payable.commercialPen, usd: summary.payable.commercialUsd },
            { label: 'Loans', pen: summary.payable.loanPen, usd: summary.payable.loanUsd },
          ]}
          buckets={payableBuckets}
          activeBucket={activeBucket}
          activeDirection={currentFilters.direction}
          direction="payable"
          onBucketClick={handleBucketClick}
        />
        <SummaryPanel
          title="Receivable"
          totalPen={summary.receivable.pen}
          totalUsd={summary.receivable.usd}
          buckets={receivableBuckets}
          activeBucket={activeBucket}
          activeDirection={currentFilters.direction}
          direction="receivable"
          onBucketClick={handleBucketClick}
        />
      </div>

      {/* Filters */}
      <InvoicesFilters
        currentFilters={currentFilters}
        setFilter={setFilter}
        projects={projects}
        uniqueEntities={uniqueEntities}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
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
