'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Modal } from '@/components/ui/modal'
import { SectionCard } from '@/components/ui/section-card'
import { LoanDetailContent } from '@/components/ui/loan-detail-content'

const CreateBankAccountModal = dynamic(() => import('./create-bank-account-modal').then(m => ({ default: m.CreateBankAccountModal })))
const CreateLoanModal = dynamic(() => import('./create-loan-modal').then(m => ({ default: m.CreateLoanModal })))
import { fetchBankTransactions, fetchLoanDetailById } from '@/lib/actions'
import type { BankTransaction, FinancialPositionData, LoanDetailData, PartnerCompanyOption } from '@/lib/types'

type Props = {
  data: FinancialPositionData
  partnerCompanies: PartnerCompanyOption[]
  projects: { id: string; project_code: string; name: string }[]
}

function fmt(amount: number, currency: string) {
  return formatCurrency(amount, currency)
}

export function FPClient({ data, partnerCompanies, projects }: Props) {
  const router = useRouter()
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [showCreateLoan, setShowCreateLoan] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<{
    bankAccountId: string
    bankName: string | null
    last4: string | null
  } | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loadingTxns, setLoadingTxns] = useState(false)

  // Loan detail modal state
  const [selectedLoan, setSelectedLoan] = useState<{
    loanId: string
    lenderName: string
  } | null>(null)
  const [loanDetail, setLoanDetail] = useState<LoanDetailData | null>(null)
  const [loadingLoan, setLoadingLoan] = useState(false)

  const handleAccountClick = async (ba: FinancialPositionData['bankAccounts'][0]) => {
    setSelectedAccount({
      bankAccountId: ba.bankAccountId,
      bankName: ba.bankName,
      last4: ba.accountNumberLast4,
    })
    setLoadingTxns(true)
    try {
      const txns = await fetchBankTransactions(ba.bankAccountId)
      setTransactions(txns)
    } catch {
      setTransactions([])
    } finally {
      setLoadingTxns(false)
    }
  }

  const handleLoanClick = async (loan: FinancialPositionData['loans'][0]) => {
    setSelectedLoan({ loanId: loan.loanId, lenderName: loan.lenderName })
    setLoadingLoan(true)
    try {
      const detail = await fetchLoanDetailById(loan.loanId)
      setLoanDetail(detail)
    } catch {
      setLoanDetail(null)
    } finally {
      setLoadingLoan(false)
    }
  }

  const handleLoanRefresh = async () => {
    if (!selectedLoan) return
    try {
      const detail = await fetchLoanDetailById(selectedLoan.loanId)
      setLoanDetail(detail)
    } catch {
      // keep existing detail
    }
  }

  return (
    <div className="space-y-6">

      {/* CASH */}
      <SectionCard title="Cash">
        <div className="divide-y divide-edge">
          {data.bankAccounts.map((ba) => (
            <div
              key={ba.bankAccountId}
              className="flex cursor-pointer items-center justify-between px-6 py-3 transition-colors hover:bg-accent-bg"
              onClick={() => handleAccountClick(ba)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink">
                  {ba.bankName} ···{ba.accountNumberLast4}
                </span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-muted">
                  {ba.currency}
                </span>
                {ba.isDetractionAccount && (
                  <span className="rounded bg-caution-bg px-1.5 py-0.5 text-xs font-medium text-caution">
                    Tax only
                  </span>
                )}
              </div>
              <span className={`text-sm font-medium ${
                ba.balance >= 0 ? 'text-ink' : 'text-negative'
              }`}>
                {fmt(ba.balance, ba.currency ?? 'PEN')}
              </span>
            </div>
          ))}
          {data.bankAccounts.length === 0 && (
            <p className="px-6 py-4 text-sm text-faint">No bank accounts</p>
          )}
          <div className="border-t border-edge px-6 py-2">
            <button
              type="button"
              onClick={() => setShowCreateAccount(true)}
              className="text-xs text-accent transition-colors hover:text-accent-hover"
            >
              + Add account
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ACCOUNTS RECEIVABLE */}
      <SectionCard title="Accounts Receivable">
        <div
          className="cursor-pointer px-6 py-4 transition-colors hover:bg-accent-bg"
          onClick={() => router.push('/invoices?direction=receivable')}
        >
          {data.arOutstanding.length === 0 ? (
            <p className="text-sm text-faint">No outstanding invoices</p>
          ) : (
            <div className="space-y-1">
              {data.arOutstanding.map((item) => (
                <div key={item.currency} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted">Outstanding</span>
                  <span className="text-sm font-semibold text-ink">
                    {fmt(item.amount, item.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ACCOUNTS PAYABLE */}
      <SectionCard title="Accounts Payable">
        <div
          className="cursor-pointer px-6 py-4 transition-colors hover:bg-accent-bg"
          onClick={() => router.push('/invoices?direction=payable')}
        >
          {data.apOutstanding.length === 0 ? (
            <p className="text-sm text-faint">No outstanding costs</p>
          ) : (
            <div className="space-y-1">
              {data.apOutstanding.map((item) => (
                <div key={item.currency} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted">Outstanding</span>
                  <span className="text-sm font-semibold text-ink">
                    {fmt(item.amount, item.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* LOANS */}
      <SectionCard title="Loans">
        <div className="divide-y divide-edge">
          {data.loans.map((loan) => (
            <div
              key={loan.loanId}
              className="flex cursor-pointer items-center justify-between px-6 py-3 transition-colors hover:bg-accent-bg"
              onClick={() => handleLoanClick(loan)}
            >
              <span className="text-sm text-ink">{loan.lenderName}</span>
              <span className="text-sm font-medium text-ink">
                {fmt(loan.outstanding, loan.currency)}
              </span>
            </div>
          ))}
          {data.loans.length === 0 && (
            <p className="px-6 py-4 text-sm text-faint">No loans</p>
          )}
          <div className="border-t border-edge px-6 py-2">
            <button
              type="button"
              onClick={() => setShowCreateLoan(true)}
              className="text-xs text-accent transition-colors hover:text-accent-hover"
            >
              + Add loan
            </button>
          </div>
        </div>
      </SectionCard>

      {/* SEPARATOR — Tax position is derived from the same invoices/costs above */}
      {(data.igv.length > 0 || data.retencionesUnverified.length > 0) && (
        <>
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-edge" />
            <span className="text-xs font-medium uppercase tracking-wider text-faint">Tax Position</span>
            <div className="h-px flex-1 bg-edge" />
          </div>

          {/* IGV */}
          {data.igv.length > 0 && (
            <SectionCard title="IGV">
              <div className="px-6 py-4">
                <div className="space-y-3">
                  {data.igv.map((row) => (
                    <div key={row.currency} className="space-y-1">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted">IGV paid (crédito fiscal)</span>
                        <span className="text-sm font-medium text-ink">
                          {fmt(row.igvPaid, row.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted">IGV collected (débito fiscal)</span>
                        <span className="text-sm font-medium text-ink">
                          {fmt(row.igvCollected, row.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-edge pt-1">
                        <span className="text-sm font-medium text-muted">
                          Net {row.net >= 0 ? '(crédito)' : '(débito)'}
                        </span>
                        <span className={`text-sm font-semibold ${
                          row.net >= 0 ? 'text-positive' : 'text-negative'
                        }`}>
                          {fmt(Math.abs(row.net), row.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}

          {/* Retenciones */}
          {data.retencionesUnverified.length > 0 && (
            <SectionCard title="Retenciones">
              <div className="px-6 py-4">
                <p className="mb-2 text-xs text-faint">Withheld by clients, pending SUNAT verification</p>
                <div className="space-y-1">
                  {data.retencionesUnverified.map((item) => (
                    <div key={item.currency} className="flex items-center justify-between py-1">
                      <span className="text-sm text-muted">Unverified</span>
                      <span className="text-sm font-medium text-ink">
                        {fmt(item.amount, item.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Disclaimer */}
      <p className="text-center text-xs text-faint">
        Balances are system-calculated, not bank-reconciled.
      </p>

      {/* Bank Transaction Modal */}
      <Modal
        isOpen={selectedAccount !== null}
        onClose={() => setSelectedAccount(null)}
        title={`${selectedAccount?.bankName ?? ''} ···${selectedAccount?.last4 ?? ''} — Transactions`}
      >
        {loadingTxns ? (
          <p className="py-8 text-center text-sm text-muted">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-xs uppercase text-faint">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="transition-colors hover:bg-accent-bg">
                    <td className="whitespace-nowrap px-3 py-2 text-muted">
                      {formatDate(txn.paymentDate)}
                    </td>
                    <td className="px-3 py-2 text-ink">
                      {txn.entityName ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {txn.projectCode ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {txn.description ?? '—'}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-medium ${
                      txn.direction === 'inbound' ? 'text-positive' : 'text-negative'
                    }`}>
                      {txn.direction === 'inbound' ? '+' : '−'}
                      {fmt(txn.amount, txn.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Loan Detail Modal */}
      <Modal
        isOpen={selectedLoan !== null}
        onClose={() => { setSelectedLoan(null); setLoanDetail(null) }}
        title={`Loan — ${selectedLoan?.lenderName ?? ''}`}
      >
        {loadingLoan && (
          <p className="py-8 text-center text-sm text-muted">Loading loan detail...</p>
        )}
        {!loadingLoan && loanDetail && (
          <LoanDetailContent
            detail={loanDetail}
            onRepaymentSuccess={handleLoanRefresh}
          />
        )}
        {!loadingLoan && !loanDetail && selectedLoan && (
          <p className="py-8 text-center text-sm text-muted">Could not load loan detail.</p>
        )}
      </Modal>

      {/* Create Bank Account Modal */}
      <CreateBankAccountModal
        isOpen={showCreateAccount}
        onClose={() => setShowCreateAccount(false)}
        partnerCompanies={partnerCompanies}
      />

      {/* Create Loan Modal */}
      <CreateLoanModal
        isOpen={showCreateLoan}
        onClose={() => setShowCreateLoan(false)}
        partnerCompanies={partnerCompanies}
        projects={projects}
      />
    </div>
  )
}
