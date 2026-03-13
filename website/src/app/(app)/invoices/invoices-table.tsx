'use client'

import { formatCurrency, formatDate } from '@/lib/formatters'
import { useUrlSort } from '@/lib/sort-utils'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { StatusBadge } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import {
  getAgingRowBorderClass,
  getDirectionLabel,
  getDirectionColorClass,
  getStatusLabel,
  getStatusVariant,
} from './helpers'
import type { InvoicesPageRow, InvoiceDetailData, LoanDetailData } from '@/lib/types'

type Props = {
  data: InvoicesPageRow[]
  totalCount: number
  page: number
  pageSize: number
  expandedId: string | null
  expandLoading: boolean
  expandedDetail: InvoiceDetailData | LoanDetailData | null
  onRowClick: (row: InvoicesPageRow) => void
  renderExpandContent: (row: InvoicesPageRow) => React.ReactNode
}

export function InvoicesTable({
  data,
  totalCount,
  page,
  pageSize,
  expandedId,
  expandLoading,
  onRowClick,
  renderExpandContent,
}: Props) {
  const { sortColumn, sortDirection, handleSort } = useUrlSort('due_date')

  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-3">Dir</th>
              <th className="px-3 py-3">Type</th>
              <th
                className="cursor-pointer px-3 py-3 hover:text-zinc-700"
                onClick={() => handleSort('due_date')}
              >
                Due Date <SortIndicator column="due_date" sortColumn={sortColumn} sortDirection={sortDirection} />
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
                Balance <SortIndicator column="outstanding" sortColumn={sortColumn} sortDirection={sortDirection} />
              </th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                  No invoices found
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const isExpanded = expandedId === row.id
                const daysOverdue = row.due_date
                  ? Math.floor((Date.now() - new Date(row.due_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
                  : 0
                return (
                  <InvoiceRow
                    key={row.id}
                    row={row}
                    daysOverdue={daysOverdue}
                    isExpanded={isExpanded}
                    expandLoading={expandLoading}
                    onRowClick={onRowClick}
                    renderExpandContent={renderExpandContent}
                  />
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

function InvoiceRow({
  row,
  daysOverdue,
  isExpanded,
  expandLoading,
  onRowClick,
  renderExpandContent,
}: {
  row: InvoicesPageRow
  daysOverdue: number
  isExpanded: boolean
  expandLoading: boolean
  onRowClick: (row: InvoicesPageRow) => void
  renderExpandContent: (row: InvoicesPageRow) => React.ReactNode
}) {
  const borderClass = row.payment_status !== 'paid' && daysOverdue > 0
    ? getAgingRowBorderClass(daysOverdue)
    : ''

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors hover:bg-zinc-50 ${borderClass} ${isExpanded ? 'bg-zinc-50' : ''}`}
        onClick={() => onRowClick(row)}
      >
        <td className="whitespace-nowrap px-3 py-3">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getDirectionColorClass(row.direction)}`}>
            {getDirectionLabel(row.direction)}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-zinc-500">
          {row.type === 'loan' ? (
            <span title="Loan">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="12" height="10" rx="1.5" />
                <line x1="2" y1="7" x2="14" y2="7" />
              </svg>
            </span>
          ) : (
            <span title="Commercial">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 2h8l1 3H3l1-3z" />
                <rect x="3" y="5" width="10" height="9" rx="1" />
                <line x1="6" y1="8" x2="10" y2="8" />
                <line x1="6" y1="10.5" x2="10" y2="10.5" />
              </svg>
            </span>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-zinc-600">
          {row.due_date ? formatDate(row.due_date) : '--'}
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
          {row.outstanding > 0 ? formatCurrency(row.outstanding, row.currency) : '--'}
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          <StatusBadge
            label={getStatusLabel(row.payment_status)}
            variant={getStatusVariant(row.payment_status)}
          />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="border-t border-zinc-200 bg-zinc-50/50">
            {expandLoading ? (
              <div className="flex items-center justify-center py-6">
                <span className="text-sm text-zinc-400">Loading detail...</span>
              </div>
            ) : (
              renderExpandContent(row)
            )}
          </td>
        </tr>
      )}
    </>
  )
}
