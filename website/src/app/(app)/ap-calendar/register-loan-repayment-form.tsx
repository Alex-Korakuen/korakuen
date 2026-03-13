'use client'

import { useState, useEffect, useTransition } from 'react'
import { registerLoanRepayment, fetchExchangeRateForDate } from '@/lib/actions'
import { formatCurrency } from '@/lib/formatters'
import { inputCompactClass } from '@/lib/styles'
import type { Currency } from '@/lib/types'

type Props = {
  loanId: string
  scheduleEntryId: string
  currency: Currency
  outstanding: number
  partnerCompanyId: string
  onSuccess: () => void
  onCancel: () => void
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function RegisterLoanRepaymentForm({
  loanId,
  scheduleEntryId,
  currency,
  outstanding,
  partnerCompanyId,
  onSuccess,
  onCancel,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [paymentDate, setPaymentDate] = useState(todayISO)
  const [amount, setAmount] = useState('')
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchExchangeRateForDate(paymentDate)
      .then(rate => setExchangeRate(rate?.mid_rate ?? null))
      .catch(() => setExchangeRate(null))
  }, [paymentDate])

  function handleSubmit() {
    setError(null)

    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount greater than 0')
      return
    }
    if (parsed > outstanding) {
      setError(`Amount cannot exceed outstanding balance (${formatCurrency(outstanding, currency)})`)
      return
    }
    if (exchangeRate === null) {
      setError('Exchange rate not available for this date')
      return
    }

    startTransition(async () => {
      const result = await registerLoanRepayment({
        loan_id: loanId,
        schedule_entry_id: scheduleEntryId,
        payment_date: paymentDate,
        amount: parsed,
        currency,
        exchange_rate: exchangeRate,
        partner_company_id: partnerCompanyId,
        notes: notes.trim() || undefined,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => onSuccess(), 800)
      }
    })
  }

  if (success) {
    return (
      <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Loan repayment registered successfully.
      </div>
    )
  }

  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-700">Register Repayment</h3>

      <div className="space-y-3">
        {/* Payment date */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Payment Date</label>
          <input
            type="date"
            value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            className={`${inputCompactClass} w-full`}
          />
        </div>

        {/* Amount */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Amount ({currency}) — max {formatCurrency(outstanding, currency)}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={outstanding}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className={`${inputCompactClass} w-full font-mono`}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className={`${inputCompactClass} w-full`}
            placeholder="Additional details..."
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs font-medium text-red-600">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Submit'}
          </button>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded border border-zinc-300 px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
