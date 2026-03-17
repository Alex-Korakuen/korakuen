'use client'

import { formatCurrency, formatDate } from '@/lib/formatters'
import { useUrlSort } from '@/lib/sort-utils'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { StatusBadge } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import {
  getAgingRowBorderClass,
  getStatusLabel,
  getStatusVariant,
} from './helpers'
import type { InvoicesPageRow } from '@/lib/types'

type Props = {
  data: InvoicesPageRow[]
  totalCount: number
  page: number
  pageSize: number
  onRowClick: (row: InvoicesPageRow) => void
}

export function InvoicesTable({
  data,
  totalCount,
  page,
  pageSize,
  onRowClick,
}: Props) {
  const { sortColumn, sortDirection, handleSort } = useUrlSort('due_date')

  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th
                className="cursor-pointer px-3 py-3 hover:text-zinc-700"
                onClick={() => handleSort('due_date')}
              >
                Due Date <SortIndicator column="due_date" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th
                className="cursor-pointer px-3 py-3 hover:text-zinc-700"
                onClick={() => handleSort('invoice_number')}
              >
                Invoice # <SortIndicator column="invoice_number" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th
                className="cursor-pointer px-3 py-3 hover:text-zinc-700"
                onClick={() => handleSort('entity_name')}
              >
                Entity <SortIndicator column="entity_name" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th
                className="cursor-pointer px-3 py-3 hover:text-zinc-700"
                onClick={() => handleSort('project_code')}
              >
                Project <SortIndicator column="project_code" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-right hover:text-zinc-700"
                onClick={() => handleSort('total')}
              >
                Total <SortIndicator column="total" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-right hover:text-zinc-700"
                onClick={() => handleSort('outstanding')}
              >
                Outstanding <SortIndicator column="outstanding" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                  No invoices found
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const daysOverdue = row.due_date
                  ? Math.floor((Date.now() - new Date(row.due_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
                  : 0
                const borderClass = row.payment_status !== 'paid' && daysOverdue > 0
                  ? getAgingRowBorderClass(daysOverdue)
                  : ''

                return (
                  <tr
                    key={row.id}
                    className={`cursor-pointer transition-colors hover:bg-zinc-50 ${borderClass}`}
                    onClick={() => onRowClick(row)}
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-600">
                      {row.due_date ? formatDate(row.due_date) : '--'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-zinc-500">
                      {row.invoice_number ?? (row.type === 'loan' ? 'Loan' : '--')}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-zinc-700">
                      {row.entity_name ?? '--'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-zinc-500">
                      {row.project_code ?? '--'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-zinc-700">
                      {formatCurrency(row.total, row.currency)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-medium text-zinc-900">
                      {row.outstanding + row.bdn_outstanding > 0 ? formatCurrency(row.outstanding + row.bdn_outstanding, row.currency) : '--'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <StatusBadge
                        label={getStatusLabel(row.payment_status)}
                        variant={getStatusVariant(row.payment_status)}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </div>
    </>
  )
}
