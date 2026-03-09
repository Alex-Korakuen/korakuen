'use client'

import { formatCurrency, formatDate } from '@/lib/formatters'
import { useUrlSort } from '@/lib/sort-utils'
import { useUrlFilters } from '@/lib/use-url-filters'
import { SummaryCard } from '@/components/ui/summary-card'
import { Modal } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/pagination'
import { fetchCostDetail, fetchLoanDetailFromSchedule } from '@/lib/actions'
import { useDetailModal } from '@/lib/use-detail-modal'
import { formatType } from './helpers'
import { DetailField, CostDetailContent, LoanDetailContent } from './ap-calendar-detail'
import { ApCalendarFilters } from './ap-calendar-filters'
import { ApCalendarTable } from './ap-calendar-table'
import type {
  ApCalendarRow,
  CostDetailData,
  LoanDetailData,
  ApCalendarBucketId as BucketId,
  ApCalendarBucketCounts as BucketCounts,
} from '@/lib/types'

type Props = {
  data: ApCalendarRow[]
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
  const modal = useDetailModal<ApCalendarRow, CostDetailData | LoanDetailData>()

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

  const handleRowClick = (row: ApCalendarRow) => {
    modal.open(row, async () => {
      if (row.type === 'supplier_invoice' && row.cost_id) {
        return await fetchCostDetail(row.cost_id) as CostDetailData | null
      } else if (row.type === 'loan_payment' && row.due_date && row.outstanding !== null) {
        return await fetchLoanDetailFromSchedule(
          row.entity_name ?? '',
          row.due_date,
          row.outstanding
        ) as LoanDetailData | null
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
          modal.selectedRow?.type === 'loan_payment'
            ? 'Loan Payment Detail'
            : 'Cost Detail'
        }
      >
        {modal.loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-zinc-400">Loading detail...</div>
          </div>
        )}

        {!modal.loading && modal.selectedRow?.type === 'supplier_invoice' && modal.detail && (
          <CostDetailContent
            row={modal.selectedRow}
            detail={modal.detail as CostDetailData}
            onPaymentSuccess={modal.refetch}
          />
        )}

        {!modal.loading && modal.selectedRow?.type === 'loan_payment' && modal.detail && (
          <LoanDetailContent
            row={modal.selectedRow}
            detail={modal.detail as LoanDetailData}
          />
        )}

        {!modal.loading && modal.error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load full detail. Showing summary only.
          </div>
        )}

        {!modal.loading && modal.selectedRow && !modal.detail && (
          <div className="space-y-3">
            <DetailField label="Type" value={formatType(modal.selectedRow.type)} />
            <DetailField label="Supplier" value={modal.selectedRow.entity_name ?? '--'} />
            <DetailField label="Project" value={modal.selectedRow.project_code ?? '--'} />
            <DetailField label="Title" value={modal.selectedRow.title ?? '--'} />
            <DetailField
              label="Due Date"
              value={modal.selectedRow.due_date ? formatDate(modal.selectedRow.due_date) : '--'}
            />
            <DetailField
              label="Outstanding"
              value={
                modal.selectedRow.outstanding !== null && modal.selectedRow.currency
                  ? formatCurrency(modal.selectedRow.outstanding, modal.selectedRow.currency)
                  : '--'
              }
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
