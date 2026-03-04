'use client'

import { useState, useMemo, useCallback } from 'react'
import { formatCurrency, formatDate, formatPaymentStatus, statusBadgeClass } from '@/lib/formatters'
import { useSort, sortRows } from '@/lib/sort-utils'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { SummaryCard } from '@/components/ui/summary-card'
import { Modal } from '@/components/ui/modal'
import { Tabs } from '@/components/ui/tabs'
import { fetchArInvoiceDetail } from './actions'
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
}

export function ArOutstandingClient({
  data,
  retenciones,
  detracciones,
  projects,
  clients,
  partners,
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

    const sumByCurrency = (rows: ArOutstandingRow[]) => ({
      pen: rows.filter(r => r.currency === 'PEN').reduce((acc, r) => acc + r.outstanding, 0),
      usd: rows.filter(r => r.currency === 'USD').reduce((acc, r) => acc + r.outstanding, 0),
    })

    return {
      current: { count: current.length, ...sumByCurrency(current) },
      '31-60': { count: d31_60.length, ...sumByCurrency(d31_60) },
      '61-90': { count: d61_90.length, ...sumByCurrency(d61_90) },
      '90+': { count: d90plus.length, ...sumByCurrency(d90plus) },
    }
  }, [data])

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
            detraccion: acc.detraccion + r.detraccion_amount,
            retencion: acc.retencion + r.retencion_amount,
            net: acc.net + r.net_receivable,
            paid: acc.paid + r.amount_paid,
            outstanding: acc.outstanding + r.outstanding,
          }),
          { gross: 0, detraccion: 0, retencion: 0, net: 0, paid: 0, outstanding: 0 }
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
      <h1 className="text-2xl font-semibold text-zinc-800">AR Outstanding & Collections</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Pending receivables and aging analysis
      </p>

      <div className="mt-6">
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
                  <label className="text-xs font-medium text-zinc-500">Client</label>
                  <select
                    value={filters.client}
                    onChange={(e) => setFilters((f) => ({ ...f, client: e.target.value }))}
                    className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
                  >
                    <option value="">All clients</option>
                    {uniqueClients.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">Partner</label>
                  <select
                    value={filters.partnerCompanyId}
                    onChange={(e) => setFilters((f) => ({ ...f, partnerCompanyId: e.target.value }))}
                    className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
                  >
                    <option value="">All partners</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
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
                        onClick={() => handleSort('invoice_number')}
                      >
                        Invoice# <SortIndicator column="invoice_number" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('project_code')}
                      >
                        Project <SortIndicator column="project_code" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('client_name')}
                      >
                        Client <SortIndicator column="client_name" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('invoice_date')}
                      >
                        Inv. Date <SortIndicator column="invoice_date" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('due_date')}
                      >
                        Due Date <SortIndicator column="due_date" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('days_overdue')}
                      >
                        Days <SortIndicator column="days_overdue" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('gross_total')}
                      >
                        Gross <SortIndicator column="gross_total" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th className="px-4 py-3 text-right">Detr.</th>
                      <th className="px-4 py-3 text-right">Ret.</th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('net_receivable')}
                      >
                        Net Recv. <SortIndicator column="net_receivable" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('outstanding')}
                      >
                        Outstdg. <SortIndicator column="outstanding" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-4 py-8 text-center text-zinc-400">
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
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-700">
                              {row.invoice_number ?? '--'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                              {row.project_code}
                            </td>
                            <td className="px-4 py-3 text-zinc-700">{row.client_name}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                              {row.invoice_date ? formatDate(row.invoice_date) : '--'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                              {row.due_date ? formatDate(row.due_date) : '--'}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right ${getAgingColorClass(row.days_overdue)}`}>
                              {row.days_overdue}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                              {formatCurrency(row.gross_total, row.currency as 'PEN' | 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-500">
                              {row.detraccion_amount > 0
                                ? formatCurrency(row.detraccion_amount, row.currency as 'PEN' | 'USD')
                                : '--'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-500">
                              {row.retencion_amount > 0
                                ? formatCurrency(row.retencion_amount, row.currency as 'PEN' | 'USD')
                                : '--'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-800">
                              {formatCurrency(row.net_receivable, row.currency as 'PEN' | 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                              {formatCurrency(row.amount_paid, row.currency as 'PEN' | 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-900">
                              {formatCurrency(row.outstanding, row.currency as 'PEN' | 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.payment_status)}`}>
                                {formatPaymentStatus(row.payment_status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {/* Total rows (one per currency with data) */}
                        {totals.pen.outstanding !== 0 && (
                          <tr className="bg-zinc-50 font-medium">
                            <td colSpan={6} className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                              Total PEN ({filteredData.filter(r => r.currency === 'PEN').length} invoices)
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                              {formatCurrency(totals.pen.gross, 'PEN')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-500">
                              {formatCurrency(totals.pen.detraccion, 'PEN')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-500">
                              {formatCurrency(totals.pen.retencion, 'PEN')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-800">
                              {formatCurrency(totals.pen.net, 'PEN')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                              {formatCurrency(totals.pen.paid, 'PEN')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                              {formatCurrency(totals.pen.outstanding, 'PEN')}
                            </td>
                            <td />
                          </tr>
                        )}
                        {totals.usd.outstanding !== 0 && (
                          <tr className="bg-zinc-50 font-medium">
                            <td colSpan={6} className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                              Total USD ({filteredData.filter(r => r.currency === 'USD').length} invoices)
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                              {formatCurrency(totals.usd.gross, 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-500">
                              {formatCurrency(totals.usd.detraccion, 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-500">
                              {formatCurrency(totals.usd.retencion, 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-800">
                              {formatCurrency(totals.usd.net, 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                              {formatCurrency(totals.usd.paid, 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                              {formatCurrency(totals.usd.outstanding, 'USD')}
                            </td>
                            <td />
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
