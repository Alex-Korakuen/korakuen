'use client'

import { formatCurrency, formatDate } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { useUrlSort } from '@/lib/use-url-sort'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { tableHead, tableRowHover } from '@/lib/styles'
import type { PriceHistoryRow } from '@/lib/types'

type Props = {
  data: PriceHistoryRow[]
}

export function PricesTable({ data }: Props) {
  const { sortColumn, sortDirection, handleSort } = useUrlSort('date', 'desc')

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={tableHead}>
          <tr>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('date')}>
              Date <SortIndicator column="date" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="px-3 py-3 text-center">Source</th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('entityName')}>
              Supplier <SortIndicator column="entityName" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('projectCode')}>
              Project <SortIndicator column="projectCode" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('title')}>
              Title <SortIndicator column="title" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('quantity')}>
              Qty <SortIndicator column="quantity" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="px-3 py-3 text-center">Unit</th>
            <th className="cursor-pointer px-3 py-3 text-center hover:text-ink" onClick={() => handleSort('unit_price')}>
              Unit Price <SortIndicator column="unit_price" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="px-3 py-3 text-center">Cur.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {data.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-sm text-faint">
                No matching price records found
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const isRejected = row.quoteStatus === 'rejected'
              const isQuote = row.comprobanteType === 'pending'
              const sourceLabel = isRejected ? 'Rejected' : isQuote ? 'Quote' : 'Invoice'
              const sourceVariant = isRejected ? 'red' : isQuote ? 'blue' : 'zinc'
              return (
              <tr key={row.id} className={`${tableRowHover}${isRejected ? ' opacity-50' : ''}`}>
                <td className="whitespace-nowrap px-3 py-3 text-center text-muted">
                  {row.date ? formatDate(row.date) : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-center">
                  <StatusBadge
                    label={sourceLabel}
                    variant={sourceVariant as 'zinc' | 'blue' | 'red'}
                  />
                </td>
                <td className="px-3 py-3 text-center text-ink">
                  {row.entityName}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-center font-mono text-xs text-muted">
                  {row.projectCode}
                </td>
                <td className="max-w-[200px] truncate px-3 py-3 text-center text-ink">
                  {row.title || '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-center text-muted">
                  {row.quantity !== null ? row.quantity : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-center text-muted">
                  {row.unit_of_measure ?? '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-center font-mono text-ink">
                  {row.unit_price !== null
                    ? formatCurrency(row.unit_price, row.currency)
                    : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-center text-muted">
                  {row.currency}
                </td>
              </tr>
              )})
          )}
        </tbody>
      </table>
    </div>
  )
}
