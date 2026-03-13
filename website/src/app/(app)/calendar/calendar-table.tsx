import { formatCurrency, formatDate } from '@/lib/formatters'
import { SortIndicator } from '@/components/ui/sort-indicator'
import { getRowBorderClass, formatType } from './helpers'
import type { ObligationCalendarRow } from '@/lib/types'

type Props = {
  data: ObligationCalendarRow[]
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  onSort: (column: string) => void
  onRowClick: (row: ObligationCalendarRow) => void
}

function DirectionBadge({ direction }: { direction: string | null }) {
  if (direction === 'receivable') {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700">
        AR
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-orange-50 text-orange-700">
      AP
    </span>
  )
}

export function CalendarTable({
  data,
  sortColumn,
  sortDirection,
  onSort,
  onRowClick,
}: Props) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th
              className="cursor-pointer px-4 py-3 hover:text-zinc-700"
              onClick={() => onSort('due_date')}
            >
              Due Date <SortIndicator column="due_date" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th
              className="cursor-pointer px-4 py-3 hover:text-zinc-700"
              onClick={() => onSort('days_remaining')}
            >
              Days <SortIndicator column="days_remaining" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="px-4 py-3">Dir</th>
            <th className="px-4 py-3">Type</th>
            <th
              className="cursor-pointer px-4 py-3 hover:text-zinc-700"
              onClick={() => onSort('entity_name')}
            >
              Entity <SortIndicator column="entity_name" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th
              className="cursor-pointer px-4 py-3 hover:text-zinc-700"
              onClick={() => onSort('project_code')}
            >
              Project <SortIndicator column="project_code" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th
              className="cursor-pointer px-4 py-3 text-right hover:text-zinc-700"
              onClick={() => onSort('outstanding')}
            >
              Outstanding <SortIndicator column="outstanding" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
            <th className="px-4 py-3">Cur.</th>
            <th
              className="cursor-pointer px-4 py-3 hover:text-zinc-700"
              onClick={() => onSort('document_ref')}
            >
              Ref <SortIndicator column="document_ref" sortColumn={sortColumn} sortDirection={sortDirection} />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {data.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                No obligations found
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.invoice_id ?? `loan-${row.entity_name}-${row.due_date}`}
                className={`cursor-pointer transition-colors hover:bg-zinc-50 ${getRowBorderClass(row.days_remaining)}`}
                onClick={() => onRowClick(row)}
              >
                <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                  {row.due_date ? formatDate(row.due_date) : '--'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.days_remaining !== null ? (
                    <span
                      className={
                        row.days_remaining < 0
                          ? 'font-medium text-red-600'
                          : row.days_remaining === 0
                            ? 'font-medium text-orange-600'
                            : 'text-zinc-600'
                      }
                    >
                      {row.days_remaining}
                    </span>
                  ) : (
                    '--'
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <DirectionBadge direction={row.direction} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                  {formatType(row.type)}
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {row.entity_name ?? '--'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                  {row.project_code ?? '--'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-900">
                  {row.outstanding !== null && row.currency
                    ? formatCurrency(row.outstanding, row.currency)
                    : '--'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                  {row.currency ?? '--'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                  {row.document_ref ?? '--'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
