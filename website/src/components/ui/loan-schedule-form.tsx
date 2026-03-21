'use client'

import { useState, useTransition } from 'react'
import { addLoanScheduleEntry } from '@/lib/actions'
import { inputCompactClass, btnPrimary } from '@/lib/styles'
import { todayISO } from '@/lib/date-utils'
import { useExchangeRate } from '@/lib/use-exchange-rate'

type Props = {
  loanId: string
  onSuccess: () => void
}

export function LoanScheduleForm({ loanId, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [scheduledDate, setScheduledDate] = useState(todayISO)
  const [scheduledAmount, setScheduledAmount] = useState('')
  // Auto-fetch rate, but allow manual override via the input
  const autoRate = useExchangeRate(scheduledDate, isOpen)
  const [manualRate, setManualRate] = useState<number | null>(null)
  const exchangeRate = manualRate ?? autoRate

  function resetForm() {
    setScheduledDate(todayISO())
    setScheduledAmount('')
    setManualRate(null)
    setError(null)
  }

  function handleSubmit() {
    const parsed = parseFloat(scheduledAmount)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (exchangeRate === null) {
      setError('Exchange rate not available')
      return
    }
    setError(null)

    startTransition(async () => {
      const result = await addLoanScheduleEntry({
        loan_id: loanId,
        scheduled_date: scheduledDate,
        scheduled_amount: parsed,
        exchange_rate: exchangeRate,
      })

      if (result.error) {
        setError(result.error)
      } else {
        resetForm()
        setIsOpen(false)
        onSuccess()
      }
    })
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs text-accent transition-colors hover:text-accent-hover"
      >
        + Add scheduled payment
      </button>
    )
  }

  return (
    <div className="rounded border border-edge bg-panel px-4 py-3">
      <h4 className="mb-2 text-xs font-semibold text-muted">Add Scheduled Payment</h4>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted">Date</label>
          <input
            type="date"
            value={scheduledDate}
            onChange={e => setScheduledDate(e.target.value)}
            className={`${inputCompactClass} w-full`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={scheduledAmount}
            onChange={e => setScheduledAmount(e.target.value)}
            placeholder="0.00"
            className={`${inputCompactClass} w-full font-mono`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Exchange Rate</label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={exchangeRate ?? ''}
            onChange={e => setManualRate(parseFloat(e.target.value) || null)}
            className={`${inputCompactClass} w-full font-mono`}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-negative">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className={`${btnPrimary} text-xs disabled:opacity-50`}
        >
          {isPending ? 'Saving...' : 'Add'}
        </button>
        <button
          onClick={() => { resetForm(); setIsOpen(false) }}
          disabled={isPending}
          className="rounded border border-edge-strong px-3 py-1 text-xs text-muted hover:bg-surface disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
