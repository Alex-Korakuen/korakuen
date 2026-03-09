'use client'

import { useState, useEffect, useTransition } from 'react'
import { registerPayment, fetchBankAccountsForPayment, fetchExchangeRateForDate } from '@/lib/actions'
import type { BankAccountOption } from '@/lib/actions'
import { formatCurrency } from '@/lib/formatters'
import { inputCompactClass } from '@/lib/styles'

type Props = {
  relatedTo: 'cost' | 'ar_invoice'
  relatedId: string
  direction: 'outbound' | 'inbound'
  partnerCompanyId: string
  currency: string
  outstanding: number
  onSuccess: () => void
  onCancel: () => void
}

const PAYMENT_TYPES = ['regular', 'detraccion', 'retencion'] as const

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function RegisterPaymentForm({
  relatedTo,
  relatedId,
  direction,
  partnerCompanyId,
  currency,
  outstanding,
  onSuccess,
  onCancel,
}: Props) {
  const [isPending, startTransition] = useTransition()

  // Form state
  const [paymentType, setPaymentType] = useState<typeof PAYMENT_TYPES[number]>('regular')
  const [paymentDate, setPaymentDate] = useState(todayISO)
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  // Exchange rate (auto-fetched)
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)

  // Load bank accounts on mount
  useEffect(() => {
    setLoadingAccounts(true)
    fetchBankAccountsForPayment(partnerCompanyId)
      .then(setBankAccounts)
      .catch(() => setBankAccounts([]))
      .finally(() => setLoadingAccounts(false))
  }, [partnerCompanyId])

  // Auto-fetch exchange rate when payment date changes
  useEffect(() => {
    fetchExchangeRateForDate(paymentDate)
      .then(rate => setExchangeRate(rate?.mid_rate ?? null))
      .catch(() => setExchangeRate(null))
  }, [paymentDate])

  // Filter bank accounts by payment type
  const filteredAccounts = bankAccounts.filter(ba => {
    if (paymentType === 'detraccion') return ba.is_detraccion_account
    return !ba.is_detraccion_account
  })

  // Reset bank account selection when payment type changes
  useEffect(() => {
    setBankAccountId('')
  }, [paymentType])

  const isRetencion = paymentType === 'retencion'
  const buttonLabel = relatedTo === 'cost' ? 'Register Payment' : 'Register Collection'

  function handleSubmit() {
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid amount greater than 0')
      return
    }
    if (parsedAmount > outstanding) {
      setError(`Amount cannot exceed outstanding balance (${formatCurrency(outstanding, currency as 'PEN' | 'USD')})`)
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
        currency,
        exchange_rate: exchangeRate,
        partner_company_id: partnerCompanyId,
        bank_account_id: isRetencion ? null : bankAccountId,
        notes: notes.trim() || null,
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
      <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Payment registered successfully.
      </div>
    )
  }

  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-700">{buttonLabel}</h3>

      <div className="space-y-3">
        {/* Payment type */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Payment Type</label>
          <select
            value={paymentType}
            onChange={e => setPaymentType(e.target.value as typeof PAYMENT_TYPES[number])}
            className={`${inputCompactClass} w-full`}
          >
            {PAYMENT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

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
            Amount ({currency}) — max {formatCurrency(outstanding, currency as 'PEN' | 'USD')}
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

        {/* Bank account (hidden for retencion) */}
        {!isRetencion && (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Bank Account</label>
            {loadingAccounts ? (
              <p className="text-xs text-zinc-400">Loading accounts...</p>
            ) : filteredAccounts.length === 0 ? (
              <p className="text-xs text-zinc-400">
                No {paymentType === 'detraccion' ? 'detraccion' : 'regular'} accounts found for this partner
              </p>
            ) : (
              <select
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                className={`${inputCompactClass} w-full`}
              >
                <option value="">Select account...</option>
                {filteredAccounts.map(ba => (
                  <option key={ba.id} value={ba.id}>
                    {ba.label} — {ba.bank_name} ({ba.currency})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {isRetencion && (
          <p className="text-xs text-zinc-400">
            No bank account — retencion is withheld by client and paid to SUNAT.
          </p>
        )}

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className={`${inputCompactClass} w-full`}
            placeholder="Transfer reference, check number, etc."
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
