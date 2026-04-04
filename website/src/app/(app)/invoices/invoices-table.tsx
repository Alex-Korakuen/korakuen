'use client'

import { formatCurrency, formatDate, formatPaymentStatus, paymentStatusBadgeVariant } from '@/lib/formatters'
import { calcDaysOverdue } from '@/lib/business-utils'
import { useUrlSort } from '@/lib/use-url-sort'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { StatusBadge } from '@/components/ui/status-badge'
import { tableHead, tableRowHover } from '@/lib/styles'
import { getAgingRowBorderClass } from './helpers'
import type { InvoicesPageRow } from '@/lib/types'

type Props = {
  data: InvoicesPageRow[]
  onRowClick: (row: InvoicesPageRow) => void
}

export function InvoicesTable({
  data,
  onRowClick,
}: Props) {
  const { sortColumn, sortDirection, handleSort } = useUrlSort('due_date')

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={tableHead}>
          <tr>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('due_date')}>
              Date <SortIndicator column="due_date" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('partner_name')}>
              Partner <SortIndicator column="partner_name" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('project_code')}>
              Project <SortIndicator column="project_code" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('entity_name')}>
              Entity <SortIndicator column="entity_name" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('invoice_number')}>
              Invoice # <SortIndicator column="invoice_number" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('total')}>
              Total <SortIndicator column="total" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('outstanding')}>
              Outstanding <SortIndicator column="outstanding" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="px-3 py-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {data.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-sm text-faint">No invoices found</td>
            </tr>
          ) : (
            data.map((row) => {
              const daysOverdue = calcDaysOverdue(row.due_date)
              const borderClass = row.payment_status !== 'paid' && daysOverdue > 0
                ? getAgingRowBorderClass(daysOverdue)
                : ''

              return (
                <tr key={row.id}
                  className={`${tableRowHover} ${borderClass}`}
                  onClick={() => onRowClick(row)}>
                  <td className="whitespace-nowrap px-3 py-3 text-center text-muted">
                    {row.due_date ? formatDate(row.due_date) : '—'}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-3 text-center text-xs text-muted">
                    {row.partner_name ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-mono text-xs text-muted">
                    {row.project_code ?? '—'}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-center text-ink">
                    {row.entity_name ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-mono text-xs text-muted">
                    {row.comprobante_type === 'pending'
                      ? <span className="inline-block rounded-full border border-dashed border-caution/40 bg-caution-bg px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.04em] text-caution">Pending</span>
                      : row.invoice_number ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-mono text-ink">
                    {formatCurrency(row.total, row.currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-mono font-medium text-ink">
                    {row.outstanding + row.bdn_outstanding > 0 ? formatCurrency(row.outstanding + row.bdn_outstanding, row.currency) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <StatusBadge label={formatPaymentStatus(row.payment_status)} variant={paymentStatusBadgeVariant(row.payment_status)} />
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
