import { formatCurrency, formatDate } from '@/lib/formatters'
import type { ArOutstandingRow, ArInvoiceDetailData } from '@/lib/types'
import { DetailField } from '@/components/ui/detail-field'
export { DetailField }

export function InvoiceDetailContent({
  row,
  detail,
}: {
  row: ArOutstandingRow
  detail: ArInvoiceDetailData
}) {
  const invoice = detail.invoice
  const cur = (row.currency ?? 'PEN') as 'PEN' | 'USD'

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

      {/* Payment history */}
      {detail.payments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Payment History</h3>
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Currency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detail.payments.map((pmt) => (
                  <tr key={pmt.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {formatDate(pmt.payment_date)}
                    </td>
                    <td className="px-3 py-2 capitalize text-zinc-500">{pmt.payment_type}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(pmt.amount, pmt.currency as 'PEN' | 'USD')}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{pmt.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                invoice.retencion_verified
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {invoice.retencion_verified ? 'Verified' : 'Unverified'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
