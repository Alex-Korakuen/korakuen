'use client'

import { formatCurrency, formatDate } from '@/lib/formatters'
import { useUrlSort } from '@/lib/sort-utils'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { StatusBadge } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import {
  getDirectionLabel,
  getDirectionColorClass,
  getPaymentTypeLabel,
  getPaymentTypeBadgeVariant,
  getRelatedLabel,
} from './helpers'
import type { PaymentsPageRow } from '@/lib/types'

type Props = {
  data: PaymentsPageRow[]
  totalCount: number
  page: number
  pageSize: number
  onRowClick: (row: PaymentsPageRow) => void
}

export function PaymentsTable({
  data,
  totalCount,
  page,
  pageSize,
  onRowClick,
}: Props) {
  const { sortColumn, sortDirection, handleSort } = useUrlSort('payment_date')

  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th
                className="cursor-pointer px-3 py-3 hover:text-zinc-700"
                onClick={() => handleSort('payment_date')}
              >
                Date <SortIndicator column="payment_date" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th className="px-3 py-3">Related</th>
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
              <th className="px-3 py-3">Type</th>
              <th
                className="cursor-pointer px-3 py-3 hover:text-zinc-700"
                onClick={() => handleSort('bank_name')}
              >
                Bank <SortIndicator column="bank_name" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-right hover:text-zinc-700"
                onClick={() => handleSort('amount')}
              >
                Amount <SortIndicator column="amount" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th className="px-3 py-3">Dir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                  No payments found
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer transition-colors hover:bg-zinc-50"
                  onClick={() => onRowClick(row)}
                >
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-600">
                    {row.payment_date ? formatDate(row.payment_date) : '--'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-zinc-500">
                    {getRelatedLabel(row.related_to, row.invoice_number)}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-zinc-700">
                    {row.entity_name ?? '--'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-zinc-500">
                    {row.project_code ?? '--'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <StatusBadge
                      label={getPaymentTypeLabel(row.payment_type)}
                      variant={getPaymentTypeBadgeVariant(row.payment_type)}
                    />
                  </td>
                  <td className="max-w-[150px] truncate px-3 py-3 text-xs text-zinc-500">
                    {row.bank_name ?? '--'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-medium text-zinc-900">
                    {formatCurrency(row.amount, row.currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getDirectionColorClass(row.direction)}`}>
                      {getDirectionLabel(row.direction)}
                    </span>
                  </td>
                </tr>
              ))
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
