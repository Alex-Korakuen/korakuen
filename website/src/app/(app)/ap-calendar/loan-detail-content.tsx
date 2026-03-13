'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { DetailField } from '@/components/ui/detail-field'
import { LoanScheduleForm } from './loan-schedule-form'
import { RegisterLoanRepaymentForm } from './register-loan-repayment-form'
import type { ApCalendarRow, LoanDetailData, Currency } from '@/lib/types'

export function LoanDetailContent({
  row,
  detail,
  onRepaymentSuccess,
}: {
  row: ApCalendarRow
  detail: LoanDetailData
  onRepaymentSuccess?: () => void
}) {
  const loan = detail.loan
  const [showRepaymentForm, setShowRepaymentForm] = useState(false)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  const loanOutstanding = loan?.outstanding ?? 0
  const loanCurrency = (loan?.currency ?? 'PEN') as Currency

  // Find the current schedule entry (matching this row's due date, not fully paid)
  const currentScheduleEntry = detail.schedule.find(
    s => s.payment_status !== 'paid' && s.scheduled_date === row.due_date
  )

  function handleRegisterPayment(entryId: string) {
    setSelectedEntryId(entryId)
    setShowRepaymentForm(true)
  }

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
              {formatCurrency(loan.principal ?? 0, loanCurrency)}
            </span>
            <span className="text-zinc-500">Total Owed</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(loan.total_owed ?? 0, loanCurrency)}
            </span>
            <span className="text-zinc-500">Paid</span>
            <span className="text-right font-mono text-zinc-700">
              {formatCurrency(loan.total_paid ?? 0, loanCurrency)}
            </span>
            <span className="text-zinc-500">Outstanding</span>
            <span className="text-right font-mono font-semibold text-red-600">
              {formatCurrency(loanOutstanding, loanCurrency)}
            </span>
          </div>
        </div>
      )}

      {/* Repayment schedule */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-700">
          Repayment Schedule ({loan?.paid_schedule_count ?? 0}/{loan?.scheduled_payments_count ?? 0} paid)
        </h3>
        {detail.schedule.length > 0 && (
          <div className="mb-2 overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Scheduled Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detail.schedule.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {formatDate(entry.scheduled_date)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(entry.scheduled_amount, loanCurrency)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">
                      {entry.amount_paid > 0 ? formatCurrency(entry.amount_paid, loanCurrency) : '--'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        label={entry.payment_status === 'paid' ? 'Paid' : entry.payment_status === 'partial' ? 'Partial' : 'Pending'}
                        variant={entry.payment_status === 'paid' ? 'green' : entry.payment_status === 'partial' ? 'blue' : 'yellow'}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {entry.payment_status !== 'paid' && onRepaymentSuccess && (
                        <button
                          type="button"
                          onClick={() => handleRegisterPayment(entry.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
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
        {loan?.loan_id && onRepaymentSuccess && (
          <LoanScheduleForm
            loanId={loan.loan_id}
            onSuccess={onRepaymentSuccess}
          />
        )}
      </div>

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
                      {formatCurrency(pmt.amount, pmt.currency)}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{pmt.notes ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register repayment form */}
      {showRepaymentForm && selectedEntryId && loan && onRepaymentSuccess && (
        <RegisterLoanRepaymentForm
          loanId={loan.loan_id!}
          scheduleEntryId={selectedEntryId}
          currency={loanCurrency}
          outstanding={
            detail.schedule.find(s => s.id === selectedEntryId)?.outstanding ?? 0
          }
          partnerCompanyId={row.partner_company_id!}
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

      {/* Show register button if no form is open and there are unpaid entries */}
      {!showRepaymentForm && loan && loanOutstanding > 0 && onRepaymentSuccess && currentScheduleEntry && (
        <button
          type="button"
          onClick={() => handleRegisterPayment(currentScheduleEntry.id)}
          className="rounded bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Register Repayment
        </button>
      )}
    </div>
  )
}
