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
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Loan repayment registered successfully.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-blue-600">New Repayment</span>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex h-5 w-5 items-center justify-center rounded text-blue-400 hover:bg-blue-100 hover:text-blue-600"
        >
          &times;
        </button>
      </div>

      {/* Fields grid — 2 columns */}
      <div className="grid grid-cols-2 gap-3">
        {/* Amount */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-blue-600">
            Amount
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={outstanding}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className={`${inputCompactClass} w-full bg-white font-mono`}
          />
          <p className="mt-0.5 text-[10px] text-blue-400">
            max {formatCurrency(outstanding, currency)}
          </p>
        </div>

        {/* Date */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-blue-600">
            Date
          </label>
          <input
            type="date"
            value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            className={`${inputCompactClass} w-full bg-white`}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
      )}

      {/* Confirm button */}
      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Confirm Repayment'}
      </button>
    </div>
  )
}
