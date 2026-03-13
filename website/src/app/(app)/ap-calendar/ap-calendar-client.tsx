'use client'

import { useRouter } from 'next/navigation'
import { useUrlSort } from '@/lib/sort-utils'
import { useUrlFilters } from '@/lib/use-url-filters'
import { SummaryCard } from '@/components/ui/summary-card'
import { Pagination } from '@/components/ui/pagination'
import { ApCalendarFilters } from './ap-calendar-filters'
import { ApCalendarTable } from './ap-calendar-table'
import type {
  ObligationCalendarRow,
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
  const router = useRouter()
  const { sortColumn, sortDirection, handleSort } = useUrlSort('due_date')
  const { setFilter } = useUrlFilters()

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
    // Navigate to Invoices page filtered to payable direction
    const params = new URLSearchParams()
    params.set('direction', 'payable')
    if (row.type === 'loan') params.set('type', 'loan')
    else params.set('type', 'commercial')
    if (row.entity_name) params.set('entity', row.entity_name)
    router.push(`/invoices?${params.toString()}`)
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
    </div>
  )
}
