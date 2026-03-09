'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Modal } from '@/components/ui/modal'
import { SectionCard } from '@/components/ui/section-card'
import { CreateBankAccountModal } from './create-bank-account-modal'
import { CreateLoanModal } from './create-loan-modal'
import { fetchBankTransactions } from '@/lib/actions'
import type { BankTransaction, FinancialPositionData } from '@/lib/types'
import type { PartnerCompanyOption } from '@/lib/queries'

type Props = {
  data: FinancialPositionData
  partnerCompanies: PartnerCompanyOption[]
  projects: { id: string; project_code: string; name: string }[]
}

function fmt(amount: number, currency: string) {
  return formatCurrency(amount, currency)
}

export function FPClient({ data, partnerCompanies, projects }: Props) {
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [showCreateLoan, setShowCreateLoan] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<{
    bankAccountId: string
    bankName: string | null
    last4: string | null
  } | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loadingTxns, setLoadingTxns] = useState(false)

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

  return (
    <div className="space-y-6">

      {/* CASH */}
      <SectionCard title="Cash">
        <div className="divide-y divide-zinc-100">
          {data.bankAccounts.map((ba) => (
            <div
              key={ba.bankAccountId}
              className="flex cursor-pointer items-center justify-between px-6 py-3 transition-colors hover:bg-blue-50"
              onClick={() => handleAccountClick(ba)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-700">
                  {ba.bankName} ···{ba.accountNumberLast4}
                </span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                  {ba.currency}
                </span>
                {ba.isDetractionAccount && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                    Tax only
                  </span>
                )}
              </div>
              <span className={`text-sm font-medium ${
                ba.balance >= 0 ? 'text-zinc-800' : 'text-red-600'
              }`}>
                {fmt(ba.balance, ba.currency ?? 'PEN')}
              </span>
            </div>
          ))}
          {data.bankAccounts.length === 0 && (
            <p className="px-6 py-4 text-sm text-zinc-400">No bank accounts</p>
          )}
          <div className="border-t border-zinc-100 px-6 py-2">
            <button
              type="button"
              onClick={() => setShowCreateAccount(true)}
              className="text-xs text-blue-600 transition-colors hover:text-blue-800"
            >
              + Add account
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ACCOUNTS RECEIVABLE */}
      <SectionCard title="Accounts Receivable">
        <div className="px-6 py-4">
          {data.arOutstanding.length === 0 ? (
            <p className="text-sm text-zinc-400">No outstanding invoices</p>
          ) : (
            <div className="space-y-1">
              {data.arOutstanding.map((item) => (
                <div key={item.currency} className="flex items-center justify-between py-1">
                  <span className="text-sm text-zinc-600">Outstanding</span>
                  <span className="text-sm font-semibold text-zinc-800">
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
        <div className="px-6 py-4">
          {data.apOutstanding.length === 0 ? (
            <p className="text-sm text-zinc-400">No outstanding costs</p>
          ) : (
            <div className="space-y-1">
              {data.apOutstanding.map((item) => (
                <div key={item.currency} className="flex items-center justify-between py-1">
                  <span className="text-sm text-zinc-600">Outstanding</span>
                  <span className="text-sm font-semibold text-zinc-800">
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
        <div className="divide-y divide-zinc-100">
          {data.loans.map((loan) => (
            <div key={loan.loanId} className="flex items-center justify-between px-6 py-3">
              <span className="text-sm text-zinc-700">{loan.lenderName}</span>
              <span className="text-sm font-medium text-zinc-800">
                {fmt(loan.outstanding, loan.currency)}
              </span>
            </div>
          ))}
          {data.loans.length === 0 && (
            <p className="px-6 py-4 text-sm text-zinc-400">No loans</p>
          )}
          <div className="border-t border-zinc-100 px-6 py-2">
            <button
              type="button"
              onClick={() => setShowCreateLoan(true)}
              className="text-xs text-blue-600 transition-colors hover:text-blue-800"
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
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Tax Position</span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          {/* IGV */}
          {data.igv.length > 0 && (
            <SectionCard title="IGV">
              <div className="px-6 py-4">
                <div className="space-y-3">
                  {data.igv.map((row) => (
                    <div key={row.currency} className="space-y-1">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-zinc-500">IGV paid (crédito fiscal)</span>
                        <span className="text-sm font-medium text-zinc-800">
                          {fmt(row.igvPaid, row.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-zinc-500">IGV collected (débito fiscal)</span>
                        <span className="text-sm font-medium text-zinc-800">
                          {fmt(row.igvCollected, row.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-zinc-100 pt-1">
                        <span className="text-sm font-medium text-zinc-600">
                          Net {row.net >= 0 ? '(crédito)' : '(débito)'}
                        </span>
                        <span className={`text-sm font-semibold ${
                          row.net >= 0 ? 'text-emerald-700' : 'text-red-600'
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
                <p className="mb-2 text-xs text-zinc-400">Withheld by clients, pending SUNAT verification</p>
                <div className="space-y-1">
                  {data.retencionesUnverified.map((item) => (
                    <div key={item.currency} className="flex items-center justify-between py-1">
                      <span className="text-sm text-zinc-600">Unverified</span>
                      <span className="text-sm font-medium text-zinc-800">
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
      <p className="text-center text-xs text-zinc-400">
        Balances are system-calculated, not bank-reconciled.
      </p>

      {/* Bank Transaction Modal */}
      <Modal
        isOpen={selectedAccount !== null}
        onClose={() => setSelectedAccount(null)}
        title={`${selectedAccount?.bankName ?? ''} ···${selectedAccount?.last4 ?? ''} — Transactions`}
      >
        {loadingTxns ? (
          <p className="py-8 text-center text-sm text-zinc-500">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="transition-colors hover:bg-blue-50">
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                      {formatDate(txn.paymentDate)}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {txn.entityName ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {txn.projectCode ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {txn.description ?? '—'}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-medium ${
                      txn.direction === 'inbound' ? 'text-emerald-600' : 'text-red-600'
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
