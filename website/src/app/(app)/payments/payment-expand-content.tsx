'use client'

import { useState, useCallback, useTransition } from 'react'
import { formatCurrency, formatDate, formatExchangeRate } from '@/lib/formatters'
import { DetailField } from '@/components/ui/detail-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { InlineEdit } from '@/components/ui/inline-edit'
import { btnDangerOutline } from '@/lib/styles'
import { TrashIcon } from '@/components/ui/trash-icon'
import { updatePaymentField, deactivatePayment, promotePhantomInvoice } from '@/lib/actions'
import { DeleteConfirmation } from '@/components/ui/delete-confirmation'
import { useAuth } from '@/lib/auth-context'
import type { BankAccountOption } from '@/lib/actions'
import type { PaymentsPageRow, InvoiceDetailData, LoanDetailData } from '@/lib/types'
import { getPaymentTypeLabel, getPaymentTypeBadgeVariant } from './helpers'

type Props = {
  row: PaymentsPageRow
  relatedDetail: InvoiceDetailData | LoanDetailData | null
  mode: 'view' | 'delete'
  onSetMode: (mode: 'view' | 'delete') => void
  onMutationSuccess: () => void
  bankAccounts: BankAccountOption[]
}

// --- View Mode (with inline editing) ---
function PhantomInvoiceSection({ invoiceId, onPromoted }: { invoiceId: string; onPromoted: () => void }) {
  const { isAdmin } = useAuth()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handlePromote() {
    setError(null)
    startTransition(async () => {
      const result = await promotePhantomInvoice(invoiceId)
      if (result.error) setError(result.error)
      else onPromoted()
    })
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">Related Invoice</h3>
      <div className="flex items-center gap-3 rounded border border-edge px-4 py-3 text-sm">
        <span className="text-muted">None</span>
        {isAdmin && (
          <button
            onClick={handlePromote}
            disabled={isPending}
            className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
          >
            {isPending ? 'Linking...' : 'Link to Invoice'}
          </button>
        )}
        {error && <span className="text-xs text-negative">{error}</span>}
      </div>
    </div>
  )
}

function ViewContent({ row, relatedDetail, onSetMode, onMutationSuccess, bankAccounts }: {
  row: PaymentsPageRow
  relatedDetail: InvoiceDetailData | LoanDetailData | null
  onSetMode: (mode: 'view' | 'delete') => void
  onMutationSuccess: () => void
  bankAccounts: BankAccountOption[]
}) {
  const { isAdmin } = useAuth()
  const paymentCurrency = row.payment_type === 'detraccion' ? 'PEN' : row.currency

  // Filter bank accounts by currency and payment type
  const filteredAccounts = bankAccounts.filter(ba => {
    if (ba.currency !== paymentCurrency) return false
    if (row.payment_type === 'detraccion') return ba.is_detraccion_account
    return !ba.is_detraccion_account
  })
  const bankOptions = filteredAccounts.map(ba => ({
    value: ba.id,
    label: `${ba.label} (${ba.currency})`,
  }))

  // Curried save handler
  const saveField = useCallback(
    (field: string) =>
      (value: string | number | null) =>
        updatePaymentField(row.id, field, value),
    [row.id],
  )

  const isRetencion = row.payment_type === 'retencion'

  return (
    <div className="space-y-4">
      {/* Row 1: Title + Operation # + Date */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={isRetencion ? 'sm:col-span-3' : 'sm:col-span-2'}>
          <InlineEdit
            label="Title"
            inputType="text"
            value={row.title}
            placeholder="No title"
            onSave={saveField('title')}
          />
        </div>
        {!isRetencion && (
          <InlineEdit
            label="Operation #"
            inputType="text"
            value={row.operation_number}
            placeholder="—"
            onSave={saveField('operation_number')}
            mono
          />
        )}
        <InlineEdit
          label="Date"
          inputType="date"
          value={row.payment_date}
          displayValue={row.payment_date ? formatDate(row.payment_date) : '—'}
          onSave={saveField('payment_date')}
        />
      </div>

      {/* Row 2: Bank Account + Exchange Rate */}
      <div className="grid grid-cols-2 gap-4">
        {isRetencion ? (
          <InlineEdit
            label="Bank Account"
            inputType="text"
            value="N/A"
            locked
          />
        ) : (
          <InlineEdit
            label="Bank Account"
            inputType="select"
            value={row.bank_account_id}
            displayValue={row.bank_label ?? '—'}
            onSave={saveField('bank_account_id')}
            options={bankOptions}
          />
        )}
        <InlineEdit
          label="Exchange Rate"
          inputType="number"
          value={row.exchange_rate}
          displayValue={formatExchangeRate(row.exchange_rate)}
          onSave={saveField('exchange_rate')}
          mono
          step="0.001"
          min="0"
        />
      </div>

      {/* Row 3: Financial summary panel */}
      <div className="rounded border border-edge bg-panel px-4 py-3">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <InlineEdit
            label="Amount"
            inputType="number"
            value={row.amount}
            displayValue={formatCurrency(row.amount, row.currency)}
            onSave={saveField('amount')}
            align="right"
            mono
            step="0.01"
            min="0"
          />
          <div>
            <span className="mb-1 block text-[11px] font-medium text-faint">Related To</span>
            <span className="text-sm text-ink">{row.related_to === 'loan' ? 'Loan Disbursement' : row.related_to === 'loan_schedule' ? 'Loan Repayment' : 'Invoice'}</span>
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-medium text-faint">Invoice #</span>
            <span className="text-sm font-mono text-ink">{row.invoice_number ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Row 4: Notes */}
      <InlineEdit
        label="Notes"
        inputType="textarea"
        value={row.notes}
        placeholder="No notes"
        onSave={saveField('notes')}
      />

      {/* Related invoice/loan summary */}
      {relatedDetail && row.related_to === 'invoice' && 'invoice' in relatedDetail && relatedDetail.invoice && (
        relatedDetail.invoice.comprobante_type === 'none' ? (
          <PhantomInvoiceSection invoiceId={row.related_id!} onPromoted={onMutationSuccess} />
        ) : (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Related Invoice</h3>
            <div className="grid grid-cols-2 gap-4 rounded border border-edge px-4 py-3 text-sm sm:grid-cols-4">
              <DetailField label="Title" value={relatedDetail.invoice.title ?? '—'} />
              <DetailField label="Invoice #" value={relatedDetail.invoice.invoice_number ?? '—'} />
              <DetailField label="Total" value={formatCurrency(relatedDetail.invoice.total ?? 0, relatedDetail.invoice.currency ?? 'PEN')} />
              <DetailField label="Outstanding" value={formatCurrency(relatedDetail.invoice.outstanding ?? 0, relatedDetail.invoice.currency ?? 'PEN')} />
            </div>
          </div>
        )
      )}

      {relatedDetail && (row.related_to === 'loan_schedule' || row.related_to === 'loan') && 'loan' in relatedDetail && relatedDetail.loan && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Related Loan</h3>
          <div className="grid grid-cols-2 gap-4 rounded border border-edge px-4 py-3 text-sm sm:grid-cols-4">
            <DetailField label="Lender" value={relatedDetail.loan.lender_name ?? '—'} />
            <DetailField label="Purpose" value={relatedDetail.loan.purpose ?? '—'} />
            <DetailField label="Total Owed" value={formatCurrency(relatedDetail.loan.total_owed ?? 0, (relatedDetail.loan.currency ?? 'PEN') as 'PEN' | 'USD')} />
            <DetailField label="Outstanding" value={formatCurrency(relatedDetail.loan.outstanding ?? 0, (relatedDetail.loan.currency ?? 'PEN') as 'PEN' | 'USD')} />
          </div>
        </div>
      )}

      {/* Action footer */}
      {isAdmin && (
        <div className="flex items-center justify-start border-t border-edge pt-3">
          <button
            onClick={() => onSetMode('delete')}
            className={`${btnDangerOutline}`}
          >
            <TrashIcon size="sm" />
            Delete
          </button>
        </div>
      )}
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
          <DetailField label="Date" value={row.payment_date ? formatDate(row.payment_date) : '—'} />
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
      onMutationSuccess={onMutationSuccess}
      bankAccounts={bankAccounts}
    />
  )
}
