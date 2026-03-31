'use client'

import { useState, useEffect, useTransition } from 'react'
import { registerLoanRepayment, fetchBankAccountsForPayment } from '@/lib/actions'
import type { BankAccountOption } from '@/lib/actions'
import { formatCurrency } from '@/lib/formatters'
import { inputCompactClass, formSectionLabel, formFieldLabel } from '@/lib/styles'
import { todayISO } from '@/lib/date-utils'
import { useExchangeRate } from '@/lib/use-exchange-rate'
import type { Currency } from '@/lib/types'

type Props = {
  loanId: string
  scheduleEntryId: string
  currency: Currency
  outstanding: number
  partnerId: string
  onSuccess: () => void
  onCancel: () => void
}


export function RegisterLoanRepaymentForm({
  loanId,
  scheduleEntryId,
  currency,
  outstanding,
  partnerId,
  onSuccess,
  onCancel,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [paymentDate, setPaymentDate] = useState(todayISO)
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const exchangeRate = useExchangeRate(paymentDate)

  // Fetch bank accounts for the partner, filtered to loan currency (exclude detraccion accounts)
  useEffect(() => {
    fetchBankAccountsForPayment(partnerId).then(accounts => {
      const filtered = accounts.filter(a => a.currency === currency && !a.is_detraccion_account)
      setBankAccounts(filtered)
    })
  }, [partnerId, currency])

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
        partner_id: partnerId,
        bank_account_id: bankAccountId || undefined,
        title: title.trim() || 'Pago de prestamo',
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
      <div className="rounded-[10px] border border-positive/20 bg-positive-bg px-4 py-3 text-sm text-positive">
        Loan repayment registered successfully.
      </div>
    )
  }

  return (
    <div className="rounded-[10px] border border-accent/20 bg-accent-bg px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className={formSectionLabel}>New Repayment</span>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex h-5 w-5 items-center justify-center rounded text-accent/60 hover:bg-accent-bg hover:text-accent"
        >
          &times;
        </button>
      </div>

      {/* Title */}
      <div className="mb-3">
        <label className={formFieldLabel}>Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Pago de prestamo"
          className={`${inputCompactClass} w-full bg-white`}
        />
      </div>

      {/* Fields grid — 2 columns */}
      <div className="grid grid-cols-2 gap-3">
        {/* Amount */}
        <div>
          <label className={formFieldLabel}>
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
          <p className="mt-0.5 text-[10px] text-accent/60">
            max {formatCurrency(outstanding, currency)}
          </p>
        </div>

        {/* Date */}
        <div>
          <label className={formFieldLabel}>
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

      {/* Bank Account */}
      {bankAccounts.length > 0 && (
        <div className="mt-3">
          <label className={formFieldLabel}>
            Bank Account
          </label>
          <select
            value={bankAccountId}
            onChange={e => setBankAccountId(e.target.value)}
            className={`${inputCompactClass} w-full bg-white`}
          >
            <option value="">Select account...</option>
            {bankAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs font-medium text-negative">{error}</p>
      )}

      {/* Confirm button */}
      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="mt-3 w-full rounded-[10px] bg-accent py-2 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Confirm Repayment'}
      </button>
    </div>
  )
}
