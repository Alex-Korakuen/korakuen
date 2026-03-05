import { formatCurrency, formatDate } from '@/lib/formatters'

type Payment = {
  id: string
  payment_date: string
  payment_type: string
  amount: number
  currency: string
}

type Props = {
  payments: Payment[]
}

export function PaymentHistoryTable({ payments }: Props) {
  if (payments.length === 0) return null

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-700">Payment History</h3>
      <div className="overflow-x-auto rounded border border-zinc-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Currency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {payments.map((pmt) => (
              <tr key={pmt.id}>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                  {formatDate(pmt.payment_date)}
                </td>
                <td className="px-3 py-2 capitalize text-zinc-500">{pmt.payment_type}</td>
                <td className="px-3 py-2 text-right font-mono text-zinc-700">
                  {formatCurrency(pmt.amount, pmt.currency as 'PEN' | 'USD')}
                </td>
                <td className="px-3 py-2 text-zinc-500">{pmt.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
