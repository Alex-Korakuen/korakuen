'use client'

import { useState, useMemo, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { SummaryCard } from '@/components/ui/summary-card'
import { Modal } from '@/components/ui/modal'
import { Tabs } from '@/components/ui/tabs'
import { fetchArInvoiceDetail } from './actions'
import {
  getAgingBucket,
  getAgingColorClass,
  getAgingRowBorderClass,
  getRetencionAgingColor,
  formatPaymentStatus,
  statusBadgeClass,
} from './helpers'
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
  const [sortColumn, setSortColumn] = useState<SortColumn>('due_date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedRow, setSelectedRow] = useState<ArOutstandingRow | null>(null)
  const [invoiceDetail, setInvoiceDetail] = useState<ArInvoiceDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Taxes tab filters
  const [retFilter, setRetFilter] = useState({ projectCode: '', client: '', status: '' })

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
    const sorted = [...rows].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir
      }
      return String(aVal).localeCompare(String(bVal)) * dir
    })

    return sorted
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

  // --- Filtered retenciones ---
  const filteredRetenciones = useMemo(() => {
    let rows = retenciones
    if (retFilter.projectCode) {
      rows = rows.filter((r) => r.project_code === retFilter.projectCode)
    }
    if (retFilter.client) {
      rows = rows.filter((r) => r.client_name === retFilter.client)
    }
    if (retFilter.status) {
      const verified = retFilter.status === 'verified'
      rows = rows.filter((r) => r.retencion_verified === verified)
    }
    return rows
  }, [retenciones, retFilter])

  const hasActiveFilters =
    filters.projectId !== '' ||
    filters.client !== '' ||
    filters.partnerCompanyId !== '' ||
    filters.currency !== ''

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
    setFilters({ projectId: '', client: '', partnerCompanyId: '', currency: '' })
  }

  const handleRowClick = useCallback(async (row: ArOutstandingRow) => {
    setSelectedRow(row)
    setDetailLoading(true)
    setInvoiceDetail(null)

    try {
      const detail = await fetchArInvoiceDetail(row.ar_invoice_id)
      setInvoiceDetail(detail as ArInvoiceDetailData)
    } catch {
      // Will show fallback
    } finally {
      setDetailLoading(false)
    }
  }, [])

  function closeModal() {
    setSelectedRow(null)
    setInvoiceDetail(null)
  }

  // --- Sort indicator ---
  function SortIndicator({ column }: { column: SortColumn }) {
    if (sortColumn !== column) return <span className="ml-1 text-zinc-400">&#x2195;</span>
    return <span className="ml-1">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>
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
                        Invoice# <SortIndicator column="invoice_number" />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('project_code')}
                      >
                        Project <SortIndicator column="project_code" />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('client_name')}
                      >
                        Client <SortIndicator column="client_name" />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('invoice_date')}
                      >
                        Inv. Date <SortIndicator column="invoice_date" />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 hover:text-zinc-700"
                        onClick={() => handleSort('due_date')}
                      >
                        Due Date <SortIndicator column="due_date" />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('days_overdue')}
                      >
                        Days <SortIndicator column="days_overdue" />
                      </th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('gross_total')}
                      >
                        Gross <SortIndicator column="gross_total" />
                      </th>
                      <th className="px-4 py-3 text-right">Detr.</th>
                      <th className="px-4 py-3 text-right">Ret.</th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('net_receivable')}
                      >
                        Net Recv. <SortIndicator column="net_receivable" />
                      </th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th
                        className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                        onClick={() => handleSort('outstanding')}
                      >
                        Outstdg. <SortIndicator column="outstanding" />
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
            <div className="space-y-8">
              {/* Retenciones section */}
              <div>
                <h2 className="text-lg font-semibold text-zinc-800">Retenciones</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Has the client paid the 3% retencion to SUNAT?
                </p>

                {/* Retencion filters */}
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-500">Project</label>
                    <select
                      value={retFilter.projectCode}
                      onChange={(e) => setRetFilter((f) => ({ ...f, projectCode: e.target.value }))}
                      className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
                    >
                      <option value="">All projects</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.project_code}>
                          {p.project_code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-500">Client</label>
                    <select
                      value={retFilter.client}
                      onChange={(e) => setRetFilter((f) => ({ ...f, client: e.target.value }))}
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
                    <label className="text-xs font-medium text-zinc-500">Status</label>
                    <select
                      value={retFilter.status}
                      onChange={(e) => setRetFilter((f) => ({ ...f, status: e.target.value }))}
                      className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
                    >
                      <option value="">All</option>
                      <option value="unverified">Unverified</option>
                      <option value="verified">Verified</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3">Invoice#</th>
                        <th className="px-4 py-3">Inv. Date</th>
                        <th className="px-4 py-3 text-right">Days</th>
                        <th className="px-4 py-3 text-right">Ret. Amount</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredRetenciones.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                            No retenciones found
                          </td>
                        </tr>
                      ) : (
                        filteredRetenciones.map((r) => (
                          <tr key={r.ar_invoice_id}>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                              {r.project_code}
                            </td>
                            <td className="px-4 py-3 text-zinc-700">{r.client_name}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-700">
                              {r.invoice_number}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                              {r.invoice_date ? formatDate(r.invoice_date) : '--'}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right ${getRetencionAgingColor(r.days_since_invoice ?? 0, r.retencion_verified ?? false)}`}>
                              {r.days_since_invoice ?? '--'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                              {formatCurrency(r.retencion_amount ?? 0, (r.currency ?? 'PEN') as 'PEN' | 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                  r.retencion_verified
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {r.retencion_verified ? 'Verified' : 'Unverified'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detracciones section */}
              <div>
                <h2 className="text-lg font-semibold text-zinc-800">Detracciones</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Has the client deposited to our Banco de la Nacion?
                </p>

                <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3">Invoice#</th>
                        <th className="px-4 py-3 text-right">Detr. Amount</th>
                        <th className="px-4 py-3 text-right">Received</th>
                        <th className="px-4 py-3 text-right">Pending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {detracciones.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                            No detracciones found
                          </td>
                        </tr>
                      ) : (
                        detracciones.map((d) => (
                          <tr key={d.ar_invoice_id}>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                              {d.project_code}
                            </td>
                            <td className="px-4 py-3 text-zinc-700">{d.client_name}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-700">
                              {d.invoice_number ?? '--'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                              {formatCurrency(d.detraccion_amount, d.currency as 'PEN' | 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-green-700">
                              {formatCurrency(d.received, d.currency as 'PEN' | 'USD')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                              <span className={d.pending > 0 ? 'text-red-600 font-medium' : 'text-zinc-400'}>
                                {d.pending > 0
                                  ? formatCurrency(d.pending, d.currency as 'PEN' | 'USD')
                                  : '--'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
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

// --- Sub-components ---

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <p className="text-sm text-zinc-700">{value}</p>
    </div>
  )
}

function InvoiceDetailContent({
  row,
  detail,
}: {
  row: ArOutstandingRow
  detail: ArInvoiceDetailData
}) {
  const invoice = detail.invoice
  const cur = (row.currency ?? 'PEN') as 'PEN' | 'USD'

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Invoice#" value={row.invoice_number ?? '--'} />
        <DetailField label="Project" value={detail.project_code} />
        <DetailField label="Client" value={detail.client_name} />
        <DetailField label="Partner" value={detail.partner_name} />
        <DetailField
          label="Invoice Date"
          value={row.invoice_date ? formatDate(row.invoice_date) : '--'}
        />
        <DetailField
          label="Due Date"
          value={row.due_date ? formatDate(row.due_date) : '--'}
        />
      </div>

      {/* Financial breakdown */}
      {invoice && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Breakdown</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-zinc-500">Subtotal</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(invoice.subtotal ?? 0, cur)}
            </span>
            <span className="text-zinc-500">IGV ({invoice.igv_rate ?? 18}%)</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(invoice.igv_amount ?? 0, cur)}
            </span>
            <span className="text-zinc-500">Gross Total</span>
            <span className="text-right font-mono font-semibold text-zinc-900">
              {formatCurrency(invoice.gross_total ?? 0, cur)}
            </span>
            {(invoice.detraccion_amount ?? 0) > 0 && (
              <>
                <span className="text-zinc-500">Detraccion ({invoice.detraccion_rate ?? 0}%)</span>
                <span className="text-right font-mono text-zinc-700">
                  -{formatCurrency(invoice.detraccion_amount ?? 0, cur)}
                </span>
              </>
            )}
            {(invoice.retencion_amount ?? 0) > 0 && (
              <>
                <span className="text-zinc-500">Retencion ({invoice.retencion_rate ?? 0}%)</span>
                <span className="text-right font-mono text-zinc-700">
                  -{formatCurrency(invoice.retencion_amount ?? 0, cur)}
                </span>
              </>
            )}
            <span className="font-medium text-zinc-700">Net Receivable</span>
            <span className="text-right font-mono font-semibold text-zinc-900">
              {formatCurrency(invoice.net_receivable ?? 0, cur)}
            </span>
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
                    <td className="px-3 py-2 capitalize text-zinc-500">{pmt.payment_type}</td>
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
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className="font-medium text-zinc-500">Total Paid</span>
        <span className="text-right font-mono text-zinc-700">
          {formatCurrency(row.amount_paid, cur)}
        </span>
        <span className="font-medium text-zinc-500">Outstanding</span>
        <span className="text-right font-mono font-semibold text-red-600">
          {formatCurrency(row.outstanding, cur)}
        </span>
      </div>

      {/* Retencion status */}
      {invoice?.retencion_applicable && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Retencion verification:</span>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                invoice.retencion_applicable
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {invoice.retencion_applicable ? 'Verified' : 'Unverified'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
