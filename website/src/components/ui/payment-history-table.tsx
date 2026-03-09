'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { RegisterPaymentForm } from './register-payment-form'

type Payment = {
  id: string
  payment_date: string
  payment_type: string
  amount: number
  currency: string
}

type PaymentFormProps = {
  relatedTo: 'cost' | 'ar_invoice'
  relatedId: string
  direction: 'outbound' | 'inbound'
  partnerCompanyId: string
  currency: string
  outstanding: number
  payable: number
  bdnOutstanding: number
  retencionOutstanding?: number
  onSuccess: () => void
}

type Props = {
  payments: Payment[]
  paymentFormProps?: PaymentFormProps
}

export function PaymentHistoryTable({ payments, paymentFormProps }: Props) {
  const [formOpen, setFormOpen] = useState(false)

  const showAddButton = paymentFormProps && paymentFormProps.outstanding > 0

  // Hide entire section only when no payments AND no form capability
  if (payments.length === 0 && !paymentFormProps) return null

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-700">Payment History</h3>
        {showAddButton && (
          <button
            type="button"
            onClick={() => setFormOpen(!formOpen)}
            className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            title={formOpen ? 'Close form' : 'Add payment'}
          >
            {formOpen ? '×' : '+'}
          </button>
        )}
      </div>

      {/* Inline payment form */}
      {formOpen && paymentFormProps && (
        <div className="mb-3">
          <RegisterPaymentForm
            {...paymentFormProps}
            onCancel={() => setFormOpen(false)}
            onSuccess={() => {
              setFormOpen(false)
              paymentFormProps.onSuccess()
            }}
          />
        </div>
      )}

      {/* Payment table */}
      {payments.length > 0 && (
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
                    {formatCurrency(pmt.amount, pmt.currency)}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{pmt.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payments.length === 0 && (
        <p className="text-xs text-zinc-400">No payments recorded yet.</p>
      )}
    </div>
  )
}
