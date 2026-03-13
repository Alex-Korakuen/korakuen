'use client'

import { formatCurrency, formatDate } from '@/lib/formatters'
import { DetailField } from '@/components/ui/detail-field'
import { StatusBadge } from '@/components/ui/status-badge'
import type { PaymentsPageRow, InvoiceDetailData, LoanDetailData } from '@/lib/types'
import { getPaymentTypeLabel, getPaymentTypeBadgeVariant } from './helpers'

type Props = {
  row: PaymentsPageRow
  relatedDetail: InvoiceDetailData | LoanDetailData | null
}

export function PaymentExpandContent({ row, relatedDetail }: Props) {
  return (
    <div className="space-y-4 px-4 py-3">
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
    </div>
  )
}
