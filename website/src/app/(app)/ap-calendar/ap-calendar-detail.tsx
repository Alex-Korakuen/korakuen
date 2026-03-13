import { formatCurrency, formatDate, formatComprobanteType } from '@/lib/formatters'
import { PaymentHistoryTable } from '@/components/ui/payment-history-table'
import type { ObligationCalendarRow, InvoiceDetailData } from '@/lib/types'
import { DetailField } from '@/components/ui/detail-field'
export { DetailField }

export function InvoiceDetailContent({
  row,
  detail,
  onPaymentSuccess,
}: {
  row: ObligationCalendarRow
  detail: InvoiceDetailData
  onPaymentSuccess?: () => void
}) {
  const invoice = detail.invoice

  // Compute per-type outstanding from payment history
  const detraccionPaid = detail.payments
    .filter(p => p.payment_type === 'detraccion')
    .reduce((sum, p) => sum + p.amount, 0)
  const invoiceDetraccion = invoice?.detraccion_amount ?? 0
  const invoiceOutstanding = invoice?.outstanding ?? 0
  const bdnOutstanding = Math.max(0, invoiceDetraccion - detraccionPaid)
  const invoicePayable = Math.max(0, invoiceOutstanding - bdnOutstanding)

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Title" value={row.title ?? '--'} />
        <DetailField label="Project" value={row.project_code ?? '--'} />
        <DetailField label="Supplier" value={row.entity_name ?? '--'} />
        <DetailField
          label="Date"
          value={invoice?.invoice_date ? formatDate(invoice.invoice_date) : '--'}
        />
        <DetailField
          label="Due Date"
          value={row.due_date ? formatDate(row.due_date) : '--'}
        />
        <DetailField
          label="Document Ref"
          value={invoice?.document_ref ?? row.document_ref ?? '--'}
        />
      </div>

      {/* Comprobante info */}
      {invoice && (
        <div className="grid grid-cols-2 gap-4">
          <DetailField
            label="Comprobante Type"
            value={formatComprobanteType(invoice.comprobante_type)}
          />
          <DetailField
            label="Invoice Number"
            value={invoice.invoice_number ?? '--'}
          />
        </div>
      )}

      {/* Invoice items */}
      {detail.items.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Invoice Items</h3>
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-zinc-700">{item.title}</td>
                    <td className="px-3 py-2 text-right text-zinc-600">{item.quantity ?? '--'}</td>
                    <td className="px-3 py-2 text-zinc-500">{item.unit_of_measure ?? '--'}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-600">
                      {item.unit_price != null
                        ? formatCurrency(item.unit_price, (invoice?.currency ?? 'PEN'))
                        : '--'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(
                        item.subtotal,
                        (invoice?.currency ?? 'PEN')
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals */}
      {invoice && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Totals</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-zinc-500">Subtotal</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(invoice.subtotal ?? 0, (invoice.currency ?? 'PEN'))}
            </span>
            <span className="text-zinc-500">IGV</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(invoice.igv_amount ?? 0, (invoice.currency ?? 'PEN'))}
            </span>
            <span className="text-zinc-500">Total</span>
            <span className="text-right font-mono font-semibold text-zinc-900">
              {formatCurrency(invoice.total ?? 0, (invoice.currency ?? 'PEN'))}
            </span>
            {(invoice.detraccion_amount ?? 0) > 0 && (
              <>
                <span className="text-zinc-500">Detraccion</span>
                <span className="text-right font-mono text-zinc-700">
                  {formatCurrency(invoice.detraccion_amount ?? 0, (invoice.currency ?? 'PEN'))}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Payment history + inline form */}
      <PaymentHistoryTable
        payments={detail.payments}
        paymentFormProps={
          invoice && invoice.invoice_id && (invoice.outstanding ?? 0) > 0 && onPaymentSuccess
            ? {
                relatedTo: 'invoice',
                relatedId: invoice.invoice_id,
                direction: 'outbound',
                partnerCompanyId: invoice.partner_company_id ?? '',
                currency: invoice.currency ?? 'PEN',
                outstanding: invoiceOutstanding,
                payable: invoicePayable,
                bdnOutstanding,
                onSuccess: onPaymentSuccess,
              }
            : undefined
        }
      />

      {/* Payment summary */}
      {invoice && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="font-medium text-zinc-500">Total Paid</span>
          <span className="text-right font-mono text-zinc-700">
            {formatCurrency(invoice.amount_paid ?? 0, (invoice.currency ?? 'PEN'))}
          </span>
          <span className="font-medium text-zinc-500">Outstanding</span>
          <span className="text-right font-mono font-semibold text-red-600">
            {formatCurrency(invoice.outstanding ?? 0, (invoice.currency ?? 'PEN'))}
          </span>
        </div>
      )}
    </div>
  )
}
