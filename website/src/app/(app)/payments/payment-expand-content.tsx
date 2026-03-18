'use client'

import { useState, useEffect, useTransition } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { DetailField } from '@/components/ui/detail-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { inputCompactClass } from '@/lib/styles'
import { updatePayment, deactivatePayment, fetchExchangeRateForDate } from '@/lib/actions'
import type { BankAccountOption } from '@/lib/actions'
import type { PaymentsPageRow, InvoiceDetailData, LoanDetailData } from '@/lib/types'
import { getPaymentTypeLabel, getPaymentTypeBadgeVariant } from './helpers'

type Props = {
  row: PaymentsPageRow
  relatedDetail: InvoiceDetailData | LoanDetailData | null
  mode: 'view' | 'edit' | 'delete'
  onSetMode: (mode: 'view' | 'edit' | 'delete') => void
  onMutationSuccess: () => void
  bankAccounts: BankAccountOption[]
}

// --- Lock icon ---
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="inline-block text-zinc-300 ml-1">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
  )
}

// --- View Mode ---
function ViewContent({ row, relatedDetail, onSetMode }: {
  row: PaymentsPageRow
  relatedDetail: InvoiceDetailData | LoanDetailData | null
  onSetMode: (mode: 'view' | 'edit' | 'delete') => void
}) {
  return (
    <div className="space-y-4">
      {/* Payment info */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <DetailField label="Date" value={row.payment_date ? formatDate(row.payment_date) : '--'} />
        <DetailField label="Direction" value={row.direction === 'inbound' ? 'Inbound' : 'Outbound'} />
        <div>
          <span className="mb-1 block text-xs font-medium text-zinc-400">Type</span>
          <StatusBadge label={getPaymentTypeLabel(row.payment_type)} variant={getPaymentTypeBadgeVariant(row.payment_type)} />
        </div>
        <DetailField label="Bank Account" value={row.bank_name ?? '--'} />
      </div>

      <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-medium text-zinc-700">Amount</span>
              <span className="font-mono font-semibold text-zinc-900">{formatCurrency(row.amount, row.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Exchange Rate</span>
              <span className="font-mono text-zinc-700">{row.exchange_rate?.toFixed(3) ?? '--'}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500">Related To</span>
              <span className="text-zinc-700">{row.related_to === 'loan_schedule' ? 'Loan Repayment' : 'Invoice'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Invoice #</span>
              <span className="font-mono text-zinc-700">{row.invoice_number ?? '--'}</span>
            </div>
          </div>
        </div>
        {row.notes && (
          <div className="mt-2 border-t border-zinc-200 pt-2">
            <span className="text-xs text-zinc-400">Notes:</span>
            <p className="text-sm text-zinc-600">{row.notes}</p>
          </div>
        )}
      </div>

      {/* Related invoice/loan summary */}
      {relatedDetail && row.related_to === 'invoice' && 'invoice' in relatedDetail && relatedDetail.invoice && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Related Invoice</h3>
          <div className="grid grid-cols-2 gap-4 rounded border border-zinc-200 px-4 py-3 text-sm sm:grid-cols-4">
            <DetailField label="Title" value={relatedDetail.invoice.title ?? '--'} />
            <DetailField label="Invoice #" value={relatedDetail.invoice.invoice_number ?? '--'} />
            <DetailField label="Total" value={formatCurrency(relatedDetail.invoice.total ?? 0, relatedDetail.invoice.currency ?? 'PEN')} />
            <DetailField label="Outstanding" value={formatCurrency(relatedDetail.invoice.outstanding ?? 0, relatedDetail.invoice.currency ?? 'PEN')} />
          </div>
        </div>
      )}

      {relatedDetail && row.related_to === 'loan_schedule' && 'loan' in relatedDetail && relatedDetail.loan && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Related Loan</h3>
          <div className="grid grid-cols-2 gap-4 rounded border border-zinc-200 px-4 py-3 text-sm sm:grid-cols-4">
            <DetailField label="Lender" value={relatedDetail.loan.lender_name ?? '--'} />
            <DetailField label="Purpose" value={relatedDetail.loan.purpose ?? '--'} />
            <DetailField label="Total Owed" value={formatCurrency(relatedDetail.loan.total_owed ?? 0, (relatedDetail.loan.currency ?? 'PEN') as 'PEN' | 'USD')} />
            <DetailField label="Outstanding" value={formatCurrency(relatedDetail.loan.outstanding ?? 0, (relatedDetail.loan.currency ?? 'PEN') as 'PEN' | 'USD')} />
          </div>
        </div>
      )}

      {/* Action footer */}
      <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
        <button
          onClick={() => onSetMode('delete')}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg>
          Delete
        </button>
        <button
          onClick={() => onSetMode('edit')}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>
          Edit
        </button>
      </div>
    </div>
  )
}

// --- Edit Mode ---
function EditContent({ row, bankAccounts, onCancel, onSuccess }: {
  row: PaymentsPageRow
  bankAccounts: BankAccountOption[]
  onCancel: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const [paymentDate, setPaymentDate] = useState(row.payment_date)
  const [amount, setAmount] = useState(row.amount.toString())
  const [bankAccountId, setBankAccountId] = useState(row.bank_account_id ?? '')
  const [exchangeRate, setExchangeRate] = useState(row.exchange_rate?.toString() ?? '')
  const [notes, setNotes] = useState(row.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const isRetencion = row.payment_type === 'retencion'
  const paymentCurrency = row.payment_type === 'detraccion' ? 'PEN' : row.currency

  // Filter bank accounts by payment currency and type
  const filteredAccounts = bankAccounts.filter(ba => {
    if (ba.currency !== paymentCurrency) return false
    if (row.payment_type === 'detraccion') return ba.is_detraccion_account
    return !ba.is_detraccion_account
  })

  // Auto-fetch exchange rate when date changes (only if date differs from original)
  useEffect(() => {
    if (paymentDate !== row.payment_date) {
      fetchExchangeRateForDate(paymentDate)
        .then(rate => {
          if (rate?.mid_rate) setExchangeRate(rate.mid_rate.toString())
        })
        .catch(() => {})
    }
  }, [paymentDate, row.payment_date])

  function handleSubmit() {
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid amount greater than 0')
      return
    }
    if (!isRetencion && !bankAccountId) {
      setError('Select a bank account')
      return
    }
    const parsedRate = parseFloat(exchangeRate)
    if (isNaN(parsedRate) || parsedRate <= 0) {
      setError('Enter a valid exchange rate')
      return
    }

    startTransition(async () => {
      const result = await updatePayment({
        id: row.id,
        payment_date: paymentDate,
        amount: parsedAmount,
        exchange_rate: parsedRate,
        bank_account_id: isRetencion ? null : bankAccountId,
        notes: notes.trim() || null,
      })

      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Locked fields row */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <span className="block text-[11px] font-medium text-zinc-400 mb-1">Direction <LockIcon /></span>
          <span className="text-sm text-zinc-500">{row.direction === 'inbound' ? 'Inbound' : 'Outbound'}</span>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-zinc-400 mb-1">Type <LockIcon /></span>
          <StatusBadge label={getPaymentTypeLabel(row.payment_type)} variant={getPaymentTypeBadgeVariant(row.payment_type)} />
        </div>
        <div>
          <span className="block text-[11px] font-medium text-zinc-400 mb-1">Currency <LockIcon /></span>
          <span className="text-sm text-zinc-500">{paymentCurrency}</span>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-zinc-400 mb-1">Related <LockIcon /></span>
          <span className="text-sm text-zinc-500">
            {row.related_to === 'loan_schedule' ? 'Loan' : row.invoice_number ?? 'Invoice'}
          </span>
        </div>
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Date</label>
          <input
            type="date"
            value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            className={`${inputCompactClass} w-full bg-white`}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className={`${inputCompactClass} w-full bg-white font-mono text-right`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {!isRetencion && (
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-1">Bank Account</label>
            {filteredAccounts.length === 0 ? (
              <p className="py-1.5 text-xs text-zinc-400">No matching accounts</p>
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
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Exchange Rate</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={exchangeRate}
            onChange={e => setExchangeRate(e.target.value)}
            className={`${inputCompactClass} w-full bg-white font-mono`}
          />
          <span className="text-[10px] text-zinc-400 mt-0.5 block">Auto-fetched on date change</span>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-zinc-500 mb-1">Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className={`${inputCompactClass} w-full bg-white resize-none`}
          placeholder="Optional notes..."
        />
      </div>

      {error && (
        <p className="text-xs font-medium text-red-600">{error}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
        <button
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// --- Delete Confirmation ---
function DeleteContent({ row, onCancel, onSuccess }: {
  row: PaymentsPageRow
  onCancel: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deactivatePayment(row.id)
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Dimmed payment info */}
      <div className="opacity-40 pointer-events-none">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <DetailField label="Date" value={row.payment_date ? formatDate(row.payment_date) : '--'} />
          <DetailField label="Direction" value={row.direction === 'inbound' ? 'Inbound' : 'Outbound'} />
          <div>
            <span className="mb-1 block text-xs font-medium text-zinc-400">Type</span>
            <StatusBadge label={getPaymentTypeLabel(row.payment_type)} variant={getPaymentTypeBadgeVariant(row.payment_type)} />
          </div>
          <DetailField label="Amount" value={formatCurrency(row.amount, row.currency)} />
        </div>
      </div>

      {/* Confirmation box */}
      <div className="rounded-lg border-2 border-red-200 bg-red-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 rounded-full bg-red-100 p-1.5">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-red-500">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800">Deactivate this payment?</h4>
            <p className="text-sm text-red-700 mt-1">
              The {row.related_to === 'loan_schedule' ? 'loan schedule' : 'invoice'} outstanding
              balance will increase by <span className="font-mono font-semibold">{formatCurrency(row.amount, row.currency)}</span>.
            </p>
            <p className="text-xs text-red-500 mt-2">This action can be reversed by an administrator.</p>

            {error && (
              <p className="text-xs font-medium text-red-800 mt-2">{error}</p>
            )}

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={onCancel}
                disabled={isPending}
                className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? 'Deactivating...' : 'Yes, deactivate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---
export function PaymentExpandContent({ row, relatedDetail, mode, onSetMode, onMutationSuccess, bankAccounts }: Props) {
  if (mode === 'edit') {
    return (
      <EditContent
        row={row}
        bankAccounts={bankAccounts}
        onCancel={() => onSetMode('view')}
        onSuccess={onMutationSuccess}
      />
    )
  }

  if (mode === 'delete') {
    return (
      <DeleteContent
        row={row}
        onCancel={() => onSetMode('view')}
        onSuccess={onMutationSuccess}
      />
    )
  }

  return (
    <ViewContent
      row={row}
      relatedDetail={relatedDetail}
      onSetMode={onSetMode}
    />
  )
}
