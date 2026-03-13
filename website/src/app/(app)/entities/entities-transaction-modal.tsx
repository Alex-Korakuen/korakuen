import { formatCurrency, formatDate } from '@/lib/formatters'
import { Modal } from '@/components/ui/modal'
import type { EntityLedgerGroup } from '@/lib/types'

type Props = {
  group: EntityLedgerGroup | null
  onClose: () => void
}

export function TransactionModal({ group, onClose }: Props) {
  const cur = group?.currency ?? 'PEN'

  return (
    <Modal
      isOpen={!!group}
      onClose={onClose}
      title={group ? `${group.projectCode} — ${group.projectName}` : ''}
    >
      {group && (
        <>
          <p className="mb-4 text-xs text-zinc-500">
            {group.transactions.length} invoice{group.transactions.length === 1 ? '' : 's'} · {group.currency}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Title</th>
                  <th className="px-4 py-2 text-right font-medium">Invoice Total</th>
                  <th className="px-4 py-2 text-right font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {group.transactions.map((tx) => (
                  <tr key={tx.transactionId} className="transition-colors hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-700">
                      {tx.date ? formatDate(tx.date) : '—'}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-zinc-700">
                      {tx.title ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(tx.invoiceTotal, cur)}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2 text-right font-mono font-medium ${
                      tx.outstanding > 0 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {tx.outstanding === 0 ? 'Paid' : formatCurrency(tx.outstanding, cur)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200">
                  <td colSpan={2} className="px-4 py-2 font-medium text-zinc-700">Total</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                    {formatCurrency(group.invoiceTotal, cur)}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-2 text-right font-mono font-semibold ${
                    group.outstanding > 0 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {group.outstanding === 0 ? 'Paid' : formatCurrency(group.outstanding, cur)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}
