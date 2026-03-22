'use client'

import { useState, useEffect, useTransition } from 'react'
import { registerPayment, fetchBankAccountsForPayment } from '@/lib/actions'
import type { BankAccountOption } from '@/lib/actions'
import { formatCurrency } from '@/lib/formatters'
import { inputCompactClass } from '@/lib/styles'
import { todayISO } from '@/lib/date-utils'
import { useExchangeRate } from '@/lib/use-exchange-rate'

type Props = {
  relatedTo: 'invoice' | 'loan_schedule'
  relatedId: string
  direction: 'outbound' | 'inbound'
  partnerId: string
  currency: string
  outstanding: number
  payable: number
  bdnOutstanding: number
  bdnOutstandingPen?: number
  retencionOutstanding?: number
  onSuccess: () => void
  onCancel: () => void
}

const PAYMENT_TYPES = ['regular', 'detraccion', 'retencion'] as const

export function RegisterPaymentForm({
  relatedTo,
  relatedId,
  direction,
  partnerId,
  currency,
  outstanding,
  payable,
  bdnOutstanding,
  bdnOutstandingPen,
  retencionOutstanding,
  onSuccess,
  onCancel,
}: Props) {
  const [isPending, startTransition] = useTransition()

  // Form state
  const [paymentType, setPaymentType] = useState<typeof PAYMENT_TYPES[number]>('regular')
  const [paymentDate, setPaymentDate] = useState(todayISO)
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  // Exchange rate (auto-fetched)
  const exchangeRate = useExchangeRate(paymentDate)

  // Load bank accounts on mount
  useEffect(() => {
    setLoadingAccounts(true)
    fetchBankAccountsForPayment(partnerId)
      .then(setBankAccounts)
      .catch(() => setBankAccounts([]))
      .finally(() => setLoadingAccounts(false))
  }, [partnerId])

  // Detraccion payments are always in PEN (even for USD invoices)
  const paymentCurrency = paymentType === 'detraccion' ? 'PEN' : currency

  // Filter bank accounts by payment currency and type
  const filteredAccounts = bankAccounts.filter(ba => {
    if (ba.currency !== paymentCurrency) return false
    if (paymentType === 'detraccion') return ba.is_detraccion_account
    return !ba.is_detraccion_account
  })

  // Reset bank account selection when payment type changes
  useEffect(() => {
    setBankAccountId('')
  }, [paymentType])

  // Max amount per payment type (detraccion max is always in PEN)
  const maxAmount =
    paymentType === 'detraccion'
      ? (bdnOutstandingPen ?? bdnOutstanding)
      : paymentType === 'retencion'
        ? (retencionOutstanding ?? 0)
        : payable

  const isRetencion = paymentType === 'retencion'
  const buttonLabel = direction === 'outbound' ? 'Confirm Payment' : 'Confirm Collection'

  // Filter out payment types with zero remaining
  const availableTypes = PAYMENT_TYPES.filter(t => {
    if (t === 'regular') return payable > 0
    if (t === 'detraccion') return bdnOutstanding > 0
    if (t === 'retencion') return (retencionOutstanding ?? 0) > 0
    return true
  })

  function handleSubmit() {
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid amount greater than 0')
      return
    }
    if (parsedAmount > maxAmount) {
      setError(`Amount cannot exceed ${formatCurrency(maxAmount, paymentCurrency)} for ${paymentType} payments`)
      return
    }
    if (!isRetencion && !bankAccountId) {
      setError('Select a bank account')
      return
    }
    if (exchangeRate === null) {
      setError('Exchange rate not available for this date')
      return
    }

    startTransition(async () => {
      const result = await registerPayment({
        related_to: relatedTo,
        related_id: relatedId,
        direction,
        payment_type: paymentType,
        payment_date: paymentDate,
        amount: parsedAmount,
        currency: paymentCurrency,
        exchange_rate: exchangeRate,
        partner_id: partnerId,
        bank_account_id: isRetencion ? null : bankAccountId,
        notes: null,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
        }, 800)
      }
    })
  }

  if (success) {
    return (
      <div className="rounded-[10px] border border-positive/20 bg-positive-bg px-4 py-3 text-sm text-positive">
        Payment registered successfully.
      </div>
    )
  }

  return (
    <div className="rounded-[10px] border border-accent/20 bg-accent-bg px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-accent">New Payment</span>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex h-5 w-5 items-center justify-center rounded text-accent/60 hover:bg-accent-bg hover:text-accent"
        >
          &times;
        </button>
      </div>

      {/* Fields grid */}
      <div className={`grid gap-3 ${isRetencion ? 'grid-cols-3' : 'grid-cols-4'}`}>
        {/* Amount */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-accent">
            Amount
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={maxAmount}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className={`${inputCompactClass} w-full bg-white font-mono`}
          />
          <p className="mt-0.5 text-[10px] text-accent/60">
            max {formatCurrency(maxAmount, paymentCurrency)}
          </p>
        </div>

        {/* Payment Type */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-accent">
            Type
          </label>
          <select
            value={paymentType}
            onChange={e => setPaymentType(e.target.value as typeof PAYMENT_TYPES[number])}
            className={`${inputCompactClass} w-full bg-white capitalize`}
          >
            {availableTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Bank Account (hidden for retencion) */}
        {!isRetencion && (
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-accent">
              Account
            </label>
            {loadingAccounts ? (
              <p className="py-1.5 text-xs text-accent/60">Loading...</p>
            ) : filteredAccounts.length === 0 ? (
              <p className="py-1.5 text-[10px] text-accent/60">
                No {paymentType === 'detraccion' ? 'BdN' : ''} accounts
              </p>
            ) : (
              <select
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                className={`${inputCompactClass} w-full bg-white`}
              >
                <option value="">Select...</option>
                {filteredAccounts.map(ba => (
                  <option key={ba.id} value={ba.id}>
                    {ba.label} ({ba.currency})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Date */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-accent">
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
        <p className="mt-2 text-xs font-medium text-negative">{error}</p>
      )}

      {/* Confirm button */}
      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="mt-3 w-full rounded-[10px] bg-accent py-2 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? 'Saving...' : buttonLabel}
      </button>
    </div>
  )
}
