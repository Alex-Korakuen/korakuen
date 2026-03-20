import { formatCurrency, formatDate } from '@/lib/formatters'
import type { EntityLedgerGroup } from '@/lib/types'

export function LedgerTable({ groups, onRowClick, emptyMessage }: {
  groups: EntityLedgerGroup[]
  onRowClick: (group: EntityLedgerGroup) => void
  emptyMessage: string
}) {
  if (groups.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-zinc-500">{emptyMessage}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Project</th>
            <th className="px-4 py-2 text-right font-medium">Invoice Total</th>
            <th className="px-4 py-2 text-right font-medium">Outstanding</th>
            <th className="px-4 py-2 text-right font-medium">Last Date</th>
            <th className="px-4 py-2 text-right font-medium">Currency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {groups.map((group) => (
            <tr
              key={`${group.projectId}|${group.currency}`}
              onClick={() => onRowClick(group)}
              className="cursor-pointer transition-colors hover:bg-blue-50"
            >
              <td className="px-4 py-2">
                <a
                  href={`/projects/${group.projectId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {group.projectCode}
                </a>
                <span className="ml-1.5 hidden text-zinc-500 lg:inline">— {group.projectName}</span>
              </td>
              <td className="px-4 py-2 text-right font-mono text-zinc-700">
                {formatCurrency(group.invoiceTotal, group.currency)}
              </td>
              <td className={`px-4 py-2 text-right font-mono font-medium ${
                group.outstanding > 0 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {group.outstanding === 0 ? 'Paid' : formatCurrency(group.outstanding, group.currency)}
              </td>
              <td className="px-4 py-2 text-right text-zinc-600">
                {group.lastDate ? formatDate(group.lastDate) : '—'}
              </td>
              <td className="px-4 py-2 text-right text-zinc-600">{group.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
