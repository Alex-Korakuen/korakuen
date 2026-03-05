'use client'

import { useState, useMemo, useCallback } from 'react'
import { formatCurrency, formatDate, sumByCurrency } from '@/lib/formatters'
import { useSort, sortRows } from '@/lib/sort-utils'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { SummaryCard } from '@/components/ui/summary-card'
import { FilterSelect } from '@/components/ui/filter-select'
import { Modal } from '@/components/ui/modal'
import { Tabs } from '@/components/ui/tabs'
import { fetchArInvoiceDetail } from '@/lib/actions'
import {
  getAgingBucket,
  getAgingColorClass,
  getAgingRowBorderClass,
} from './helpers'
import { DetailField, InvoiceDetailContent } from './ar-outstanding-detail'
import { ArOutstandingTaxes } from './ar-outstanding-taxes'
import type {
  ArOutstandingRow,
  ArDetractionEntry,
  ArInvoiceDetailData,
  ArOutstandingBucketId as BucketId,
  ArOutstandingFilters as Filters,
  ArOutstandingSortColumn as SortColumn,
  RetencionDashboardRow,
} from '@/lib/types'

type Props = {
  data: ArOutstandingRow[]
  retenciones: RetencionDashboardRow[]
  detracciones: ArDetractionEntry[]
  projects: { id: string; project_code: string; name: string }[]
  clients: { id: string; name: string }[]
  partners: { id: string; name: string }[]
  exchangeRate: { mid_rate: number; rate_date: string } | null
}

export function ArOutstandingClient({
  data,
  retenciones,
  detracciones,
  projects,
  clients,
  partners,
  exchangeRate,
}: Props) {
  const [activeTab, setActiveTab] = useState<'main' | 'taxes'>('main')
  const [activeBucket, setActiveBucket] = useState<BucketId>('all')
  const [filters, setFilters] = useState<Filters>({
    projectId: '',
    client: '',
    partnerCompanyId: '',
    currency: '',
  })
  const { sortColumn, sortDirection, handleSort } = useSort<SortColumn>('due_date')
  const [selectedRow, setSelectedRow] = useState<ArOutstandingRow | null>(null)
  const [invoiceDetail, setInvoiceDetail] = useState<ArInvoiceDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)

  const tabItems = [
    { id: 'main', label: 'Outstanding' },
    { id: 'taxes', label: 'Taxes' },
  ]

  // --- Bucket calculations ---
  const buckets = useMemo(() => {
    const current = data.filter((r) => r.days_overdue <= 30)
    const d31_60 = data.filter((r) => r.days_overdue > 30 && r.days_overdue <= 60)
    const d61_90 = data.filter((r) => r.days_overdue > 60 && r.days_overdue <= 90)
    const d90plus = data.filter((r) => r.days_overdue > 90)

    const midRate = exchangeRate?.mid_rate ?? null

    return {
      current: { count: current.length, ...sumByCurrency(current, midRate) },
      '31-60': { count: d31_60.length, ...sumByCurrency(d31_60, midRate) },
      '61-90': { count: d61_90.length, ...sumByCurrency(d61_90, midRate) },
      '90+': { count: d90plus.length, ...sumByCurrency(d90plus, midRate) },
    }
  }, [data, exchangeRate])

  // --- Filtered and sorted data ---
  const filteredData = useMemo(() => {
    let rows = data

    // Bucket filter
    if (activeBucket !== 'all') {
      rows = rows.filter((r) => getAgingBucket(r.days_overdue) === activeBucket)
    }

    // Dropdown filters
    if (filters.projectId) {
      rows = rows.filter((r) => r.project_id === filters.projectId)
    }
    if (filters.client) {
      rows = rows.filter((r) => r.client_name === filters.client)
    }
    if (filters.partnerCompanyId) {
      rows = rows.filter((r) => r.partner_company_id === filters.partnerCompanyId)
    }
    if (filters.currency) {
      rows = rows.filter((r) => r.currency === filters.currency)
    }

    // Sort
    return sortRows(rows, sortColumn, sortDirection)
  }, [data, activeBucket, filters, sortColumn, sortDirection])

  // --- Totals row (split by currency) ---
  const totals = useMemo(() => {
    const sumFor = (cur: string) =>
      filteredData
        .filter((r) => r.currency === cur)
        .reduce(
          (acc, r) => ({
            gross: acc.gross + r.gross_total,
            outstanding: acc.outstanding + r.outstanding,
          }),
          { gross: 0, outstanding: 0 }
        )
    return { pen: sumFor('PEN'), usd: sumFor('USD') }
  }, [filteredData])

  const hasActiveFilters =
    filters.projectId !== '' ||
    filters.client !== '' ||
    filters.partnerCompanyId !== '' ||
    filters.currency !== ''

  // --- Event handlers ---
  function handleBucketClick(bucket: BucketId) {
    setActiveBucket((prev) => (prev === bucket ? 'all' : bucket))
  }

  function clearFilters() {
    setFilters({ projectId: '', client: '', partnerCompanyId: '', currency: '' })
  }

  const handleRowClick = useCallback(async (row: ArOutstandingRow) => {
    setSelectedRow(row)
    setDetailLoading(true)
    setDetailError(false)
    setInvoiceDetail(null)

    try {
      const detail = await fetchArInvoiceDetail(row.ar_invoice_id)
      setInvoiceDetail(detail as ArInvoiceDetailData)
    } catch {
      setDetailError(true)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  function closeModal() {
    setSelectedRow(null)
    setInvoiceDetail(null)
  }

  // --- Unique clients for filter ---
  const uniqueClients = useMemo(() => {
    const names = new Set<string>()
    for (const row of data) {
      if (row.client_name && row.client_name !== '—') names.add(row.client_name)
    }
    return Array.from(names).sort()
  }, [data])

  return (
    <div>
      <div className="mt-0">
        <Tabs
          tabs={tabItems}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as 'main' | 'taxes')}
        >
          {activeTab === 'main' && (
            <div>
              {/* Aging bucket cards */}
              <div className="flex flex-wrap gap-4">
                <SummaryCard
                  title="Current (0-30)"
                  count={buckets.current.count}
                  totalPEN={buckets.current.pen}
                  totalUSD={buckets.current.usd}
                  variant="future"
                  isActive={activeBucket === 'current'}
                  onClick={() => handleBucketClick('current')}
                />
                <SummaryCard
                  title="31-60 Days"
                  count={buckets['31-60'].count}
                  totalPEN={buckets['31-60'].pen}
                  totalUSD={buckets['31-60'].usd}
                  variant="this-week"
                  isActive={activeBucket === '31-60'}
                  onClick={() => handleBucketClick('31-60')}
                />
                <SummaryCard
                  title="61-90 Days"
                  count={buckets['61-90'].count}
                  totalPEN={buckets['61-90'].pen}
                  totalUSD={buckets['61-90'].usd}
                  variant="today"
                  isActive={activeBucket === '61-90'}
                  onClick={() => handleBucketClick('61-90')}
                />
                <SummaryCard
                  title="90+ Days"
                  count={buckets['90+'].count}
                  totalPEN={buckets['90+'].pen}
                  totalUSD={buckets['90+'].usd}
                  variant="overdue"
                  isActive={activeBucket === '90+'}
                  onClick={() => handleBucketClick('90+')}
                />
              </div>

              {/* Filters */}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <FilterSelect
                  label="Project"
                  value={filters.projectId}
                  onChange={(v) => setFilters((f) => ({ ...f, projectId: v }))}
                  options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
                  placeholder="All projects"
                />

                <FilterSelect
                  label="Client"
                  value={filters.client}
                  onChange={(v) => setFilters((f) => ({ ...f, client: v }))}
                  options={uniqueClients.map((name) => ({ value: name, label: name }))}
                  placeholder="All clients"
                />

                <FilterSelect
                  label="Partner"
                  value={filters.partnerCompanyId}
                  onChange={(v) => setFilters((f) => ({ ...f, partnerCompanyId: v }))}
                  options={partners.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="All partners"
                />

                <FilterSelect
                  label="Currency"
                  value={filters.currency}
                  onChange={(v) => setFilters((f) => ({ ...f, currency: v }))}
                  options={[
                    { value: 'PEN', label: 'PEN' },
                    { value: 'USD', label: 'USD' },
                  ]}
                  placeholder="All"
                />

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

              {/* Invoice table */}
              <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('due_date')}
                      >
                        Due Date <SortIndicator column="due_date" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('days_overdue')}
                      >
                        Days <SortIndicator column="days_overdue" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('client_name')}
                      >
                        Client <SortIndicator column="client_name" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('project_code')}
                      >
                        Project <SortIndicator column="project_code" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('invoice_number')}
                      >
                        Title <SortIndicator column="invoice_number" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('gross_total')}
                      >
                        Gross <SortIndicator column="gross_total" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('outstanding')}
                      >
                        Outstanding <SortIndicator column="outstanding" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th className="px-4 py-3">Cur.</th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('invoice_number')}
                      >
                        Invoice # <SortIndicator column="invoice_number" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                          No outstanding AR invoices found
                        </td>
                      </tr>
                    ) : (
                      <>
                        {filteredData.map((row) => (
                          <tr
                            key={row.ar_invoice_id}
                            className={`cursor-pointer transition-colors hover:bg-zinc-50 ${getAgingRowBorderClass(row.days_overdue)}`}
                            onClick={() => handleRowClick(row)}
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                              {row.due_date ? formatDate(row.due_date) : '--'}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 ${getAgingColorClass(row.days_overdue)}`}>
                              {row.days_overdue > 0 ? row.days_overdue : '—'}
                            </td>
                            <td className="px-4 py-3 text-zinc-700">{row.client_name}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                              {row.project_code}
                            </td>
                            <td className="max-w-[200px] truncate px-4 py-3 text-zinc-700">
                              {row.invoice_number ?? '--'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                              {formatCurrency(row.gross_total, row.currency as 'PEN' | 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-900">
                              {formatCurrency(row.outstanding, row.currency as 'PEN' | 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                              {row.currency}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                              {row.invoice_number ?? '--'}
                            </td>
                          </tr>
                        ))}
                        {/* Total rows (one per currency with data) */}
                        {totals.pen.outstanding !== 0 && (
                          <tr className="bg-zinc-50 font-medium">
                            <td colSpan={5} className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                              Total PEN ({filteredData.filter(r => r.currency === 'PEN').length} invoices)
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                              {formatCurrency(totals.pen.gross, 'PEN')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                              {formatCurrency(totals.pen.outstanding, 'PEN')}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        )}
                        {totals.usd.outstanding !== 0 && (
                          <tr className="bg-zinc-50 font-medium">
                            <td colSpan={5} className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                              Total USD ({filteredData.filter(r => r.currency === 'USD').length} invoices)
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                              {formatCurrency(totals.usd.gross, 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                              {formatCurrency(totals.usd.outstanding, 'USD')}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 text-xs text-zinc-400">
                {filteredData.length} of {data.length} invoices
              </div>
            </div>
          )}

          {activeTab === 'taxes' && (
            <ArOutstandingTaxes
              retenciones={retenciones}
              detracciones={detracciones}
              projects={projects}
              uniqueClients={uniqueClients}
            />
          )}
        </Tabs>
      </div>

      {/* Invoice detail modal */}
      <Modal isOpen={selectedRow !== null} onClose={closeModal} title="Invoice Detail">
        {detailLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-zinc-400">Loading detail...</div>
          </div>
        )}

        {!detailLoading && selectedRow && invoiceDetail && (
          <InvoiceDetailContent row={selectedRow} detail={invoiceDetail} />
        )}

        {!detailLoading && detailError && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load full detail. Showing summary only.
          </div>
        )}

        {!detailLoading && selectedRow && !invoiceDetail && (
          <div className="space-y-3">
            <DetailField label="Invoice#" value={selectedRow.invoice_number ?? '--'} />
            <DetailField label="Client" value={selectedRow.client_name} />
            <DetailField label="Project" value={selectedRow.project_code} />
            <DetailField label="Outstanding" value={formatCurrency(selectedRow.outstanding, selectedRow.currency as 'PEN' | 'USD')} />
          </div>
        )}
      </Modal>
    </div>
  )
}
