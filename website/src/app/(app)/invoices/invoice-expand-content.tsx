'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate, formatComprobanteType, formatCategory, formatExchangeRate } from '@/lib/formatters'
import { InlineEdit } from '@/components/ui/inline-edit'
import { PaymentHistoryTable } from '@/components/ui/payment-history-table'
import { btnDangerOutline } from '@/lib/styles'
import { TrashIcon } from '@/components/ui/trash-icon'
import { updateInvoiceField, updateInvoiceItemField, addInvoiceItem, removeInvoiceItem, deactivateInvoice } from '@/lib/actions'
import { DeleteConfirmation } from '@/components/ui/delete-confirmation'
import { DetailField } from '@/components/ui/detail-field'
import { useAuth } from '@/lib/auth-context'
import type { InvoiceDetailData, InvoicesPageRow, CategoryOption } from '@/lib/types'

type Props = {
  detail: InvoiceDetailData
  row: InvoicesPageRow
  mode: 'view' | 'delete'
  onSetMode: (mode: 'view' | 'delete') => void
  onMutationSuccess: () => void
  onPaymentSuccess: () => void
  categories: CategoryOption[]
}

const COMPROBANTE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'factura', label: 'Factura' },
  { value: 'boleta', label: 'Boleta' },
  { value: 'recibo_por_honorarios', label: 'Recibo por Honorarios' },
  { value: 'liquidacion_de_compra', label: 'Liquidacion de Compra' },
  { value: 'planilla_jornales', label: 'Planilla de Jornales' },
]

// --- View Mode (with inline editing) ---
function ViewContent({ detail, row, categories, onSetMode, onPaymentSuccess }: {
  detail: InvoiceDetailData
  row: InvoicesPageRow
  categories: CategoryOption[]
  onSetMode: (mode: 'view' | 'delete') => void
  onPaymentSuccess: () => void
}) {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const invoice = detail.invoice!
  const currency = invoice.currency ?? 'PEN'
  const invoiceDetraccion = invoice.detraccion_amount ?? 0
  const invoiceRetencion = invoice.retencion_amount ?? 0
  const invoiceOutstanding = invoice.outstanding ?? 0
  const bdnOutstanding = invoice.bdn_outstanding ?? 0
  const bdnOutstandingPen = invoice.bdn_outstanding_pen ?? 0
  const retencionOutstanding = invoice.retencion_outstanding ?? 0
  const invoicePayable = invoice.payable_or_receivable ?? 0
  const direction = invoice.direction === 'receivable' ? 'inbound' as const : 'outbound' as const
  const isReceivable = invoice.direction === 'receivable'

  // Curried save handler for header fields
  const saveField = useCallback(
    (field: string) =>
      (value: string | number | null) =>
        updateInvoiceField(invoice.invoice_id!, field, value),
    [invoice.invoice_id],
  )

  // Curried save handler for line item fields
  const saveItemField = useCallback(
    (itemId: string, field: string) =>
      (value: string | number | null) =>
        updateInvoiceItemField(itemId, field, value),
    [],
  )

  // Category options for InlineEdit select
  const categoryOptions = categories.map(c => ({ value: c.name, label: c.name }))

  // Add a new line item
  async function handleAddItem() {
    const result = await addInvoiceItem(invoice.invoice_id!, { title: 'New item', subtotal: 0.01 })
    if (!result.error) router.refresh()
  }

  // Remove a line item
  async function handleRemoveItem(itemId: string) {
    const result = await removeInvoiceItem(itemId)
    if (!result.error) router.refresh()
  }

  const isPendingQuote = invoice.comprobante_type === 'pending'

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Pending quote banner */}
      {isPendingQuote && (
        <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-caution/40 bg-caution-bg px-3.5 py-2.5 text-xs text-caution">
          <span className="text-base">&#9203;</span>
          <span>Pending comprobante — you can register payments now and update the comprobante type when the factura arrives.</span>
        </div>
      )}

      {/* Header fields */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InlineEdit
          label="Partner"
          inputType="text"
          value={row.partner_name ?? '—'}
          locked
        />
        <DetailField label="Entity" value={row.entity_name ?? 'Informal'} />
        <InlineEdit
          label="Date"
          inputType="date"
          value={invoice.invoice_date}
          displayValue={invoice.invoice_date ? formatDate(invoice.invoice_date) : null}
          onSave={saveField('invoice_date')}
        />
        <InlineEdit
          label="Due Date"
          inputType="date"
          value={invoice.due_date}
          displayValue={invoice.due_date ? formatDate(invoice.due_date) : null}
          onSave={saveField('due_date')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InlineEdit
          label="Comprobante"
          inputType="select"
          value={invoice.comprobante_type}
          displayValue={formatComprobanteType(invoice.comprobante_type)}
          onSave={saveField('comprobante_type')}
          options={COMPROBANTE_OPTIONS}
        />
        <InlineEdit
          label="Invoice #"
          inputType="text"
          value={invoice.invoice_number}
          onSave={saveField('invoice_number')}
        />
        <InlineEdit
          label="Document Ref"
          inputType="text"
          value={invoice.document_ref}
          onSave={saveField('document_ref')}
        />
        {row.project_code && (
          <InlineEdit
            label="Project"
            inputType="text"
            value={row.project_code}
            locked
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InlineEdit
          label="Exchange Rate"
          inputType="number"
          value={invoice.exchange_rate}
          displayValue={formatExchangeRate(invoice.exchange_rate)}
          onSave={saveField('exchange_rate')}
          mono
          step="0.001"
          min="0"
        />
        <InlineEdit
          label="Detraccion %"
          inputType="number"
          value={invoice.detraccion_rate}
          onSave={saveField('detraccion_rate')}
          mono
          step="0.01"
          min="0"
          max="100"
        />
        {isReceivable && (
          <InlineEdit
            label="Retencion %"
            inputType="number"
            value={invoice.retencion_rate}
            onSave={saveField('retencion_rate')}
            mono
            step="0.01"
            min="0"
            max="100"
          />
        )}
      </div>

      <InlineEdit
        label="Notes"
        inputType="textarea"
        value={invoice.notes}
        placeholder="No notes"
        onSave={saveField('notes')}
      />

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-ink">Line Items</h3>
          {isAdmin && (
            <button onClick={handleAddItem} className="rounded border border-edge-strong px-2 py-0.5 text-[11px] font-medium text-muted hover:bg-surface">+ Add item</button>
          )}
        </div>
        <div className="overflow-x-auto rounded border border-edge">
          <table className="w-full text-left text-xs">
            <thead className="bg-panel text-muted">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2 text-right">Unit Price</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-1 py-1">
                    <InlineEdit
                      inputType="text"
                      value={item.title}
                      onSave={saveItemField(item.id, 'title')}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <InlineEdit
                      inputType="select"
                      value={item.category}
                      displayValue={formatCategory(item.category)}
                      onSave={saveItemField(item.id, 'category')}
                      options={categoryOptions}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <InlineEdit
                      inputType="number"
                      value={item.quantity}
                      onSave={saveItemField(item.id, 'quantity')}
                      align="right"
                      mono
                    />
                  </td>
                  <td className="px-1 py-1">
                    <InlineEdit
                      inputType="text"
                      value={item.unit_of_measure}
                      onSave={saveItemField(item.id, 'unit_of_measure')}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <InlineEdit
                      inputType="number"
                      value={item.unit_price}
                      displayValue={item.unit_price != null ? formatCurrency(item.unit_price, currency) : null}
                      onSave={saveItemField(item.id, 'unit_price')}
                      align="right"
                      mono
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink">
                    {formatCurrency(item.subtotal, currency)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {isAdmin && detail.items.length > 1 && (
                      <button onClick={() => handleRemoveItem(item.id)} className="rounded border border-negative/20 p-1 text-negative/60 transition-colors hover:bg-negative-bg hover:text-negative">
                        <TrashIcon size="xs" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="rounded border border-edge bg-panel px-4 py-3">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="font-mono text-ink">{formatCurrency(invoice.subtotal ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">IGV</span>
              <span className="font-mono text-ink">{formatCurrency(invoice.igv_amount ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-ink">Total</span>
              <span className="font-mono font-semibold text-ink">{formatCurrency(invoice.total ?? 0, currency)}</span>
            </div>
          </div>
          <div className="space-y-1">
            {invoiceDetraccion > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Detraccion</span>
                <span className="font-mono text-ink">{formatCurrency(invoiceDetraccion, currency)}</span>
              </div>
            )}
            {invoiceRetencion > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Retencion</span>
                <span className="font-mono text-ink">{formatCurrency(invoiceRetencion, currency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-medium text-muted">Paid</span>
              <span className="font-mono text-ink">{formatCurrency(invoice.amount_paid ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-muted">Outstanding</span>
              <span className="font-mono font-semibold text-negative">{formatCurrency(invoiceOutstanding, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment history + inline form */}
      <PaymentHistoryTable
        payments={detail.payments}
        paymentFormProps={
          isAdmin && invoice.invoice_id && invoiceOutstanding > 0
            ? {
                relatedTo: 'invoice',
                relatedId: invoice.invoice_id,
                direction,
                partnerId: invoice.partner_id ?? '',
                currency,
                outstanding: invoiceOutstanding,
                payable: invoicePayable,
                bdnOutstanding,
                bdnOutstandingPen,
                retencionOutstanding,
                detraccionAmount: invoiceDetraccion,
                retencionAmount: invoiceRetencion,
                onSuccess: onPaymentSuccess,
              }
            : undefined
        }
      />

      {/* Action footer */}
      {isAdmin && (
        <div className="flex items-center border-t border-edge pt-3">
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
function DeleteContent({ detail, onCancel, onSuccess }: {
  detail: InvoiceDetailData
  onCancel: () => void
  onSuccess: () => void
}) {
  const invoice = detail.invoice!
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const currency = invoice.currency ?? 'PEN'
  const paymentCount = detail.payments.length
  const paymentTotal = detail.payments.reduce((sum, p) => sum + p.amount, 0)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deactivateInvoice(invoice.invoice_id!)
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Dimmed invoice info */}
      <div className="opacity-40 pointer-events-none">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <DetailField label="Direction" value={invoice.direction === 'receivable' ? 'Receivable' : 'Payable'} />
          <DetailField label="Entity" value={invoice.entity_id ? '—' : 'Informal'} />
          <DetailField label="Invoice #" value={invoice.invoice_number ?? '—'} />
          <DetailField label="Total" value={formatCurrency(invoice.total ?? 0, currency)} />
        </div>
      </div>

      <DeleteConfirmation
        title="Deactivate this invoice?"
        message={paymentCount > 0 ? (
          <><strong>{paymentCount} related payment{paymentCount !== 1 ? 's' : ''}</strong> totaling <strong className="font-mono">{formatCurrency(paymentTotal, currency)}</strong> will be unlinked from this invoice but remain active.</>
        ) : (
          <>This invoice has no payments. It will be removed from all views and calculations.</>
        )}
        isPending={isPending}
        error={error}
        onCancel={onCancel}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

// --- Main Component ---
export function InvoiceExpandContent({ detail, row, mode, onSetMode, onMutationSuccess, onPaymentSuccess, categories }: Props) {
  if (!detail.invoice) return <p className="py-2 text-sm text-faint">No detail available.</p>

  if (mode === 'delete') {
    return (
      <DeleteContent
        detail={detail}
        onCancel={() => onSetMode('view')}
        onSuccess={onMutationSuccess}
      />
    )
  }

  return (
    <ViewContent
      detail={detail}
      row={row}
      categories={categories}
      onSetMode={onSetMode}
      onPaymentSuccess={onPaymentSuccess}
    />
  )
}
