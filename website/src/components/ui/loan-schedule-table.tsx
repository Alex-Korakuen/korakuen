import { formatCurrency, formatDate } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import type { LoanDetailData, Currency } from '@/lib/types'

type Props = {
  schedule: LoanDetailData['schedule']
  currency: Currency
  onPayClick?: (entryId: string) => void
  className?: string
}

export function LoanScheduleTable({ schedule, currency, onPayClick, className }: Props) {
  if (schedule.length === 0) return null

  return (
    <div className={`overflow-x-auto rounded border border-edge${className ? ` ${className}` : ''}`}>
      <table className="w-full text-left text-xs">
        <thead className="bg-panel text-muted">
          <tr>
            <th className="px-3 py-2">Scheduled Date</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-right">Paid</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {schedule.map((entry) => (
            <tr key={entry.id}>
              <td className="whitespace-nowrap px-3 py-2 text-ink">
                {formatDate(entry.scheduled_date)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-ink">
                {formatCurrency(entry.scheduled_amount, currency)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-ink">
                {entry.amount_paid > 0 ? formatCurrency(entry.amount_paid, currency) : '—'}
              </td>
              <td className="px-3 py-2">
                <StatusBadge
                  label={entry.payment_status === 'paid' ? 'Paid' : entry.payment_status === 'partial' ? 'Partial' : 'Pending'}
                  variant={entry.payment_status === 'paid' ? 'green' : entry.payment_status === 'partial' ? 'blue' : 'yellow'}
                />
              </td>
              <td className="px-3 py-2">
                {entry.payment_status !== 'paid' && onPayClick && (
                  <button
                    type="button"
                    onClick={() => onPayClick(entry.id)}
                    className="text-xs text-accent hover:text-accent-hover"
                  >
                    Pay
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
