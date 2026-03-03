'use client'

import { useState, useMemo, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { SummaryCard } from '@/components/ui/summary-card'
import { Modal } from '@/components/ui/modal'
import { Tabs } from '@/components/ui/tabs'
import { fetchCostDetail, fetchLoanDetailFromSchedule } from './actions'
import {
  getDaysUntilEndOfWeek,
  getRowBorderClass,
  formatType,
  formatComprobanteType,
  formatPaymentStatus,
  statusBadgeClass,
} from './helpers'
import type { ApCalendarRow } from '@/lib/types'
import type {
  DetractionEntry,
  CostDetailData,
  LoanDetailData,
  ApCalendarBucketId as BucketId,
  ApCalendarFilters as Filters,
  ApCalendarSortColumn as SortColumn,
  ApCalendarSortDirection as SortDirection,
} from '@/lib/types'

type Props = {
  data: ApCalendarRow[]
  detractions: DetractionEntry[]
  projects: { id: string; project_code: string; name: string }[]
  isAlex: boolean
}

// --- Component ---

export function ApCalendarClient({ data, detractions, projects, isAlex }: Props) {
  const [activeTab, setActiveTab] = useState<'main' | 'taxes'>('main')
  const [activeBucket, setActiveBucket] = useState<BucketId>('all')
  const [filters, setFilters] = useState<Filters>({
    projectId: '',
    supplier: '',
    currency: '',
    titleSearch: '',
  })
  const [sortColumn, setSortColumn] = useState<SortColumn>('due_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedRow, setSelectedRow] = useState<ApCalendarRow | null>(null)
  const [costDetail, setCostDetail] = useState<CostDetailData | null>(null)
  const [loanDetail, setLoanDetail] = useState<LoanDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)

  // --- Tabs config ---
  const tabItems = [
    { id: 'main', label: 'Payment Calendar' },
    { id: 'taxes', label: 'Detracciones' },
  ]

  // --- Bucket calculations ---
  const daysToEndOfWeek = getDaysUntilEndOfWeek()

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

    const sumByCurrency = (rows: ApCalendarRow[]) => ({
      pen: rows.filter(r => r.currency === 'PEN').reduce((acc, r) => acc + (r.outstanding ?? 0), 0),
      usd: rows.filter(r => r.currency === 'USD').reduce((acc, r) => acc + (r.outstanding ?? 0), 0),
    })

    return {
      overdue: { rows: overdue, count: overdue.length, ...sumByCurrency(overdue) },
      today: { rows: today, count: today.length, ...sumByCurrency(today) },
      'this-week': { rows: thisWeek, count: thisWeek.length, ...sumByCurrency(thisWeek) },
      'next-30': { rows: next30, count: next30.length, ...sumByCurrency(next30) },
    }
  }, [data, daysToEndOfWeek])

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
    const sorted = [...rows].sort((a, b) => {
      const col = sortColumn
      const dir = sortDirection === 'asc' ? 1 : -1

      const aVal = a[col]
      const bVal = b[col]

      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir
      }

      return String(aVal).localeCompare(String(bVal)) * dir
    })

    return sorted
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

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  function clearFilters() {
    setFilters({ projectId: '', supplier: '', currency: '', titleSearch: '' })
  }

  const handleRowClick = useCallback(async (row: ApCalendarRow) => {
    setSelectedRow(row)
    setDetailLoading(true)
    setDetailError(false)
    setCostDetail(null)
    setLoanDetail(null)

    try {
      if (row.type === 'supplier_invoice' && row.cost_id) {
        const detail = await fetchCostDetail(row.cost_id)
        setCostDetail(detail as CostDetailData)
      } else if (row.type === 'loan_payment' && row.due_date && row.outstanding !== null) {
        const detail = await fetchLoanDetailFromSchedule(
          row.entity_name ?? '',
          row.due_date,
          row.outstanding
        )
        setLoanDetail(detail as LoanDetailData | null)
      }
    } catch {
      setDetailError(true)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  function closeModal() {
    setSelectedRow(null)
    setCostDetail(null)
    setLoanDetail(null)
  }

  // --- Sort indicator ---
  function SortIndicator({ column }: { column: SortColumn }) {
    if (sortColumn !== column) return <span className="ml-1 text-zinc-400">&#x2195;</span>
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? '\u2191' : '\u2193'}
      </span>
    )
  }

  // --- Render ---

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-800">AP Payment Calendar</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Upcoming and overdue payment obligations
      </p>

      <div className="mt-6">
        <Tabs
          tabs={tabItems}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as 'main' | 'taxes')}
        >
          {activeTab === 'main' && (
            <div>
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

              {/* Filters */}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">Project</label>
                  <select
                    value={filters.projectId}
                    onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))}
                    className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
                  >
                    <option value="">All projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">Supplier</label>
                  <select
                    value={filters.supplier}
                    onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}
                    className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
                  >
                    <option value="">All suppliers</option>
                    {uniqueSuppliers.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">Currency</label>
                  <select
                    value={filters.currency}
                    onChange={(e) => setFilters((f) => ({ ...f, currency: e.target.value }))}
                    className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
                  >
                    <option value="">All</option>
                    <option value="PEN">PEN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">Search title</label>
                  <input
                    type="text"
                    value={filters.titleSearch}
                    onChange={(e) => setFilters((f) => ({ ...f, titleSearch: e.target.value }))}
                    placeholder="Filter by title..."
                    className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
                  />
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="self-end rounded px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('due_date')}
                      >
                        Due Date <SortIndicator column="due_date" />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('days_remaining')}
                      >
                        Days <SortIndicator column="days_remaining" />
                      </th>
                      <th className="px-4 py-3">Type</th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('entity_name')}
                      >
                        Supplier <SortIndicator column="entity_name" />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('project_code')}
                      >
                        Project <SortIndicator column="project_code" />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('title')}
                      >
                        Title <SortIndicator column="title" />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('outstanding')}
                      >
                        Outstanding <SortIndicator column="outstanding" />
                      </th>
                      <th className="px-4 py-3">Cur.</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                          No payment obligations found
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((row, idx) => (
                        <tr
                          key={`${row.cost_id ?? row.entity_name}-${row.due_date}-${idx}`}
                          className={`cursor-pointer transition-colors hover:bg-zinc-50 ${getRowBorderClass(row.days_remaining)}`}
                          onClick={() => handleRowClick(row)}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                            {row.due_date ? formatDate(row.due_date) : '--'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {row.days_remaining !== null ? (
                              <span
                                className={
                                  row.days_remaining < 0
                                    ? 'font-medium text-red-600'
                                    : row.days_remaining === 0
                                      ? 'font-medium text-orange-600'
                                      : 'text-zinc-600'
                                }
                              >
                                {row.days_remaining}
                              </span>
                            ) : (
                              '--'
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                            {formatType(row.type)}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {row.entity_name ?? '--'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                            {row.project_code ?? '--'}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 text-zinc-700">
                            {row.title ?? '--'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                            {row.outstanding !== null && row.currency
                              ? formatCurrency(row.outstanding, row.currency as 'PEN' | 'USD')
                              : '--'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                            {row.currency ?? '--'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.payment_status)}`}
                            >
                              {formatPaymentStatus(row.payment_status)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Row count */}
              <div className="mt-2 text-xs text-zinc-400">
                {filteredData.length} of {data.length} items
              </div>
            </div>
          )}

          {activeTab === 'taxes' && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-800">Detracciones</h2>
              <p className="mt-1 text-sm text-zinc-500">
                SPOT detraccion obligations — amounts to be deposited to supplier Banco de la Nacion accounts.
              </p>

              <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Invoice Title</th>
                      <th className="px-4 py-3 text-right">Detraccion Amt</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {detractions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                          No detraccion obligations found
                        </td>
                      </tr>
                    ) : (
                      detractions.map((d, idx) => (
                        <tr key={`${d.cost_id}-${idx}`}>
                          <td className="px-4 py-3 text-zinc-700">{d.entity_name}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                            {d.project_code}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{d.title ?? '--'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                            {formatCurrency(d.detraccion_amount, d.currency as 'PEN' | 'USD')}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                d.status === 'deposited'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {d.status === 'deposited' ? 'Deposited' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-zinc-400">
                Detracciones must be deposited to the supplier&apos;s Banco de la Nacion account
                within the timeframe established by SUNAT.
              </p>
            </div>
          )}
        </Tabs>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={selectedRow !== null}
        onClose={closeModal}
        title={
          selectedRow?.type === 'loan_payment'
            ? 'Loan Payment Detail'
            : 'Cost Detail'
        }
      >
        {detailLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-zinc-400">Loading detail...</div>
          </div>
        )}

        {/* Cost detail */}
        {!detailLoading && selectedRow?.type === 'supplier_invoice' && costDetail && (
          <CostDetailContent
            row={selectedRow}
            detail={costDetail}
          />
        )}

        {/* Loan detail (Alex only) */}
        {!detailLoading && selectedRow?.type === 'loan_payment' && loanDetail && (
          <LoanDetailContent
            row={selectedRow}
            detail={loanDetail}
          />
        )}

        {/* Error message if detail fetch failed */}
        {!detailLoading && detailError && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load full detail. Showing summary only.
          </div>
        )}

        {/* Fallback if detail couldn't load */}
        {!detailLoading && selectedRow && !costDetail && !loanDetail && (
          <div className="space-y-3">
            <DetailField label="Type" value={formatType(selectedRow.type)} />
            <DetailField label="Supplier" value={selectedRow.entity_name ?? '--'} />
            <DetailField label="Project" value={selectedRow.project_code ?? '--'} />
            <DetailField label="Title" value={selectedRow.title ?? '--'} />
            <DetailField
              label="Due Date"
              value={selectedRow.due_date ? formatDate(selectedRow.due_date) : '--'}
            />
            <DetailField
              label="Outstanding"
              value={
                selectedRow.outstanding !== null && selectedRow.currency
                  ? formatCurrency(selectedRow.outstanding, selectedRow.currency as 'PEN' | 'USD')
                  : '--'
              }
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

// --- Sub-components ---

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <p className="text-sm text-zinc-700">{value}</p>
    </div>
  )
}

function CostDetailContent({
  row,
  detail,
}: {
  row: ApCalendarRow
  detail: CostDetailData
}) {
  const cost = detail.cost

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Title" value={row.title ?? '--'} />
        <DetailField label="Project" value={row.project_code ?? '--'} />
        <DetailField label="Supplier" value={row.entity_name ?? '--'} />
        <DetailField
          label="Date"
          value={cost?.date ? formatDate(cost.date) : '--'}
        />
        <DetailField
          label="Due Date"
          value={row.due_date ? formatDate(row.due_date) : '--'}
        />
        <DetailField
          label="Document Ref"
          value={detail.header?.document_ref ?? row.document_ref ?? '--'}
        />
      </div>

      {/* Bank info */}
      {detail.bank && (
        <div className="grid grid-cols-2 gap-4">
          <DetailField label="Bank" value={detail.bank.bank_name} />
          <DetailField
            label="Account (last 4)"
            value={detail.bank.account_number_last4 ?? '--'}
          />
        </div>
      )}

      {/* Comprobante info */}
      {detail.header && (
        <div className="grid grid-cols-2 gap-4">
          <DetailField
            label="Comprobante Type"
            value={formatComprobanteType(detail.header.comprobante_type)}
          />
          <DetailField
            label="Comprobante Number"
            value={detail.header.comprobante_number ?? '--'}
          />
        </div>
      )}

      {/* Cost items */}
      {detail.items.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Cost Items</h3>
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-zinc-700">{item.title}</td>
                    <td className="px-3 py-2 text-right text-zinc-600">{item.quantity}</td>
                    <td className="px-3 py-2 text-zinc-500">{item.unit_of_measure ?? '--'}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-600">
                      {formatCurrency(item.unit_price, (cost?.currency ?? 'PEN') as 'PEN' | 'USD')}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(
                        item.quantity * item.unit_price,
                        (cost?.currency ?? 'PEN') as 'PEN' | 'USD'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals */}
      {cost && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Totals</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-zinc-500">Subtotal</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(cost.subtotal ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            <span className="text-zinc-500">IGV</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(cost.igv_amount ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            <span className="text-zinc-500">Total</span>
            <span className="text-right font-mono font-semibold text-zinc-900">
              {formatCurrency(cost.total ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            {(cost.detraccion_amount ?? 0) > 0 && (
              <>
                <span className="text-zinc-500">Detraccion</span>
                <span className="text-right font-mono text-zinc-700">
                  {formatCurrency(cost.detraccion_amount ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Payment history */}
      {detail.payments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Payment History</h3>
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Currency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detail.payments.map((pmt) => (
                  <tr key={pmt.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {formatDate(pmt.payment_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 capitalize">{pmt.payment_type}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(pmt.amount, pmt.currency as 'PEN' | 'USD')}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{pmt.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment summary */}
      {cost && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="font-medium text-zinc-500">Total Paid</span>
          <span className="text-right font-mono text-zinc-700">
            {formatCurrency(cost.amount_paid ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
          </span>
          <span className="font-medium text-zinc-500">Outstanding</span>
          <span className="text-right font-mono font-semibold text-red-600">
            {formatCurrency(cost.outstanding ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
          </span>
        </div>
      )}
    </div>
  )
}

function LoanDetailContent({
  row,
  detail,
}: {
  row: ApCalendarRow
  detail: LoanDetailData
}) {
  const loan = detail.loan

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Lender" value={loan?.lender_name ?? row.entity_name ?? '--'} />
        <DetailField label="Purpose" value={loan?.purpose ?? row.title ?? '--'} />
        <DetailField
          label="Date Borrowed"
          value={loan?.date_borrowed ? formatDate(loan.date_borrowed) : '--'}
        />
        <DetailField
          label="Due Date"
          value={row.due_date ? formatDate(row.due_date) : '--'}
        />
      </div>

      {/* Loan financials */}
      {loan && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Loan Summary</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-zinc-500">Principal</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(loan.principal ?? 0, (loan.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            <span className="text-zinc-500">Total Owed</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(loan.total_owed ?? 0, (loan.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            <span className="text-zinc-500">Paid</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(loan.total_paid ?? 0, (loan.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            <span className="text-zinc-500">Outstanding</span>
            <span className="text-right font-mono font-semibold text-red-600">
              {formatCurrency(loan.outstanding ?? 0, (loan.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
          </div>
        </div>
      )}

      {/* Repayment schedule */}
      {detail.schedule.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">
            Repayment Schedule ({loan?.paid_schedule_count ?? 0}/{loan?.scheduled_payments_count ?? 0} paid)
          </h3>
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Scheduled Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detail.schedule.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {formatDate(entry.scheduled_date)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(
                        entry.scheduled_amount,
                        (loan?.currency ?? 'PEN') as 'PEN' | 'USD'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.paid
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {entry.paid ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loan payment history */}
      {detail.payments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Payment History</h3>
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detail.payments.map((pmt) => (
                  <tr key={pmt.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {formatDate(pmt.payment_date)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(pmt.amount, pmt.currency as 'PEN' | 'USD')}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{pmt.notes ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
