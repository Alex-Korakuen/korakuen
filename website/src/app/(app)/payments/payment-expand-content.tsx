'use client'

import { useState, useEffect, useTransition } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { DetailField } from '@/components/ui/detail-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { inputCompactClass, btnDangerOutline, btnPrimaryLg, iconPencil, iconTrash } from '@/lib/styles'
import { updatePayment, deactivatePayment, fetchExchangeRateForDate } from '@/lib/actions'
import { LockIcon } from '@/components/ui/lock-icon'
import { DeleteConfirmation } from '@/components/ui/delete-confirmation'
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
          <span className="mb-1 block text-xs font-medium text-faint">Type</span>
          <StatusBadge label={getPaymentTypeLabel(row.payment_type)} variant={getPaymentTypeBadgeVariant(row.payment_type)} />
        </div>
        <DetailField label="Bank Account" value={row.bank_name ?? '--'} />
      </div>

      <div className="rounded border border-edge bg-panel px-4 py-3">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-medium text-ink">Amount</span>
              <span className="font-mono font-semibold text-ink">{formatCurrency(row.amount, row.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Exchange Rate</span>
              <span className="font-mono text-ink">{row.exchange_rate?.toFixed(3) ?? '--'}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Related To</span>
              <span className="text-ink">{row.related_to === 'loan' ? 'Loan Disbursement' : row.related_to === 'loan_schedule' ? 'Loan Repayment' : 'Invoice'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Invoice #</span>
              <span className="font-mono text-ink">{row.invoice_number ?? '--'}</span>
            </div>
          </div>
        </div>
        {row.notes && (
          <div className="mt-2 border-t border-edge pt-2">
            <span className="text-xs text-faint">Notes:</span>
            <p className="text-sm text-muted">{row.notes}</p>
          </div>
        )}
      </div>

      {/* Related invoice/loan summary */}
      {relatedDetail && row.related_to === 'invoice' && 'invoice' in relatedDetail && relatedDetail.invoice && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Related Invoice</h3>
          <div className="grid grid-cols-2 gap-4 rounded border border-edge px-4 py-3 text-sm sm:grid-cols-4">
            <DetailField label="Title" value={relatedDetail.invoice.title ?? '--'} />
            <DetailField label="Invoice #" value={relatedDetail.invoice.invoice_number ?? '--'} />
            <DetailField label="Total" value={formatCurrency(relatedDetail.invoice.total ?? 0, relatedDetail.invoice.currency ?? 'PEN')} />
            <DetailField label="Outstanding" value={formatCurrency(relatedDetail.invoice.outstanding ?? 0, relatedDetail.invoice.currency ?? 'PEN')} />
          </div>
        </div>
      )}

      {relatedDetail && (row.related_to === 'loan_schedule' || row.related_to === 'loan') && 'loan' in relatedDetail && relatedDetail.loan && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Related Loan</h3>
          <div className="grid grid-cols-2 gap-4 rounded border border-edge px-4 py-3 text-sm sm:grid-cols-4">
            <DetailField label="Lender" value={relatedDetail.loan.lender_name ?? '--'} />
            <DetailField label="Purpose" value={relatedDetail.loan.purpose ?? '--'} />
            <DetailField label="Total Owed" value={formatCurrency(relatedDetail.loan.total_owed ?? 0, (relatedDetail.loan.currency ?? 'PEN') as 'PEN' | 'USD')} />
            <DetailField label="Outstanding" value={formatCurrency(relatedDetail.loan.outstanding ?? 0, (relatedDetail.loan.currency ?? 'PEN') as 'PEN' | 'USD')} />
          </div>
        </div>
      )}

      {/* Action footer */}
      <div className="flex items-center justify-between border-t border-edge pt-3">
        <button
          onClick={() => onSetMode('delete')}
          className={`${btnDangerOutline}`}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d={iconTrash} clipRule="evenodd" /></svg>
          Delete
        </button>
        <button
          onClick={() => onSetMode('edit')}
          className={`inline-flex items-center gap-1.5 rounded-md ${btnPrimaryLg} transition-colors`}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d={iconPencil} /></svg>
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
          <span className="block text-[11px] font-medium text-faint mb-1">Direction <LockIcon /></span>
          <span className="text-sm text-muted">{row.direction === 'inbound' ? 'Inbound' : 'Outbound'}</span>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-faint mb-1">Type <LockIcon /></span>
          <StatusBadge label={getPaymentTypeLabel(row.payment_type)} variant={getPaymentTypeBadgeVariant(row.payment_type)} />
        </div>
        <div>
          <span className="block text-[11px] font-medium text-faint mb-1">Currency <LockIcon /></span>
          <span className="text-sm text-muted">{paymentCurrency}</span>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-faint mb-1">Related <LockIcon /></span>
          <span className="text-sm text-muted">
            {(row.related_to === 'loan_schedule' || row.related_to === 'loan') ? 'Loan' : row.invoice_number ?? 'Invoice'}
          </span>
        </div>
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-muted mb-1">Date</label>
          <input
            type="date"
            value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            className={`${inputCompactClass} w-full bg-white`}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-muted mb-1">Amount</label>
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
            <label className="block text-[11px] font-medium text-muted mb-1">Bank Account</label>
            {filteredAccounts.length === 0 ? (
              <p className="py-1.5 text-xs text-faint">No matching accounts</p>
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
          <label className="block text-[11px] font-medium text-muted mb-1">Exchange Rate</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={exchangeRate}
            onChange={e => setExchangeRate(e.target.value)}
            className={`${inputCompactClass} w-full bg-white font-mono`}
          />
          <span className="text-[10px] text-faint mt-0.5 block">Auto-fetched on date change</span>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-muted mb-1">Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className={`${inputCompactClass} w-full bg-white resize-none`}
          placeholder="Optional notes..."
        />
      </div>

      {error && (
        <p className="text-xs font-medium text-negative">{error}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-edge pt-3">
        <button
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-edge-strong px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
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
            <span className="mb-1 block text-xs font-medium text-faint">Type</span>
            <StatusBadge label={getPaymentTypeLabel(row.payment_type)} variant={getPaymentTypeBadgeVariant(row.payment_type)} />
          </div>
          <DetailField label="Amount" value={formatCurrency(row.amount, row.currency)} />
        </div>
      </div>

      <DeleteConfirmation
        title="Deactivate this payment?"
        message={<>
          The {(row.related_to === 'loan_schedule' || row.related_to === 'loan') ? 'loan' : 'invoice'} outstanding
          balance will increase by <span className="font-mono font-semibold">{formatCurrency(row.amount, row.currency)}</span>.
        </>}
        isPending={isPending}
        error={error}
        onCancel={onCancel}
        onConfirm={handleConfirm}
      />
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
