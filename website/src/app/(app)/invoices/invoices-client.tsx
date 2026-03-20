'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { formatCurrency } from '@/lib/formatters'
import { useUrlFilters } from '@/lib/use-url-filters'
import { FK } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailById } from '@/lib/actions'
import { importInvoices } from '@/lib/import-actions'
import { SlideOver } from '@/components/ui/slide-over'
import { HeaderPortal } from '@/components/ui/header-portal'
import { StatusBadge } from '@/components/ui/status-badge'

const ImportModal = dynamic(() => import('@/components/ui/import-modal').then(m => ({ default: m.ImportModal })))
import { InvoicesFilters } from './invoices-filters'
import { InvoicesTable } from './invoices-table'
import { InvoiceExpandContent } from './invoice-expand-content'
import { LoanExpandContent } from './loan-expand-content'
import { getStatusLabel, getStatusVariant } from './helpers'
import type {
  InvoicesPageRow,
  InvoiceDetailData,
  LoanDetailData,
  InvoiceAgingBucketId as BucketId,
  InvoiceAgingBuckets as BucketCounts,
} from '@/lib/types'
import type { InvoiceTab, InvoicesPageSummary as Summary, CategoryOption } from '@/lib/queries'

type Props = {
  tab: InvoiceTab
  data: InvoicesPageRow[]
  totalCount: number
  page: number
  pageSize: number
  payableBuckets: BucketCounts
  receivableBuckets: BucketCounts
  summary: Summary
  projects: { id: string; project_code: string; name: string }[]
  uniqueEntities: string[]
  categories: CategoryOption[]
  currentFilters: {
    status: string
    projectId: string
    entity: string
    bucket: string
    search: string
  }
}

// --- Aging dot colors ---
const agingColors: Record<string, { dot: string }> = {
  current: { dot: 'bg-green-500' },
  '1-30': { dot: 'bg-yellow-500' },
  '31-60': { dot: 'bg-orange-500' },
  '61-90': { dot: 'bg-red-400' },
  '90+': { dot: 'bg-red-700' },
}

const agingLabels: { label: string; key: keyof BucketCounts }[] = [
  { label: 'Current', key: 'current' },
  { label: '1–30 days', key: '1-30' },
  { label: '31–60 days', key: '31-60' },
  { label: '61–90 days', key: '61-90' },
  { label: '90+ days', key: '90+' },
]

function AgingLegend({ buckets, activeBucket, onBucketClick }: {
  buckets: BucketCounts
  activeBucket: BucketId
  onBucketClick: (bucket: BucketId) => void
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1">
      {agingLabels.map(({ label, key }) => {
        const b = buckets[key]
        const isActive = activeBucket === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onBucketClick(key)}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors hover:bg-zinc-100 ${
              isActive ? 'bg-zinc-100 ring-1 ring-zinc-300' : ''
            }`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${agingColors[key]?.dot ?? 'bg-zinc-300'}`} />
            <span className="text-zinc-500">{label}</span>
            {b.pen > 0 && (
              <span className="font-mono font-medium text-zinc-800">{formatCurrency(b.pen, 'PEN')}</span>
            )}
            {b.usd > 0 && (
              <span className="font-mono text-zinc-500">{formatCurrency(b.usd, 'USD')}</span>
            )}
            {b.pen <= 0 && b.usd <= 0 && (
              <span className="text-zinc-400">—</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function InvoicesClient({
  tab,
  data,
  totalCount,
  page,
  pageSize,
  payableBuckets,
  receivableBuckets,
  summary,
  projects,
  uniqueEntities,
  categories,
  currentFilters,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { setFilter, clearFilters } = useUrlFilters()

  // Import state
  const [showImport, setShowImport] = useState(false)

  // SlideOver state
  const [modalRow, setModalRow] = useState<InvoicesPageRow | null>(null)
  const [modalDetail, setModalDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'delete'>('view')

  const activeBucket = currentFilters.bucket as BucketId

  // Tab switching
  function switchTab(newTab: InvoiceTab) {
    const params = new URLSearchParams()
    if (newTab !== 'payable') params.set('tab', newTab)
    // Clear all filters on tab switch
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleBucketClick(bucket: BucketId) {
    if (activeBucket === bucket) {
      setFilter(FK.bucket, '')
    } else {
      setFilter(FK.bucket, bucket)
    }
  }

  const hasActiveFilters =
    currentFilters.status !== '' ||
    currentFilters.projectId !== '' ||
    currentFilters.entity !== '' ||
    currentFilters.search !== ''

  const handleClearFilters = () => clearFilters([FK.status, FK.project, FK.entity, FK.bucket, FK.search])

  const fetchDetail = useCallback(async (row: InvoicesPageRow) => {
    setModalDetail(null)
    setModalLoading(true)
    try {
      if (row.type === 'loan' && row.loan_id) {
        const detail = await fetchLoanDetailById(row.loan_id)
        setModalDetail(detail)
      } else {
        const detail = await fetchInvoiceDetail(row.id)
        setModalDetail(detail)
      }
    } catch {
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

  const handleCloseSlideOver = () => {
    setModalRow(null)
    setModalDetail(null)
    setModalMode('view')
  }

  const handleMutationSuccess = useCallback(() => {
    handleCloseSlideOver()
    router.refresh()
  }, [router])

  const handlePaymentSuccess = useCallback(() => {
    if (modalRow) {
      fetchDetail(modalRow)
    }
    router.refresh()
  }, [modalRow, fetchDetail, router])

  // Prev/Next navigation in slide-over
  const currentIndex = modalRow ? data.findIndex(r => r.id === modalRow.id) : -1
  const handlePrev = currentIndex > 0 ? () => {
    const prev = data[currentIndex - 1]
    setModalRow(prev)
    setModalMode('view')
    fetchDetail(prev)
  } : undefined
  const handleNext = currentIndex >= 0 && currentIndex < data.length - 1 ? () => {
    const next = data[currentIndex + 1]
    setModalRow(next)
    setModalMode('view')
    fetchDetail(next)
  } : undefined

  function renderSlideOverContent() {
    if (!modalRow) return null

    if (modalLoading) {
      return (
        <div className="flex items-center justify-center py-6">
          <span className="text-sm text-zinc-400">Loading detail...</span>
        </div>
      )
    }

    if (!modalDetail) {
      return <p className="py-3 text-sm text-zinc-400">Could not load detail.</p>
    }

    if (modalRow.type === 'loan') {
      return (
        <LoanExpandContent
          detail={modalDetail as LoanDetailData}
          onRepaymentSuccess={handlePaymentSuccess}
        />
      )
    }

    return (
      <InvoiceExpandContent
        detail={modalDetail as InvoiceDetailData}
        row={modalRow}
        mode={modalMode}
        onSetMode={setModalMode}
        onMutationSuccess={handleMutationSuccess}
        onPaymentSuccess={handlePaymentSuccess}
        categories={categories}
      />
    )
  }

  // SlideOver title
  const slideOverTitle = modalRow
    ? modalRow.type === 'loan'
      ? 'Loan Detail'
      : modalMode === 'edit'
        ? 'Edit Invoice'
        : modalRow.invoice_number
          ? `Invoice ${modalRow.invoice_number}`
          : 'Invoice Detail'
    : ''

  // SlideOver subtitle — status badge
  const slideOverSubtitle = modalRow && modalMode !== 'edit' ? (
    <StatusBadge
      label={getStatusLabel(modalRow.payment_status)}
      variant={getStatusVariant(modalRow.payment_status)}
    />
  ) : undefined

  // SlideOver action buttons (edit/delete for commercial invoices in view mode)
  const slideOverActions = modalRow && modalRow.type !== 'loan' && modalMode === 'view' ? (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => setModalMode('edit')}
        className="rounded border border-zinc-200 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
        title="Edit"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => setModalMode('delete')}
        className="rounded border border-zinc-200 p-1.5 text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        title="Delete"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      </button>
    </div>
  ) : undefined

  // Tab counts
  const payableCount = summary.payable.count
  const receivableCount = summary.receivable.count
  const loansCount = summary.loans.count

  // Active tab data
  const activeBuckets = tab === 'receivable' ? receivableBuckets : payableBuckets
  const activeTabSummary = tab === 'receivable' ? summary.receivable
    : tab === 'loans' ? summary.loans
    : summary.payable

  return (
    <div>
      {/* Header portal: + New Invoice and Import buttons */}
      <HeaderPortal>
        <div className="flex gap-2">
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
        </div>
      </HeaderPortal>

      {/* Tab bar */}
      <div className="flex border-b border-zinc-200">
        {([
          { key: 'payable' as InvoiceTab, label: 'Payable', count: payableCount },
          { key: 'receivable' as InvoiceTab, label: 'Receivable', count: receivableCount },
          { key: 'loans' as InvoiceTab, label: 'Loans', count: loansCount },
        ]).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.label}
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              tab === t.key
                ? 'bg-blue-50 text-blue-600'
                : 'bg-zinc-100 text-zinc-600'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 pt-4">
        {/* Summary strip */}
        <div className="mb-4 flex flex-wrap items-center gap-5">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-zinc-900">
              {formatCurrency(activeTabSummary.pen, 'PEN')}
            </span>
            {activeTabSummary.usd > 0 && (
              <span className="text-sm font-semibold text-zinc-500">
                {formatCurrency(activeTabSummary.usd, 'USD')}
              </span>
            )}
            <span className="text-xs text-zinc-500">outstanding</span>
          </div>

          <div className="h-6 w-px bg-zinc-200" />

          <div className="flex flex-col items-center">
            <span className="text-lg font-bold">{activeTabSummary.count}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {tab === 'loans' ? 'Payments Due' : 'Invoices'}
            </span>
          </div>

          <div className="h-6 w-px bg-zinc-200" />

          <div className="flex flex-col items-center">
            <span className={`text-lg font-bold ${activeTabSummary.overdueCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {activeTabSummary.overdueCount}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Overdue</span>
          </div>
        </div>

        {/* Commercial/Loan breakdown (payable tab only) */}
        {tab === 'payable' && (
          <div className="mb-3 flex gap-4 text-xs text-zinc-500">
            <span>
              Commercial: <span className="font-medium text-zinc-700">{formatCurrency(summary.payable.commercialPen, 'PEN')}</span>
              {summary.payable.commercialUsd > 0 && (
                <> + <span className="font-medium text-zinc-700">{formatCurrency(summary.payable.commercialUsd, 'USD')}</span></>
              )}
            </span>
            {(summary.payable.loanPen > 0 || summary.payable.loanUsd > 0) && (
              <span>
                Loans: <span className="font-medium text-zinc-700">{formatCurrency(summary.payable.loanPen, 'PEN')}</span>
                {summary.payable.loanUsd > 0 && (
                  <> + <span className="font-medium text-zinc-700">{formatCurrency(summary.payable.loanUsd, 'USD')}</span></>
                )}
              </span>
            )}
          </div>
        )}

        {/* Aging legend (payable and receivable tabs only) */}
        {tab !== 'loans' && (
          <AgingLegend
            buckets={activeBuckets}
            activeBucket={activeBucket}
            onBucketClick={handleBucketClick}
          />
        )}

        {/* Filters */}
        <InvoicesFilters
          tab={tab}
          currentFilters={currentFilters}
          projects={projects}
          uniqueEntities={uniqueEntities}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          setFilter={setFilter}
        />

        {/* Table */}
        <InvoicesTable
          tab={tab}
          data={data}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          onRowClick={handleRowClick}
        />
      </div>

      {/* Detail slide-over */}
      <SlideOver
        isOpen={modalRow !== null}
        onClose={handleCloseSlideOver}
        title={slideOverTitle}
        subtitle={slideOverSubtitle}
        actions={slideOverActions}
        onPrev={handlePrev}
        onNext={handleNext}
      >
        {renderSlideOverContent()}
      </SlideOver>

      {/* Import modal */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Import Invoices"
        onImport={importInvoices}
      />
    </div>
  )
}
