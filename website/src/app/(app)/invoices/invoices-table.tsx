'use client'

import { formatCurrency, formatDate } from '@/lib/formatters'
import { useUrlSort } from '@/lib/use-url-sort'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { StatusBadge } from '@/components/ui/status-badge'
import { tableHead, tableRowHover, badgeAP, badgeAR, badgeLoan } from '@/lib/styles'
import {
  getAgingRowBorderClass,
  getStatusLabel,
  getStatusVariant,
} from './helpers'
import type { InvoicesPageRow } from '@/lib/types'

type Props = {
  data: InvoicesPageRow[]
  onRowClick: (row: InvoicesPageRow) => void
}

// Direction badge colors (shared tokens from styles.ts)
const dirBadge: Record<string, { colors: string; label: string }> = {
  'payable-commercial': { colors: badgeAP, label: 'AP' },
  'receivable-commercial': { colors: badgeAR, label: 'AR' },
  'payable-loan': { colors: badgeLoan, label: 'Loan' },
}

function DirectionBadge({ direction, type }: { direction: string; type: string }) {
  const key = `${direction}-${type}`
  const badge = dirBadge[key] ?? dirBadge['payable-commercial']
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${badge.colors}`}>
      {badge.label}
    </span>
  )
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
              Due Date <SortIndicator column="due_date" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="px-3 py-3 text-center">Direction</th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('invoice_number')}>
              Invoice # <SortIndicator column="invoice_number" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('entity_name')}>
              Entity <SortIndicator column="entity_name" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('project_code')}>
              Project <SortIndicator column="project_code" sortColumn={sortColumn} sortDirection={sortDirection} />
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
              <td colSpan={8} className="px-3 py-8 text-center text-faint">No invoices found</td>
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
                <tr key={row.id}
                  className={`${tableRowHover} ${borderClass}`}
                  onClick={() => onRowClick(row)}>
                  <td className="whitespace-nowrap px-3 py-3 text-center text-muted">
                    {row.due_date ? formatDate(row.due_date) : '--'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <DirectionBadge direction={row.direction} type={row.type} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-mono text-xs text-muted">
                    {row.invoice_number ?? '—'}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-center text-ink">
                    {row.entity_name ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-mono text-xs text-muted">
                    {row.project_code ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-mono text-ink">
                    {formatCurrency(row.total, row.currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-mono font-medium text-ink">
                    {row.outstanding + row.bdn_outstanding > 0 ? formatCurrency(row.outstanding + row.bdn_outstanding, row.currency) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <StatusBadge label={getStatusLabel(row.payment_status)} variant={getStatusVariant(row.payment_status)} />
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
