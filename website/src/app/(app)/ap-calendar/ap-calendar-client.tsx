'use client'

import { useState, useMemo } from 'react'
import { formatCurrency, formatDate, sumByCurrency } from '@/lib/formatters'
import { useSort, sortRows } from '@/lib/sort-utils'
import { SummaryCard } from '@/components/ui/summary-card'
import { Modal } from '@/components/ui/modal'
import { fetchCostDetail, fetchLoanDetailFromSchedule } from '@/lib/actions'
import { useDetailModal } from '@/lib/use-detail-modal'
import { getDaysUntilEndOfWeek, formatType } from './helpers'
import { DetailField, CostDetailContent, LoanDetailContent } from './ap-calendar-detail'
import { ApCalendarFilters } from './ap-calendar-filters'
import { ApCalendarTable } from './ap-calendar-table'
import type { ApCalendarRow } from '@/lib/types'
import type {
  CostDetailData,
  LoanDetailData,
  ApCalendarBucketId as BucketId,
  ApCalendarFilters as Filters,
  ApCalendarSortColumn as SortColumn,
} from '@/lib/types'

type Props = {
  data: ApCalendarRow[]
  projects: { id: string; project_code: string; name: string }[]
  exchangeRate: { mid_rate: number; rate_date: string } | null
}

// --- Component ---

export function ApCalendarClient({ data, projects, exchangeRate }: Props) {
  const [activeBucket, setActiveBucket] = useState<BucketId>('all')
  const [filters, setFilters] = useState<Filters>({
    projectId: '',
    supplier: '',
    currency: '',
    titleSearch: '',
  })
  const { sortColumn, sortDirection, handleSort } = useSort<SortColumn>('due_date')
  const modal = useDetailModal<ApCalendarRow, CostDetailData | LoanDetailData>()

  // --- Bucket calculations ---
  const daysToEndOfWeek = getDaysUntilEndOfWeek()
  const midRate = exchangeRate?.mid_rate ?? null

  const buckets = useMemo(() => {
    const overdue = data.filter((r) => r.days_remaining !== null && r.days_remaining < 0)
    const today = data.filter((r) => r.days_remaining === 0)
    const thisWeek = data.filter(
      (r) =>
        r.days_remaining !== null &&
        r.days_remaining > 0 &&
        r.days_remaining <= daysToEndOfWeek
    )
    const next30 = data.filter(
      (r) =>
        r.days_remaining !== null &&
        r.days_remaining > daysToEndOfWeek &&
        r.days_remaining <= 30
    )

    return {
      overdue: { rows: overdue, count: overdue.length, ...sumByCurrency(overdue, midRate) },
      today: { rows: today, count: today.length, ...sumByCurrency(today, midRate) },
      'this-week': { rows: thisWeek, count: thisWeek.length, ...sumByCurrency(thisWeek, midRate) },
      'next-30': { rows: next30, count: next30.length, ...sumByCurrency(next30, midRate) },
    }
  }, [data, daysToEndOfWeek, midRate])

  // --- Unique suppliers for filter dropdown ---
  const uniqueSuppliers = useMemo(() => {
    const names = new Set<string>()
    for (const row of data) {
      if (row.entity_name) names.add(row.entity_name)
    }
    return Array.from(names).sort()
  }, [data])

  // --- Filtering and sorting ---
  const filteredData = useMemo(() => {
    let rows = data

    // Bucket filter
    if (activeBucket !== 'all') {
      if (activeBucket === 'overdue') {
        rows = rows.filter((r) => r.days_remaining !== null && r.days_remaining < 0)
      } else if (activeBucket === 'today') {
        rows = rows.filter((r) => r.days_remaining === 0)
      } else if (activeBucket === 'this-week') {
        rows = rows.filter(
          (r) =>
            r.days_remaining !== null &&
            r.days_remaining > 0 &&
            r.days_remaining <= daysToEndOfWeek
        )
      } else if (activeBucket === 'next-30') {
        rows = rows.filter(
          (r) =>
            r.days_remaining !== null &&
            r.days_remaining > daysToEndOfWeek &&
            r.days_remaining <= 30
        )
      }
    }

    // Dropdown/text filters
    if (filters.projectId) {
      rows = rows.filter((r) => r.project_id === filters.projectId)
    }
    if (filters.supplier) {
      rows = rows.filter((r) => r.entity_name === filters.supplier)
    }
    if (filters.currency) {
      rows = rows.filter((r) => r.currency === filters.currency)
    }
    if (filters.titleSearch) {
      const search = filters.titleSearch.toLowerCase()
      rows = rows.filter((r) => (r.title ?? '').toLowerCase().includes(search))
    }

    // Sort
    return sortRows(rows, sortColumn, sortDirection)
  }, [data, activeBucket, filters, sortColumn, sortDirection, daysToEndOfWeek])

  const hasActiveFilters =
    filters.projectId !== '' ||
    filters.supplier !== '' ||
    filters.currency !== '' ||
    filters.titleSearch !== ''

  // --- Event handlers ---

  function handleBucketClick(bucket: BucketId) {
    setActiveBucket((prev) => (prev === bucket ? 'all' : bucket))
  }

  function clearFilters() {
    setFilters({ projectId: '', supplier: '', currency: '', titleSearch: '' })
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

  // --- Render ---

  return (
    <div>
      <div className="mt-0">
        {/* Summary Cards */}
        <div className="flex flex-wrap gap-4">
          <SummaryCard
            title="Overdue"
            count={buckets.overdue.count}
            totalPEN={buckets.overdue.pen}
            totalUSD={buckets.overdue.usd}
            variant="overdue"
            isActive={activeBucket === 'overdue'}
            onClick={() => handleBucketClick('overdue')}
          />
          <SummaryCard
            title="Due Today"
            count={buckets.today.count}
            totalPEN={buckets.today.pen}
            totalUSD={buckets.today.usd}
            variant="today"
            isActive={activeBucket === 'today'}
            onClick={() => handleBucketClick('today')}
          />
          <SummaryCard
            title="This Week"
            count={buckets['this-week'].count}
            totalPEN={buckets['this-week'].pen}
            totalUSD={buckets['this-week'].usd}
            variant="this-week"
            isActive={activeBucket === 'this-week'}
            onClick={() => handleBucketClick('this-week')}
          />
          <SummaryCard
            title="Next 30 Days"
            count={buckets['next-30'].count}
            totalPEN={buckets['next-30'].pen}
            totalUSD={buckets['next-30'].usd}
            variant="future"
            isActive={activeBucket === 'next-30'}
            onClick={() => handleBucketClick('next-30')}
          />
        </div>

        <ApCalendarFilters
          filters={filters}
          setFilters={setFilters}
          projects={projects}
          uniqueSuppliers={uniqueSuppliers}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

        <ApCalendarTable
          data={filteredData}
          totalCount={data.length}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={handleRowClick}
        />
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

        {/* Cost detail */}
        {!modal.loading && modal.selectedRow?.type === 'supplier_invoice' && modal.detail && (
          <CostDetailContent
            row={modal.selectedRow}
            detail={modal.detail as CostDetailData}
          />
        )}

        {/* Loan detail */}
        {!modal.loading && modal.selectedRow?.type === 'loan_payment' && modal.detail && (
          <LoanDetailContent
            row={modal.selectedRow}
            detail={modal.detail as LoanDetailData}
          />
        )}

        {/* Error message if detail fetch failed */}
        {!modal.loading && modal.error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load full detail. Showing summary only.
          </div>
        )}

        {/* Fallback if detail couldn't load */}
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
                  ? formatCurrency(modal.selectedRow.outstanding, modal.selectedRow.currency as 'PEN' | 'USD')
                  : '--'
              }
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
