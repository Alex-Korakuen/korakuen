import { formatCurrency, formatDate } from '@/lib/formatters'
import { Modal } from '@/components/ui/modal'
import type { ProjectTransactionGroup, Currency } from '@/lib/types'

type Props = {
  group: ProjectTransactionGroup | null
  onClose: () => void
}

export function TransactionModal({ group, onClose }: Props) {
  const cur = (group?.currency ?? 'PEN') as Currency

  return (
    <Modal
      isOpen={!!group}
      onClose={onClose}
      title={group ? `${group.projectCode} — ${group.projectName}` : ''}
    >
      {group && (
        <>
          <p className="mb-4 text-xs text-zinc-500">
            {group.transactions.length} transaction{group.transactions.length === 1 ? '' : 's'} · {group.currency}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Title</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {group.transactions.map((tx) => (
                  <tr key={tx.transaction_id} className="transition-colors hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-700">
                      {tx.date ? formatDate(tx.date) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          tx.transaction_type === 'cost'
                            ? 'bg-zinc-100 text-zinc-600'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {tx.transaction_type === 'cost' ? 'Cost' : 'AR Invoice'}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-zinc-700">
                      {tx.title ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                      {tx.amount != null ? formatCurrency(tx.amount, cur) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}
