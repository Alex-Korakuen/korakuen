'use client'

import { formatCurrency, formatDate } from '@/lib/formatters'
import { useUrlSort } from '@/lib/sort-utils'
import { useUrlFilters } from '@/lib/use-url-filters'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { SummaryCard } from '@/components/ui/summary-card'
import { FilterSelect } from '@/components/ui/filter-select'
import { Pagination } from '@/components/ui/pagination'
import { Modal } from '@/components/ui/modal'
import { fetchArInvoiceDetail } from '@/lib/actions'
import { useDetailModal } from '@/lib/use-detail-modal'
import {
  getAgingColorClass,
  getAgingRowBorderClass,
} from './helpers'
import { DetailField, InvoiceDetailContent } from './ar-outstanding-detail'
import type {
  ArOutstandingRow,
  ArInvoiceDetailData,
  ArOutstandingBucketId as BucketId,
  ArOutstandingBucketCounts as BucketCounts,
} from '@/lib/types'

type Totals = {
  pen: { gross: number; receivable: number; bdn: number; count: number }
  usd: { gross: number; receivable: number; bdn: number; count: number }
}

type Props = {
  data: ArOutstandingRow[]
  totalCount: number
  page: number
  pageSize: number
  bucketCounts: BucketCounts
  totals: Totals
  projects: { id: string; project_code: string; name: string }[]
  clients: { id: string; name: string }[]
  partners: { id: string; name: string }[]
  currentFilters: {
    projectId: string
    client: string
    partnerCompanyId: string
    currency: string
    bucket: string
  }
}

export function ArOutstandingClient({
  data,
  totalCount,
  page,
  pageSize,
  bucketCounts,
  totals,
  projects,
  clients,
  partners,
  currentFilters,
}: Props) {
  const { sortColumn, sortDirection, handleSort } = useUrlSort('due_date')
  const { setFilter } = useUrlFilters()
  const modal = useDetailModal<ArOutstandingRow, ArInvoiceDetailData>()

  const activeBucket = currentFilters.bucket as BucketId

  function handleBucketClick(bucket: BucketId) {
    setFilter('bucket', activeBucket === bucket ? '' : bucket)
  }

  const hasActiveFilters =
    currentFilters.projectId !== '' ||
    currentFilters.client !== '' ||
    currentFilters.partnerCompanyId !== '' ||
    currentFilters.currency !== ''

  function clearFilters() {
    const params = new URLSearchParams(window.location.search)
    params.delete('project')
    params.delete('client')
    params.delete('partner')
    params.delete('currency')
    params.delete('page')
    window.location.search = params.toString()
  }

  const handleRowClick = (row: ArOutstandingRow) => {
    modal.open(row, () => fetchArInvoiceDetail(row.ar_invoice_id) as Promise<ArInvoiceDetailData | null>)
  }

  return (
    <div>
      <div className="mt-0">
        {/* Aging bucket cards */}
        <div className="flex flex-wrap gap-4">
          <SummaryCard
            title="Current (0-30)"
            count={bucketCounts.current.count}
            totalPEN={bucketCounts.current.pen}
            totalUSD={bucketCounts.current.usd}
            variant="future"
            isActive={activeBucket === 'current'}
            onClick={() => handleBucketClick('current')}
          />
          <SummaryCard
            title="31-60 Days"
            count={bucketCounts['31-60'].count}
            totalPEN={bucketCounts['31-60'].pen}
            totalUSD={bucketCounts['31-60'].usd}
            variant="this-week"
            isActive={activeBucket === '31-60'}
            onClick={() => handleBucketClick('31-60')}
          />
          <SummaryCard
            title="61-90 Days"
            count={bucketCounts['61-90'].count}
            totalPEN={bucketCounts['61-90'].pen}
            totalUSD={bucketCounts['61-90'].usd}
            variant="today"
            isActive={activeBucket === '61-90'}
            onClick={() => handleBucketClick('61-90')}
          />
          <SummaryCard
            title="90+ Days"
            count={bucketCounts['90+'].count}
            totalPEN={bucketCounts['90+'].pen}
            totalUSD={bucketCounts['90+'].usd}
            variant="overdue"
            isActive={activeBucket === '90+'}
            onClick={() => handleBucketClick('90+')}
          />
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <FilterSelect
            label="Project"
            value={currentFilters.projectId}
            onChange={(v) => setFilter('project', v)}
            options={projects.map((p) => ({ value: p.id, label: p.project_code }))}
            placeholder="All projects"
          />

          <FilterSelect
            label="Client"
            value={currentFilters.client}
            onChange={(v) => setFilter('client', v)}
            options={clients.map((c) => ({ value: c.name, label: c.name }))}
            placeholder="All clients"
          />

          <FilterSelect
            label="Partner"
            value={currentFilters.partnerCompanyId}
            onChange={(v) => setFilter('partner', v)}
            options={partners.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="All partners"
          />

          <FilterSelect
            label="Currency"
            value={currentFilters.currency}
            onChange={(v) => setFilter('currency', v)}
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
                  className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                  onClick={() => handleSort('gross_total')}
                >
                  Total <SortIndicator column="gross_total" sortColumn={sortColumn} sortDirection={sortDirection} />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                  onClick={() => handleSort('receivable')}
                >
                  Receivable <SortIndicator column="receivable" sortColumn={sortColumn} sortDirection={sortDirection} />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
                  onClick={() => handleSort('bdn_outstanding')}
                >
                  BdN <SortIndicator column="bdn_outstanding" sortColumn={sortColumn} sortDirection={sortDirection} />
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
              {data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                    No outstanding AR invoices found
                  </td>
                </tr>
              ) : (
                <>
                  {data.map((row) => (
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
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                        {formatCurrency(row.gross_total, row.currency)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-900">
                        {formatCurrency(row.receivable, row.currency)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                        {row.bdn_outstanding > 0
                          ? formatCurrency(row.bdn_outstanding, row.currency)
                          : '--'}
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
                  {(totals.pen.receivable !== 0 || totals.pen.bdn !== 0) && (
                    <tr className="bg-zinc-50 font-medium">
                      <td colSpan={4} className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                        Total PEN ({totals.pen.count} invoices)
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                        {formatCurrency(totals.pen.gross, 'PEN')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                        {formatCurrency(totals.pen.receivable, 'PEN')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                        {totals.pen.bdn > 0 ? formatCurrency(totals.pen.bdn, 'PEN') : '--'}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  )}
                  {(totals.usd.receivable !== 0 || totals.usd.bdn !== 0) && (
                    <tr className="bg-zinc-50 font-medium">
                      <td colSpan={4} className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                        Total USD ({totals.usd.count} invoices)
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                        {formatCurrency(totals.usd.gross, 'USD')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                        {formatCurrency(totals.usd.receivable, 'USD')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                        {totals.usd.bdn > 0 ? formatCurrency(totals.usd.bdn, 'USD') : '--'}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
        </div>
      </div>

      {/* Invoice detail modal */}
      <Modal isOpen={modal.selectedRow !== null} onClose={modal.close} title="Invoice Detail">
        {modal.loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-zinc-400">Loading detail...</div>
          </div>
        )}

        {!modal.loading && modal.selectedRow && modal.detail && (
          <InvoiceDetailContent row={modal.selectedRow} detail={modal.detail} onPaymentSuccess={modal.refetch} />
        )}

        {!modal.loading && modal.error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load full detail. Showing summary only.
          </div>
        )}

        {!modal.loading && modal.selectedRow && !modal.detail && (
          <div className="space-y-3">
            <DetailField label="Invoice#" value={modal.selectedRow.invoice_number ?? '--'} />
            <DetailField label="Client" value={modal.selectedRow.client_name} />
            <DetailField label="Project" value={modal.selectedRow.project_code} />
            <DetailField label="Outstanding" value={formatCurrency(modal.selectedRow.outstanding, modal.selectedRow.currency)} />
          </div>
        )}
      </Modal>
    </div>
  )
}
