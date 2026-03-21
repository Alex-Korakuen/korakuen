'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { DetailField } from '@/components/ui/detail-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { RegisterLoanRepaymentForm } from '@/components/ui/register-loan-repayment-form'
import type { LoanDetailData, Currency } from '@/lib/types'

type Props = {
  detail: LoanDetailData
  onRepaymentSuccess: () => void
}

export function LoanExpandContent({ detail, onRepaymentSuccess }: Props) {
  const loan = detail.loan
  const [showRepaymentForm, setShowRepaymentForm] = useState(false)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  if (!loan) return <p className="py-2 text-sm text-faint">No loan detail available.</p>

  const loanCurrency = (loan.currency ?? 'PEN') as Currency
  const loanOutstanding = loan.outstanding ?? 0

  function handleRegisterPayment(entryId: string) {
    setSelectedEntryId(entryId)
    setShowRepaymentForm(true)
  }

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <DetailField label="Lender" value={loan.lender_name ?? '--'} />
        <DetailField label="Purpose" value={loan.purpose ?? '--'} />
        <DetailField label="Date Borrowed" value={loan.date_borrowed ? formatDate(loan.date_borrowed) : '--'} />
        <DetailField label="Due Date" value={loan.due_date ? formatDate(loan.due_date) : '--'} />
      </div>

      {/* Loan summary */}
      <div className="rounded border border-edge bg-panel px-4 py-3">
        <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
          <span className="text-muted">Principal</span>
          <span className="text-right font-mono text-ink">{formatCurrency(loan.principal ?? 0, loanCurrency)}</span>
          <span className="text-muted">Total Owed</span>
          <span className="text-right font-mono text-ink">{formatCurrency(loan.total_owed ?? 0, loanCurrency)}</span>
          <span className="text-muted">Paid</span>
          <span className="text-right font-mono text-ink">{formatCurrency(loan.total_paid ?? 0, loanCurrency)}</span>
          <span className="font-medium text-muted">Outstanding</span>
          <span className="text-right font-mono font-semibold text-negative">{formatCurrency(loanOutstanding, loanCurrency)}</span>
        </div>
      </div>

      {/* Repayment schedule */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">
          Repayment Schedule ({loan.paid_schedule_count ?? 0}/{loan.scheduled_payments_count ?? 0} paid)
        </h3>
        {detail.schedule.length > 0 && (
          <div className="overflow-x-auto rounded border border-edge">
            <table className="w-full text-left text-xs">
              <thead className="bg-panel text-muted">
                <tr>
                  <th className="px-3 py-2">Scheduled Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {detail.schedule.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-ink">
                      {formatDate(entry.scheduled_date)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-ink">
                      {formatCurrency(entry.scheduled_amount, loanCurrency)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-ink">
                      {entry.amount_paid > 0 ? formatCurrency(entry.amount_paid, loanCurrency) : '--'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        label={entry.payment_status === 'paid' ? 'Paid' : entry.payment_status === 'partial' ? 'Partial' : 'Pending'}
                        variant={entry.payment_status === 'paid' ? 'green' : entry.payment_status === 'partial' ? 'blue' : 'yellow'}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {entry.payment_status !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => handleRegisterPayment(entry.id)}
                          className="text-xs text-accent hover:text-accent-hover"
                        >
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register repayment form */}
      {showRepaymentForm && selectedEntryId && loan.loan_id && loan.partner_company_id && (
        <RegisterLoanRepaymentForm
          loanId={loan.loan_id}
          scheduleEntryId={selectedEntryId}
          currency={loanCurrency}
          outstanding={
            detail.schedule.find(s => s.id === selectedEntryId)?.outstanding ?? 0
          }
          partnerCompanyId={loan.partner_company_id}
          onSuccess={() => {
            setShowRepaymentForm(false)
            setSelectedEntryId(null)
            onRepaymentSuccess()
          }}
          onCancel={() => {
            setShowRepaymentForm(false)
            setSelectedEntryId(null)
          }}
        />
      )}
    </div>
  )
}
