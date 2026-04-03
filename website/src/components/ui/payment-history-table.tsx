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
  relatedTo: 'invoice'
  relatedId: string
  direction: 'outbound' | 'inbound'
  partnerId: string
  currency: string
  outstanding: number
  payable: number
  bdnOutstanding: number
  bdnOutstandingPen: number
  retencionOutstanding?: number
  detraccionAmount: number
  retencionAmount: number
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
        <h3 className="text-sm font-semibold text-ink">Payment History</h3>
        {showAddButton && (
          <button
            type="button"
            onClick={() => setFormOpen(!formOpen)}
            className="flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-surface hover:text-muted"
            title={formOpen ? 'Close form' : 'Add payment'}
          >
            {formOpen ? '×' : '+'}
          </button>
        )}
        {paymentFormProps && (paymentFormProps.detraccionAmount > 0 || paymentFormProps.retencionAmount > 0) && (
          <div className="ml-auto flex gap-3 text-xs text-muted">
            <span>Regular: <span className="font-mono">{formatCurrency(paymentFormProps.payable, paymentFormProps.currency)}</span></span>
            {paymentFormProps.detraccionAmount > 0 && (
              <>
                <span className="text-edge-strong">&middot;</span>
                <span>Banco de la Nación: <span className="font-mono">{formatCurrency(paymentFormProps.bdnOutstanding, paymentFormProps.currency)}</span></span>
              </>
            )}
            {paymentFormProps.retencionAmount > 0 && (
              <>
                <span className="text-edge-strong">&middot;</span>
                <span>Ret: <span className="font-mono">{formatCurrency(paymentFormProps.retencionOutstanding ?? 0, paymentFormProps.currency)}</span></span>
              </>
            )}
          </div>
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
        <div className="overflow-x-auto rounded border border-edge">
          <table className="w-full text-left text-xs">
            <thead className="bg-panel text-faint">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Currency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {payments.map((pmt) => (
                <tr key={pmt.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">
                    {formatDate(pmt.payment_date)}
                  </td>
                  <td className="px-3 py-2 capitalize text-muted">{pmt.payment_type}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink">
                    {formatCurrency(pmt.amount, pmt.currency)}
                  </td>
                  <td className="px-3 py-2 text-muted">{pmt.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payments.length === 0 && (
        <p className="text-xs text-faint">No payments recorded yet.</p>
      )}
    </div>
  )
}
