'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/formatters'
import { useUrlFilters } from '@/lib/use-url-filters'
import { FK } from '@/lib/filter-keys'
import { fetchInvoiceDetail, fetchLoanDetailById } from '@/lib/actions'
import { importInvoices } from '@/lib/import-actions'
import { Modal } from '@/components/ui/modal'
import { HeaderPortal } from '@/components/ui/header-portal'

const ImportModal = dynamic(() => import('@/components/ui/import-modal').then(m => ({ default: m.ImportModal })))
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
import type { InvoicesPageSummary as Summary, CategoryOption } from '@/lib/queries'

type Props = {
  data: InvoicesPageRow[]
  totalCount: number
  page: number
  pageSize: number
  buckets: BucketCounts
  summary: Summary
  projects: { id: string; project_code: string; name: string }[]
  uniqueEntities: string[]
  categories: CategoryOption[]
  currentFilters: {
    direction: string
    type: string
    status: string
    projectId: string
    entity: string
    bucket: string
    search: string
  }
}

// --- Aging dot colors ---
const agingColors: Record<string, string> = {
  current: 'bg-green-500',
  '1-30': 'bg-yellow-500',
  '31-60': 'bg-orange-500',
  '61-90': 'bg-red-400',
  '90+': 'bg-red-700',
}

const agingLabels: { label: string; key: keyof BucketCounts }[] = [
  { label: 'Current', key: 'current' },
  { label: '1–30 days', key: '1-30' },
  { label: '31–60 days', key: '31-60' },
  { label: '61–90 days', key: '61-90' },
  { label: '90+ days', key: '90+' },
]

export function InvoicesClient({
  data,
  totalCount,
  page,
  pageSize,
  buckets,
  summary,
  projects,
  uniqueEntities,
  categories,
  currentFilters,
}: Props) {
  const router = useRouter()
  const { setFilter, clearFilters } = useUrlFilters()

  const [showImport, setShowImport] = useState(false)
  const [modalRow, setModalRow] = useState<InvoicesPageRow | null>(null)
  const [modalDetail, setModalDetail] = useState<InvoiceDetailData | LoanDetailData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'delete'>('view')

  const activeBucket = currentFilters.bucket as BucketId

  function handleBucketClick(bucket: BucketId) {
    setFilter(FK.bucket, activeBucket === bucket ? '' : bucket)
  }

  const hasActiveFilters =
    currentFilters.direction !== '' ||
    currentFilters.type !== '' ||
    currentFilters.status !== '' ||
    currentFilters.projectId !== '' ||
    currentFilters.entity !== '' ||
    currentFilters.search !== ''

  const handleClearFilters = () => clearFilters([FK.direction, FK.type, FK.status, FK.project, FK.entity, FK.bucket, FK.search])

  const fetchDetail = useCallback(async (row: InvoicesPageRow) => {
    setModalDetail(null)
    setModalLoading(true)
    try {
      if (row.type === 'loan' && row.loan_id) {
        setModalDetail(await fetchLoanDetailById(row.loan_id))
      } else {
        setModalDetail(await fetchInvoiceDetail(row.id))
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

  const handleCloseModal = () => {
    setModalRow(null)
    setModalDetail(null)
    setModalMode('view')
  }

  const handleMutationSuccess = useCallback(() => {
    handleCloseModal()
    router.refresh()
  }, [router])

  const handlePaymentSuccess = useCallback(() => {
    if (modalRow) fetchDetail(modalRow)
    router.refresh()
  }, [modalRow, fetchDetail, router])

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

  return (
    <div>
      <HeaderPortal>
        <button onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-800">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
          </svg>
          Import
        </button>
      </HeaderPortal>

      <div className="px-4 pt-4">
        {/* Summary strip */}
        <div className="mb-4 flex flex-wrap items-center gap-5">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-zinc-900">{formatCurrency(summary.pen, 'PEN')}</span>
            {summary.usd > 0 && <span className="text-sm font-semibold text-zinc-500">{formatCurrency(summary.usd, 'USD')}</span>}
            <span className="text-xs text-zinc-500">outstanding</span>
          </div>
          <div className="h-6 w-px bg-zinc-200" />
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold">{summary.count}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Items</span>
          </div>
          <div className="h-6 w-px bg-zinc-200" />
          <div className="flex flex-col items-center">
            <span className={`text-lg font-bold ${summary.overdueCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {summary.overdueCount}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Overdue</span>
          </div>
        </div>

        {/* Aging legend */}
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1">
          {agingLabels.map(({ label, key }) => {
            const b = buckets[key]
            const isActive = activeBucket === key
            return (
              <button key={key} type="button" onClick={() => handleBucketClick(key)}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors hover:bg-zinc-100 ${isActive ? 'bg-zinc-100 ring-1 ring-zinc-300' : ''}`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${agingColors[key] ?? 'bg-zinc-300'}`} />
                <span className="text-zinc-500">{label}</span>
                {b.pen > 0 && <span className="font-mono font-medium text-zinc-800">{formatCurrency(b.pen, 'PEN')}</span>}
                {b.usd > 0 && <span className="font-mono text-zinc-500">{formatCurrency(b.usd, 'USD')}</span>}
                {b.pen <= 0 && b.usd <= 0 && <span className="text-zinc-400">—</span>}
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <InvoicesFilters
          currentFilters={currentFilters}
          projects={projects}
          uniqueEntities={uniqueEntities}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          setFilter={setFilter}
        />

        {/* Table */}
        <InvoicesTable
          data={data} totalCount={totalCount} page={page} pageSize={pageSize}
          onRowClick={handleRowClick}
        />
      </div>

      <Modal isOpen={modalRow !== null} onClose={handleCloseModal} title={modalTitle}>
        {modalLoading ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-sm text-zinc-400">Loading detail...</span>
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
