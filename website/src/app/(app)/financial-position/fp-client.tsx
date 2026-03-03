'use client'

import { useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { Modal } from '@/components/ui/modal'
import { fetchBankTransactions } from './actions'
import type { BankTransaction, Currency, FinancialPositionData } from '@/lib/types'

type Props = {
  data: FinancialPositionData
  isAlex: boolean
  currency: Currency
  onCurrencyChange: (currency: Currency) => void
}

const DEFAULT_RATE = 3.70

function convertForDisplay(
  amount: number,
  fromCurrency: string | null,
  toCurrency: Currency
): { value: number; converted: boolean } {
  if (!fromCurrency || fromCurrency === toCurrency) return { value: amount, converted: false }
  if (toCurrency === 'PEN' && fromCurrency === 'USD') return { value: amount * DEFAULT_RATE, converted: true }
  if (toCurrency === 'USD' && fromCurrency === 'PEN') return { value: amount / DEFAULT_RATE, converted: true }
  return { value: amount, converted: false }
}

function Amount({
  value,
  currency,
  converted,
  negative,
}: {
  value: number
  currency: Currency
  converted?: boolean
  negative?: boolean
}) {
  const display = negative ? -Math.abs(value) : value
  return (
    <span className={converted ? 'text-zinc-400' : ''}>
      {formatCurrency(display, currency)}
      {converted && ' *'}
    </span>
  )
}

export function FPClient({ data, isAlex, currency, onCurrencyChange }: Props) {
  const [selectedAccount, setSelectedAccount] = useState<{
    bankAccountId: string
    bankName: string | null
    last4: string | null
  } | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loadingTxns, setLoadingTxns] = useState(false)

  // Group bank accounts by partner
  const accountsByPartner = useMemo(() => {
    const map = new Map<string, typeof data.bankAccounts>()
    for (const ba of data.bankAccounts) {
      const key = ba.partnerName ?? 'Unknown'
      const arr = map.get(key) ?? []
      arr.push(ba)
      map.set(key, arr)
    }
    return map
  }, [data.bankAccounts])

  const handleAccountClick = async (ba: typeof data.bankAccounts[0]) => {
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

  // Total cash in reporting currency
  const totalCash = useMemo(() => {
    return data.bankAccounts.reduce((sum, ba) => {
      const { value } = convertForDisplay(ba.balance, ba.currency, currency)
      return sum + value
    }, 0)
  }, [data.bankAccounts, currency])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-800">Financial Position</h1>
          <p className="mt-1 text-sm text-zinc-500">Point-in-time balance sheet snapshot</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Currency:</span>
          <div className="inline-flex rounded-md border border-zinc-200">
            {(['PEN', 'USD'] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => onCurrencyChange(c)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  currency === c
                    ? 'bg-zinc-800 text-white'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50'
                } ${c === 'PEN' ? 'rounded-l-md' : 'rounded-r-md'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ASSETS */}
        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-emerald-50 px-6 py-3">
            <h2 className="text-lg font-semibold text-emerald-800">Assets</h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {/* Cash in Bank */}
            <div className="px-6 py-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Cash in Bank
              </h3>
              <div className="space-y-4">
                {Array.from(accountsByPartner.entries()).map(([partner, accounts]) => (
                  <div key={partner}>
                    <p className="mb-2 text-xs font-medium text-zinc-400">{partner}</p>
                    <div className="space-y-1">
                      {accounts.map((ba) => {
                        const { value, converted } = convertForDisplay(ba.balance, ba.currency, currency)
                        return (
                          <div
                            key={ba.bankAccountId}
                            className="flex cursor-pointer items-center justify-between rounded px-3 py-2 transition-colors hover:bg-blue-50"
                            onClick={() => handleAccountClick(ba)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-zinc-700">
                                {ba.bankName} ···{ba.accountNumberLast4}
                              </span>
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                                {ba.accountType}
                              </span>
                              {ba.isDetractionAccount && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                                  Tax only
                                </span>
                              )}
                            </div>
                            <span className={`text-sm font-medium ${value >= 0 ? 'text-zinc-800' : 'text-red-600'}`}>
                              <Amount value={value} currency={currency} converted={converted} />
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3">
                <span className="text-sm font-medium text-zinc-600">Total Cash</span>
                <span className="text-sm font-semibold text-zinc-800">
                  {formatCurrency(totalCash, currency)}
                </span>
              </div>
            </div>

            {/* Accounts Receivable */}
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Accounts Receivable
                </h3>
                <p className="text-xs text-zinc-400">Outstanding AR invoices</p>
              </div>
              <span className="text-sm font-semibold text-zinc-800">
                {formatCurrency(data.arOutstanding, currency)}
              </span>
            </div>

            {/* Tax Credits */}
            <div className="px-6 py-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Tax Credits
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600">IGV Paid (crédito fiscal)</span>
                  <span className="text-sm font-medium text-zinc-800">
                    {formatCurrency(data.igvPaid, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600">Retenciones Unverified</span>
                  <span className="text-sm font-medium text-zinc-800">
                    {formatCurrency(data.retencionesUnverified, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Assets */}
            <div className="flex items-center justify-between bg-emerald-50 px-6 py-4">
              <span className="text-sm font-bold uppercase text-emerald-800">Total Assets</span>
              <span className="text-base font-bold text-emerald-800">
                {formatCurrency(data.totalAssets, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* LIABILITIES */}
        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-red-50 px-6 py-3">
            <h2 className="text-lg font-semibold text-red-800">Liabilities</h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {/* Accounts Payable */}
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Accounts Payable
                </h3>
                <p className="text-xs text-zinc-400">Outstanding costs</p>
              </div>
              <span className="text-sm font-semibold text-zinc-800">
                {formatCurrency(data.apOutstanding, currency)}
              </span>
            </div>

            {/* Tax Liabilities */}
            <div className="px-6 py-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Tax Liabilities
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">IGV Collected (débito fiscal)</span>
                <span className="text-sm font-medium text-zinc-800">
                  {formatCurrency(data.igvCollected, currency)}
                </span>
              </div>
            </div>

            {/* Loans — Alex only */}
            {isAlex && data.loans.length > 0 && (
              <div className="px-6 py-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Loans
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-normal text-zinc-500">
                    ALEX ONLY
                  </span>
                </h3>
                <div className="space-y-2">
                  {data.loans.map((loan) => {
                    const { value, converted } = convertForDisplay(
                      loan.outstanding,
                      loan.currency,
                      currency
                    )
                    return (
                      <div key={loan.loanId} className="flex items-center justify-between">
                        <span className="text-sm text-zinc-600">{loan.lenderName}</span>
                        <span className="text-sm font-medium text-zinc-800">
                          <Amount value={value} currency={currency} converted={converted} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Total Liabilities */}
            <div className="flex items-center justify-between bg-red-50 px-6 py-4">
              <span className="text-sm font-bold uppercase text-red-800">Total Liabilities</span>
              <span className="text-base font-bold text-red-800">
                {formatCurrency(data.totalLiabilities, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* NET POSITION */}
      <div className={`rounded-lg border-2 px-6 py-5 ${
        data.netPosition >= 0
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-red-200 bg-red-50'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-800">Net Position</h2>
            <p className="text-sm text-zinc-500">Assets − Liabilities</p>
          </div>
          <span className={`text-2xl font-bold ${
            data.netPosition >= 0 ? 'text-emerald-700' : 'text-red-700'
          }`}>
            {formatCurrency(data.netPosition, currency)}
          </span>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-zinc-400">
        * Converted at default rate ({currency === 'PEN' ? 'S/.' : '$'} {DEFAULT_RATE}).
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
                      {txn.paymentDate}
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
                      {formatCurrency(txn.amount, txn.currency as Currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
