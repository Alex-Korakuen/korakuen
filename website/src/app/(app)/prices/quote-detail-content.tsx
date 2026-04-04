'use client'

import { useState, useTransition } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { DetailField } from '@/components/ui/detail-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { DeleteConfirmation } from '@/components/ui/delete-confirmation'
import { acceptQuote, rejectQuote, deactivateInvoice } from '@/lib/actions'
import { btnPrimary, btnDangerOutline, btnSecondarySm } from '@/lib/styles'
import { TrashIcon } from '@/components/ui/trash-icon'
import type { InvoiceDetailData } from '@/lib/types'

type Props = {
  detail: InvoiceDetailData
  entityName: string
  projectCode: string
  onMutationSuccess: () => void
}

export function QuoteDetailContent({ detail, entityName, projectCode, onMutationSuccess }: Props) {
  const invoice = detail.invoice
  if (!invoice) return <p className="py-2 text-sm text-faint">No detail available.</p>

  const [mode, setMode] = useState<'view' | 'delete'>('view')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const currency = invoice.currency ?? 'PEN'
  const status = invoice.quote_status ?? 'pending'

  function handleAction(action: () => Promise<{ error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        setError(result.error)
      } else {
        onMutationSuccess()
      }
    })
  }

  if (mode === 'delete') {
    return (
      <div className="space-y-4 px-4 py-3">
        <DeleteConfirmation
          title="Delete this quote?"
          message="This quote and its line items will be deactivated. Price references will no longer appear."
          isPending={isPending}
          error={error}
          onCancel={() => setMode('view')}
          onConfirm={() => handleAction(() => deactivateInvoice(invoice.invoice_id!))}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <DetailField label="Supplier" value={entityName || '—'} />
        <DetailField label="Project" value={projectCode || '—'} />
        <DetailField label="Date" value={invoice.invoice_date ? formatDate(invoice.invoice_date) : '—'} />
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-faint">Status</span>
          <div className="mt-0.5">
            {status === 'accepted' && <StatusBadge label="Accepted" variant="green" />}
            {status === 'rejected' && <StatusBadge label="Rejected" variant="red" />}
            {status === 'pending' && <StatusBadge label="Pending" variant="blue" />}
          </div>
        </div>
      </div>

      {invoice.notes && (
        <DetailField label="Notes" value={invoice.notes} />
      )}

      {/* Line items */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Quote Items</h3>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-ink">{item.title ?? '—'}</td>
                  <td className="px-3 py-2 text-muted">{item.category ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-muted">{item.quantity ?? '—'}</td>
                  <td className="px-3 py-2 text-muted">{item.unit_of_measure ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink">
                    {item.unit_price != null ? formatCurrency(item.unit_price, currency) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink">
                    {formatCurrency(item.subtotal, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total */}
      <div className="flex justify-end text-sm">
        <div className="flex gap-4">
          <span className="font-medium text-muted">Subtotal</span>
          <span className="font-mono font-semibold text-ink">
            {formatCurrency(invoice.subtotal ?? 0, currency)}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-xs font-medium text-negative">{error}</p>}

      {/* Action footer */}
      <div className="flex items-center justify-between border-t border-edge pt-3">
        <button
          onClick={() => setMode('delete')}
          disabled={isPending}
          className={btnDangerOutline}
        >
          <TrashIcon size="sm" />
          Delete
        </button>

        <div className="flex items-center gap-2">
          {(status === 'pending' || status === 'accepted') && (
            <button
              onClick={() => handleAction(() => rejectQuote(invoice.invoice_id!))}
              disabled={isPending}
              className={btnSecondarySm}
            >
              {isPending ? '...' : 'Reject'}
            </button>
          )}
          {(status === 'pending' || status === 'rejected') && (
            <button
              onClick={() => handleAction(() => acceptQuote(invoice.invoice_id!))}
              disabled={isPending}
              className={btnPrimary}
            >
              {isPending ? '...' : status === 'rejected' ? 'Revive' : 'Accept'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
