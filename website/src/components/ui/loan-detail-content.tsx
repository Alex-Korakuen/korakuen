'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { LoanScheduleTable } from '@/components/ui/loan-schedule-table'
import { DetailField } from '@/components/ui/detail-field'
import { LoanScheduleForm } from '@/components/ui/loan-schedule-form'
import { RegisterLoanRepaymentForm } from '@/components/ui/register-loan-repayment-form'
import type { LoanDetailData, Currency } from '@/lib/types'
import { btnPrimaryLg } from '@/lib/styles'
import { NotesDisplay } from '@/components/ui/notes-display'

export function LoanDetailContent({
  detail,
  onRepaymentSuccess,
}: {
  detail: LoanDetailData
  onRepaymentSuccess?: () => void
}) {
  const loan = detail.loan
  const [showRepaymentForm, setShowRepaymentForm] = useState(false)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  const loanOutstanding = loan?.outstanding ?? 0
  const loanCurrency = (loan?.currency ?? 'PEN') as Currency

  // Find the first unpaid schedule entry
  const currentScheduleEntry = detail.schedule.find(
    s => s.payment_status !== 'paid'
  )

  function handleRegisterPayment(entryId: string) {
    setSelectedEntryId(entryId)
    setShowRepaymentForm(true)
  }

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Lender" value={loan?.lender_name ?? '--'} />
        <DetailField label="Purpose" value={loan?.purpose ?? '--'} />
        <DetailField
          label="Date Borrowed"
          value={loan?.date_borrowed ? formatDate(loan.date_borrowed) : '--'}
        />
        <DetailField
          label="Due Date"
          value={loan?.due_date ? formatDate(loan.due_date) : '--'}
        />
      </div>

      {/* Loan financials */}
      {loan && (
        <div className="rounded border border-edge bg-panel px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-ink">Loan Summary</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted">Principal</span>
            <span className="text-right font-mono text-ink">
              {formatCurrency(loan.principal ?? 0, loanCurrency)}
            </span>
            <span className="text-muted">Total Owed</span>
            <span className="text-right font-mono text-ink">
              {formatCurrency(loan.total_owed ?? 0, loanCurrency)}
            </span>
            <span className="text-muted">Paid</span>
            <span className="text-right font-mono text-ink">
              {formatCurrency(loan.total_paid ?? 0, loanCurrency)}
            </span>
            <span className="text-muted">Outstanding</span>
            <span className="text-right font-mono font-semibold text-negative">
              {formatCurrency(loanOutstanding, loanCurrency)}
            </span>
          </div>
        </div>
      )}

      {/* Repayment schedule */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">
          Repayment Schedule ({loan?.paid_schedule_count ?? 0}/{loan?.scheduled_payments_count ?? 0} paid)
        </h3>
        <LoanScheduleTable
          schedule={detail.schedule}
          currency={loanCurrency}
          onPayClick={onRepaymentSuccess ? handleRegisterPayment : undefined}
          className="mb-2"
        />
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
          <h3 className="mb-2 text-sm font-semibold text-ink">Payment History</h3>
          <div className="overflow-x-auto rounded border border-edge">
            <table className="w-full text-left text-xs">
              <thead className="bg-panel text-muted">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {detail.payments.map((pmt) => (
                  <tr key={pmt.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-ink">
                      {formatDate(pmt.payment_date)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-ink">
                      {formatCurrency(pmt.amount, pmt.currency)}
                    </td>
                    <td className="px-3 py-2 text-muted">{pmt.notes ? <NotesDisplay notes={pmt.notes} /> : '--'}</td>
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
          partnerId={loan.partner_id!}
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
          className={`${btnPrimaryLg}`}
        >
          Register Repayment
        </button>
      )}
    </div>
  )
}
