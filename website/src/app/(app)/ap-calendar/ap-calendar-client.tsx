'use client'

import { useUrlSort } from '@/lib/sort-utils'
import { useUrlFilters } from '@/lib/use-url-filters'
import { SummaryCard } from '@/components/ui/summary-card'
import { Modal } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/pagination'
import { fetchInvoiceDetail, fetchLoanDetailById } from '@/lib/actions'
import { useDetailModal } from '@/lib/use-detail-modal'
import { InvoiceDetailContent } from './ap-calendar-detail'
import { LoanDetailContent } from './loan-detail-content'
import { ApCalendarFilters } from './ap-calendar-filters'
import { ApCalendarTable } from './ap-calendar-table'
import type {
  ObligationCalendarRow,
  InvoiceDetailData,
  LoanDetailData,
  CalendarBucketId as BucketId,
  CalendarBucketCounts as BucketCounts,
} from '@/lib/types'

type Props = {
  data: ObligationCalendarRow[]
  totalCount: number
  page: number
  pageSize: number
  bucketCounts: BucketCounts
  projects: { id: string; project_code: string; name: string }[]
  uniqueSuppliers: string[]
  currentFilters: {
    projectId: string
    supplier: string
    currency: string
    search: string
    bucket: string
  }
}

export function ApCalendarClient({
  data,
  totalCount,
  page,
  pageSize,
  bucketCounts,
  projects,
  uniqueSuppliers,
  currentFilters,
}: Props) {
  const { sortColumn, sortDirection, handleSort } = useUrlSort('due_date')
  const { setFilter } = useUrlFilters()
  const modal = useDetailModal<ObligationCalendarRow, InvoiceDetailData | LoanDetailData>()

  const activeBucket = currentFilters.bucket as BucketId

  function handleBucketClick(bucket: BucketId) {
    setFilter('bucket', activeBucket === bucket ? '' : bucket)
  }

  const hasActiveFilters =
    currentFilters.projectId !== '' ||
    currentFilters.supplier !== '' ||
    currentFilters.currency !== '' ||
    currentFilters.search !== ''

  function clearFilters() {
    const params = new URLSearchParams(window.location.search)
    params.delete('project')
    params.delete('supplier')
    params.delete('currency')
    params.delete('search')
    params.delete('page')
    window.location.search = params.toString()
  }

  const handleRowClick = (row: ObligationCalendarRow) => {
    modal.open(row, async () => {
      if (row.type === 'commercial' && row.invoice_id) {
        return await fetchInvoiceDetail(row.invoice_id) as InvoiceDetailData | null
      } else if (row.type === 'loan' && row.loan_id) {
        return await fetchLoanDetailById(row.loan_id) as LoanDetailData | null
      }
      return null
    })
  }

  return (
    <div>
      <div className="mt-0">
        {/* Summary Cards */}
        <div className="flex flex-wrap gap-4">
          <SummaryCard
            title="Overdue"
            count={bucketCounts.overdue.count}
            totalPEN={bucketCounts.overdue.pen}
            totalUSD={bucketCounts.overdue.usd}
            variant="overdue"
            isActive={activeBucket === 'overdue'}
            onClick={() => handleBucketClick('overdue')}
          />
          <SummaryCard
            title="Due Today"
            count={bucketCounts.today.count}
            totalPEN={bucketCounts.today.pen}
            totalUSD={bucketCounts.today.usd}
            variant="today"
            isActive={activeBucket === 'today'}
            onClick={() => handleBucketClick('today')}
          />
          <SummaryCard
            title="This Week"
            count={bucketCounts['this-week'].count}
            totalPEN={bucketCounts['this-week'].pen}
            totalUSD={bucketCounts['this-week'].usd}
            variant="this-week"
            isActive={activeBucket === 'this-week'}
            onClick={() => handleBucketClick('this-week')}
          />
          <SummaryCard
            title="Next 30 Days"
            count={bucketCounts['next-30'].count}
            totalPEN={bucketCounts['next-30'].pen}
            totalUSD={bucketCounts['next-30'].usd}
            variant="future"
            isActive={activeBucket === 'next-30'}
            onClick={() => handleBucketClick('next-30')}
          />
        </div>

        <ApCalendarFilters
          currentFilters={currentFilters}
          setFilter={setFilter}
          projects={projects}
          uniqueSuppliers={uniqueSuppliers}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

        <ApCalendarTable
          data={data}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={handleRowClick}
        />

        <div className="mt-3">
          <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={modal.selectedRow !== null}
        onClose={modal.close}
        title={
          modal.selectedRow?.type === 'loan'
            ? 'Loan Payment Detail'
            : 'Invoice Detail'
        }
      >
        {modal.loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-zinc-400">Loading detail...</div>
          </div>
        )}

        {!modal.loading && modal.selectedRow?.type === 'commercial' && modal.detail && (
          <InvoiceDetailContent
            row={modal.selectedRow}
            detail={modal.detail as InvoiceDetailData}
            onPaymentSuccess={modal.refetch}
          />
        )}

        {!modal.loading && modal.selectedRow?.type === 'loan' && modal.detail && (
          <LoanDetailContent
            row={modal.selectedRow}
            detail={modal.detail as LoanDetailData}
            onRepaymentSuccess={modal.refetch}
          />
        )}

        {!modal.loading && !modal.detail && modal.selectedRow && (
          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Could not load detail for this record.
          </div>
        )}
      </Modal>
    </div>
  )
}
