'use client'

import { formatCurrency, formatDate, formatComprobanteType } from '@/lib/formatters'
import { DetailField } from '@/components/ui/detail-field'
import { PaymentHistoryTable } from '@/components/ui/payment-history-table'
import type { InvoiceDetailData } from '@/lib/types'

type Props = {
  detail: InvoiceDetailData
  onPaymentSuccess: () => void
}

export function InvoiceExpandContent({ detail, onPaymentSuccess }: Props) {
  const invoice = detail.invoice
  if (!invoice) return <p className="py-2 text-sm text-zinc-400">No detail available.</p>

  const currency = invoice.currency ?? 'PEN'

  // Compute per-type outstanding from payment history
  const detraccionPaid = detail.payments
    .filter(p => p.payment_type === 'detraccion')
    .reduce((sum, p) => sum + p.amount, 0)
  const retencionPaid = detail.payments
    .filter(p => p.payment_type === 'retencion')
    .reduce((sum, p) => sum + p.amount, 0)
  const invoiceDetraccion = invoice.detraccion_amount ?? 0
  const invoiceRetencion = invoice.retencion_amount ?? 0
  const invoiceOutstanding = invoice.outstanding ?? 0
  const bdnOutstanding = Math.max(0, invoiceDetraccion - detraccionPaid)
  const retencionOutstanding = Math.max(0, invoiceRetencion - retencionPaid)
  const invoicePayable = Math.max(0, invoiceOutstanding - bdnOutstanding - retencionOutstanding)

  const direction = invoice.direction === 'receivable' ? 'inbound' : 'outbound'

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <DetailField label="Title" value={invoice.title ?? '--'} />
        <DetailField label="Entity" value={detail.invoice ? (invoice.entity_id ? '—' : 'Informal') : '--'} />
        <DetailField label="Date" value={invoice.invoice_date ? formatDate(invoice.invoice_date) : '--'} />
        <DetailField label="Due Date" value={invoice.due_date ? formatDate(invoice.due_date) : '--'} />
        <DetailField label="Comprobante" value={formatComprobanteType(invoice.comprobante_type)} />
        <DetailField label="Invoice #" value={invoice.invoice_number ?? '--'} />
        <DetailField label="Document Ref" value={invoice.document_ref ?? '--'} />
        <DetailField label="Payment Method" value={invoice.payment_method ?? '--'} />
      </div>

      {/* Line items */}
      {detail.items.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Line Items</h3>
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
                      {item.unit_price != null ? formatCurrency(item.unit_price, currency) : '--'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(item.subtotal, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          {/* Left column: Subtotal, IGV, Total */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-mono text-zinc-700">{formatCurrency(invoice.subtotal ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">IGV</span>
              <span className="font-mono text-zinc-700">{formatCurrency(invoice.igv_amount ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-zinc-700">Total</span>
              <span className="font-mono font-semibold text-zinc-900">{formatCurrency(invoice.total ?? 0, currency)}</span>
            </div>
          </div>
          {/* Right column: Detraccion, Retencion, Paid, Outstanding */}
          <div className="space-y-1">
            {invoiceDetraccion > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Detraccion</span>
                <span className="font-mono text-zinc-700">{formatCurrency(invoiceDetraccion, currency)}</span>
              </div>
            )}
            {invoiceRetencion > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Retencion</span>
                <span className="font-mono text-zinc-700">{formatCurrency(invoiceRetencion, currency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-medium text-zinc-500">Paid</span>
              <span className="font-mono text-zinc-700">{formatCurrency(invoice.amount_paid ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-zinc-500">Outstanding</span>
              <span className="font-mono font-semibold text-red-600">{formatCurrency(invoiceOutstanding, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment history + inline form */}
      <PaymentHistoryTable
        payments={detail.payments}
        paymentFormProps={
          invoice.invoice_id && invoiceOutstanding > 0
            ? {
                relatedTo: 'invoice',
                relatedId: invoice.invoice_id,
                direction,
                partnerCompanyId: invoice.partner_company_id ?? '',
                currency,
                outstanding: invoiceOutstanding,
                payable: invoicePayable,
                bdnOutstanding,
                retencionOutstanding,
                detraccionAmount: invoiceDetraccion,
                retencionAmount: invoiceRetencion,
                onSuccess: onPaymentSuccess,
              }
            : undefined
        }
      />
    </div>
  )
}
