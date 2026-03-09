import { formatCurrency, formatDate, formatComprobanteType } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { PaymentHistoryTable } from '@/components/ui/payment-history-table'
import { RegisterPaymentForm } from '@/components/ui/register-payment-form'
import type { ApCalendarRow, CostDetailData, LoanDetailData } from '@/lib/types'
import { DetailField } from '@/components/ui/detail-field'
export { DetailField }

export function CostDetailContent({
  row,
  detail,
  onPaymentSuccess,
}: {
  row: ApCalendarRow
  detail: CostDetailData
  onPaymentSuccess?: () => void
}) {
  const cost = detail.cost

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Title" value={row.title ?? '--'} />
        <DetailField label="Project" value={row.project_code ?? '--'} />
        <DetailField label="Supplier" value={row.entity_name ?? '--'} />
        <DetailField
          label="Date"
          value={cost?.date ? formatDate(cost.date) : '--'}
        />
        <DetailField
          label="Due Date"
          value={row.due_date ? formatDate(row.due_date) : '--'}
        />
        <DetailField
          label="Document Ref"
          value={detail.header?.document_ref ?? row.document_ref ?? '--'}
        />
      </div>

      {/* Comprobante info */}
      {detail.header && (
        <div className="grid grid-cols-2 gap-4">
          <DetailField
            label="Comprobante Type"
            value={formatComprobanteType(detail.header.comprobante_type)}
          />
          <DetailField
            label="Comprobante Number"
            value={detail.header.comprobante_number ?? '--'}
          />
        </div>
      )}

      {/* Cost items */}
      {detail.items.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Cost Items</h3>
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
                        ? formatCurrency(item.unit_price, (cost?.currency ?? 'PEN') as 'PEN' | 'USD')
                        : '--'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(
                        item.subtotal,
                        (cost?.currency ?? 'PEN') as 'PEN' | 'USD'
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
      {cost && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Totals</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-zinc-500">Subtotal</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(cost.subtotal ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            <span className="text-zinc-500">IGV</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(cost.igv_amount ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            <span className="text-zinc-500">Total</span>
            <span className="text-right font-mono font-semibold text-zinc-900">
              {formatCurrency(cost.total ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            {(cost.detraccion_amount ?? 0) > 0 && (
              <>
                <span className="text-zinc-500">Detraccion</span>
                <span className="text-right font-mono text-zinc-700">
                  {formatCurrency(cost.detraccion_amount ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Payment history */}
      <PaymentHistoryTable payments={detail.payments} />

      {/* Payment summary */}
      {cost && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="font-medium text-zinc-500">Total Paid</span>
          <span className="text-right font-mono text-zinc-700">
            {formatCurrency(cost.amount_paid ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
          </span>
          <span className="font-medium text-zinc-500">Outstanding</span>
          <span className="text-right font-mono font-semibold text-red-600">
            {formatCurrency(cost.outstanding ?? 0, (cost.currency ?? 'PEN') as 'PEN' | 'USD')}
          </span>
        </div>
      )}

      {/* Register payment form */}
      {cost && cost.cost_id && (cost.outstanding ?? 0) > 0 && onPaymentSuccess && (
        <RegisterPaymentForm
          relatedTo="cost"
          relatedId={cost.cost_id}
          direction="outbound"
          partnerCompanyId={cost.partner_company_id ?? ''}
          currency={cost.currency ?? 'PEN'}
          outstanding={cost.outstanding ?? 0}
          onSuccess={onPaymentSuccess}
        />
      )}
    </div>
  )
}

export function LoanDetailContent({
  row,
  detail,
}: {
  row: ApCalendarRow
  detail: LoanDetailData
}) {
  const loan = detail.loan

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Lender" value={loan?.lender_name ?? row.entity_name ?? '--'} />
        <DetailField label="Purpose" value={loan?.purpose ?? row.title ?? '--'} />
        <DetailField
          label="Date Borrowed"
          value={loan?.date_borrowed ? formatDate(loan.date_borrowed) : '--'}
        />
        <DetailField
          label="Due Date"
          value={row.due_date ? formatDate(row.due_date) : '--'}
        />
      </div>

      {/* Loan financials */}
      {loan && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Loan Summary</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-zinc-500">Principal</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(loan.principal ?? 0, (loan.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            <span className="text-zinc-500">Total Owed</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(loan.total_owed ?? 0, (loan.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            <span className="text-zinc-500">Paid</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(loan.total_paid ?? 0, (loan.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
            <span className="text-zinc-500">Outstanding</span>
            <span className="text-right font-mono font-semibold text-red-600">
              {formatCurrency(loan.outstanding ?? 0, (loan.currency ?? 'PEN') as 'PEN' | 'USD')}
            </span>
          </div>
        </div>
      )}

      {/* Repayment schedule */}
      {detail.schedule.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">
            Repayment Schedule ({loan?.paid_schedule_count ?? 0}/{loan?.scheduled_payments_count ?? 0} paid)
          </h3>
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Scheduled Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detail.schedule.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {formatDate(entry.scheduled_date)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(
                        entry.scheduled_amount,
                        (loan?.currency ?? 'PEN') as 'PEN' | 'USD'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        label={entry.paid ? 'Paid' : 'Pending'}
                        variant={entry.paid ? 'green' : 'yellow'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loan payment history */}
      {detail.payments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">Payment History</h3>
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detail.payments.map((pmt) => (
                  <tr key={pmt.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {formatDate(pmt.payment_date)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(pmt.amount, pmt.currency as 'PEN' | 'USD')}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{pmt.notes ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
