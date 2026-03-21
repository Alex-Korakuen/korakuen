'use client'

import { formatDate } from '@/lib/formatters'
import { useUrlSort } from '@/lib/use-url-sort'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { StatusBadge } from '@/components/ui/status-badge'
import { tableHead, tableRowHover } from '@/lib/styles'
import {
  getPaymentTypeLabel,
  getPaymentTypeBadgeVariant,
  getRelatedLabel,
  formatSignedAmount,
  getSignedAmountColorClass,
} from './helpers'
import type { PaymentsPageRow } from '@/lib/types'

type Props = {
  data: PaymentsPageRow[]
  onRowClick: (row: PaymentsPageRow) => void
}

export function PaymentsTable({ data, onRowClick }: Props) {
  const { sortColumn, sortDirection, handleSort } = useUrlSort('payment_date')

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={tableHead}>
          <tr>
            <th
              className="cursor-pointer whitespace-nowrap px-3 py-3 text-center hover:text-ink"
              onClick={() => handleSort('payment_date')}
            >
              Date <SortIndicator column="payment_date" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th
              className="cursor-pointer px-3 py-3 text-center hover:text-ink"
              onClick={() => handleSort('entity_name')}
            >
              Entity <SortIndicator column="entity_name" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="px-3 py-3 text-center">Project</th>
            <th className="px-3 py-3 text-center">Invoice</th>
            <th
              className="cursor-pointer px-3 py-3 text-center hover:text-ink"
              onClick={() => handleSort('bank_name')}
            >
              Bank <SortIndicator column="bank_name" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th
              className="cursor-pointer px-3 py-3 text-center hover:text-ink"
              onClick={() => handleSort('amount')}
            >
              Amount <SortIndicator column="amount" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {data.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-faint">
                No payments found
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                className={tableRowHover}
                onClick={() => onRowClick(row)}
              >
                <td className="whitespace-nowrap px-3 py-3 text-center text-muted">
                  {row.payment_date ? formatDate(row.payment_date) : '--'}
                </td>
                <td className="max-w-[200px] truncate px-3 py-3 text-center text-ink">
                  {row.entity_name ?? '--'}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-center font-mono text-xs text-faint">
                  {row.project_code ?? '--'}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-center">
                  <span className="font-mono text-xs text-muted">
                    {getRelatedLabel(row.related_to, row.invoice_number)}
                  </span>
                  {row.payment_type !== 'regular' && (
                    <span className="ml-2">
                      <StatusBadge
                        label={getPaymentTypeLabel(row.payment_type)}
                        variant={getPaymentTypeBadgeVariant(row.payment_type)}
                      />
                    </span>
                  )}
                </td>
                <td className="max-w-[120px] truncate px-3 py-3 text-center text-xs text-muted">
                  {row.bank_name ?? '--'}
                </td>
                <td className={`whitespace-nowrap px-3 py-3 text-center font-mono font-medium ${getSignedAmountColorClass(row.direction)}`}>
                  {formatSignedAmount(row.amount, row.currency, row.direction)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
