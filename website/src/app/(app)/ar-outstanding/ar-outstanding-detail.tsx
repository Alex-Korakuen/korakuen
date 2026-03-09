import { formatCurrency, formatDate } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { PaymentHistoryTable } from '@/components/ui/payment-history-table'
import type { ArOutstandingRow, ArInvoiceDetailData } from '@/lib/types'
import { DetailField } from '@/components/ui/detail-field'
export { DetailField }

export function InvoiceDetailContent({
  row,
  detail,
  onPaymentSuccess,
}: {
  row: ArOutstandingRow
  detail: ArInvoiceDetailData
  onPaymentSuccess?: () => void
}) {
  const invoice = detail.invoice
  const cur = (row.currency ?? 'PEN')

  // Compute per-type outstanding from payment history
  const detraccionPaid = detail.payments
    .filter(p => p.payment_type === 'detraccion')
    .reduce((sum, p) => sum + p.amount, 0)
  const retencionPaid = detail.payments
    .filter(p => p.payment_type === 'retencion')
    .reduce((sum, p) => sum + p.amount, 0)
  const bdnOutstanding = Math.max(0, row.detraccion_amount - detraccionPaid)
  const retencionOutstanding = Math.max(0, row.retencion_amount - retencionPaid)
  const arPayable = Math.max(0, row.outstanding - bdnOutstanding - retencionOutstanding)

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Invoice#" value={row.invoice_number ?? '--'} />
        <DetailField label="Project" value={detail.project_code} />
        <DetailField label="Client" value={detail.client_name} />
        <DetailField label="Partner" value={detail.partner_name} />
        <DetailField
          label="Invoice Date"
          value={row.invoice_date ? formatDate(row.invoice_date) : '--'}
        />
        <DetailField
          label="Due Date"
          value={row.due_date ? formatDate(row.due_date) : '--'}
        />
      </div>

      {/* Financial breakdown */}
      {invoice && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Breakdown</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-zinc-500">Subtotal</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(invoice.subtotal ?? 0, cur)}
            </span>
            <span className="text-zinc-500">IGV ({invoice.igv_rate ?? 18}%)</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(invoice.igv_amount ?? 0, cur)}
            </span>
            <span className="text-zinc-500">Gross Total</span>
            <span className="text-right font-mono font-semibold text-zinc-900">
              {formatCurrency(invoice.gross_total ?? 0, cur)}
            </span>
            {(invoice.detraccion_amount ?? 0) > 0 && (
              <>
                <span className="text-zinc-500">Detraccion ({invoice.detraccion_rate ?? 0}%)</span>
                <span className="text-right font-mono text-zinc-700">
                  -{formatCurrency(invoice.detraccion_amount ?? 0, cur)}
                </span>
              </>
            )}
            {(invoice.retencion_amount ?? 0) > 0 && (
              <>
                <span className="text-zinc-500">Retencion ({invoice.retencion_rate ?? 0}%)</span>
                <span className="text-right font-mono text-zinc-700">
                  -{formatCurrency(invoice.retencion_amount ?? 0, cur)}
                </span>
              </>
            )}
            <span className="font-medium text-zinc-700">Net Receivable</span>
            <span className="text-right font-mono font-semibold text-zinc-900">
              {formatCurrency(invoice.net_receivable ?? 0, cur)}
            </span>
          </div>
        </div>
      )}

      {/* Payment history + inline form */}
      <PaymentHistoryTable
        payments={detail.payments}
        paymentFormProps={
          row.outstanding > 0 && row.partner_company_id && onPaymentSuccess
            ? {
                relatedTo: 'ar_invoice',
                relatedId: row.ar_invoice_id,
                direction: 'inbound',
                partnerCompanyId: row.partner_company_id,
                currency: row.currency,
                outstanding: row.outstanding,
                payable: arPayable,
                bdnOutstanding,
                retencionOutstanding,
                onSuccess: onPaymentSuccess,
              }
            : undefined
        }
      />

      {/* Payment summary */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className="font-medium text-zinc-500">Total Paid</span>
        <span className="text-right font-mono text-zinc-700">
          {formatCurrency(row.amount_paid, cur)}
        </span>
        <span className="font-medium text-zinc-500">Outstanding</span>
        <span className="text-right font-mono font-semibold text-red-600">
          {formatCurrency(row.outstanding, cur)}
        </span>
      </div>

      {/* Retencion status */}
      {invoice?.retencion_applicable && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Retencion verification:</span>
            <StatusBadge
              label={invoice.retencion_verified ? 'Verified' : 'Unverified'}
              variant={invoice.retencion_verified ? 'green' : 'yellow'}
            />
          </div>
        </div>
      )}
    </div>
  )
}
