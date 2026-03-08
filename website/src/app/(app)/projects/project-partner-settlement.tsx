'use client'

import { useState } from 'react'
import { SectionCard } from '@/components/ui/section-card'
import { Modal } from '@/components/ui/modal'
import { formatCurrency, formatDate, formatCategory } from '@/lib/formatters'
import { fetchPartnerCosts, fetchPartnerRevenue } from '@/lib/actions'
import type { ProjectPartnerSettlement as SettlementRow, PartnerCostDetail, PartnerRevenueDetail, Currency } from '@/lib/types'

type Props = {
  projectId: string
  settlements: SettlementRow[]
}

export function ProjectPartnerSettlement({ projectId, settlements }: Props) {
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'costs' | 'revenue'>('costs')
  const [costDetails, setCostDetails] = useState<PartnerCostDetail[]>([])
  const [revenueDetails, setRevenueDetails] = useState<PartnerRevenueDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const totalCosts = settlements.reduce((sum, s) => sum + s.costsContributed, 0)
  const totalRevenue = settlements.reduce((sum, s) => sum + s.revenueReceived, 0)
  const totalProfit = settlements.reduce((sum, s) => sum + s.profit, 0)

  async function handlePartnerClick(partnerCompanyId: string) {
    setExpandedPartner(partnerCompanyId)
    setDetailTab('costs')
    setLoading(true)
    setError(false)
    setCostDetails([])
    setRevenueDetails([])
    try {
      const [costs, revenue] = await Promise.all([
        fetchPartnerCosts(projectId, partnerCompanyId),
        fetchPartnerRevenue(projectId, partnerCompanyId),
      ])
      setCostDetails(costs)
      setRevenueDetails(revenue)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setExpandedPartner(null)
    setCostDetails([])
    setRevenueDetails([])
  }

  const selectedSettlement = settlements.find(s => s.partnerCompanyId === expandedPartner)

  if (settlements.length === 0) {
    return (
      <SectionCard title="Partner Settlement">
        <p className="px-4 py-6 text-center text-sm text-zinc-400">No partners assigned</p>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Partner Settlement">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Partner</th>
              <th className="px-4 py-2 text-right font-medium">Share</th>
              <th className="px-4 py-2 text-right font-medium">Costs</th>
              <th className="px-4 py-2 text-right font-medium">Revenue</th>
              <th className="px-4 py-2 text-right font-medium">Profit</th>
              <th className="px-4 py-2 text-right font-medium">Should Receive</th>
              <th className="px-4 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {settlements.map((s) => (
              <tr
                key={s.partnerCompanyId}
                onClick={() => handlePartnerClick(s.partnerCompanyId)}
                className="cursor-pointer transition-colors hover:bg-blue-50"
              >
                <td className="px-4 py-2 font-medium text-zinc-800">{s.partnerName}</td>
                <td className="px-4 py-2 text-right font-mono text-zinc-600">{s.profitSharePct}%</td>
                <td className="px-4 py-2 text-right font-mono text-zinc-700">
                  {formatCurrency(s.costsContributed, 'PEN')}
                </td>
                <td className="px-4 py-2 text-right font-mono text-zinc-700">
                  {formatCurrency(s.revenueReceived, 'PEN')}
                </td>
                <td className={`px-4 py-2 text-right font-mono font-medium ${
                  s.profit >= 0 ? 'text-green-700' : 'text-red-600'
                }`}>
                  {formatCurrency(s.profit, 'PEN')}
                </td>
                <td className="px-4 py-2 text-right font-mono text-zinc-700">
                  {formatCurrency(s.shouldReceive, 'PEN')}
                </td>
                <td className={`px-4 py-2 text-right font-mono font-medium ${
                  s.balance > 0
                    ? 'text-amber-600'
                    : s.balance < 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}>
                  {s.balance === 0 ? 'Settled' : formatCurrency(s.balance, 'PEN')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50">
              <td className="px-4 py-2 font-medium text-zinc-700">Total</td>
              <td className="px-4 py-2"></td>
              <td className="px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                {formatCurrency(totalCosts, 'PEN')}
              </td>
              <td className="px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                {formatCurrency(totalRevenue, 'PEN')}
              </td>
              <td className={`px-4 py-2 text-right font-mono font-semibold ${
                totalProfit >= 0 ? 'text-green-700' : 'text-red-600'
              }`}>
                {formatCurrency(totalProfit, 'PEN')}
              </td>
              <td className="px-4 py-2"></td>
              <td className="px-4 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="border-t border-zinc-200 px-4 py-2">
        <p className="text-xs text-zinc-400">
          All amounts in PEN at transaction-date rates. Positive balance = partner is owed. Click a row for details.
        </p>
      </div>

      {/* Detail modal */}
      <Modal
        isOpen={!!expandedPartner}
        onClose={handleClose}
        title={selectedSettlement ? `${selectedSettlement.partnerName} — Details` : ''}
      >
        {selectedSettlement && (
          <div>
            {/* Summary card */}
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-zinc-50 px-3 py-2 text-sm">
              <div>
                <span className="text-zinc-500">Costs</span>
                <p className="font-mono font-medium text-zinc-800">
                  {formatCurrency(selectedSettlement.costsContributed, 'PEN')}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Revenue</span>
                <p className="font-mono font-medium text-zinc-800">
                  {formatCurrency(selectedSettlement.revenueReceived, 'PEN')}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Profit</span>
                <p className={`font-mono font-medium ${
                  selectedSettlement.profit >= 0 ? 'text-green-700' : 'text-red-600'
                }`}>
                  {formatCurrency(selectedSettlement.profit, 'PEN')}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Balance</span>
                <p className={`font-mono font-medium ${
                  selectedSettlement.balance > 0 ? 'text-amber-600'
                    : selectedSettlement.balance < 0 ? 'text-red-600'
                    : 'text-green-600'
                }`}>
                  {selectedSettlement.balance === 0 ? 'Settled' : formatCurrency(selectedSettlement.balance, 'PEN')}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 border-b border-zinc-200">
              <button
                onClick={() => setDetailTab('costs')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  detailTab === 'costs'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Costs ({costDetails.length})
              </button>
              <button
                onClick={() => setDetailTab('revenue')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  detailTab === 'revenue'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Revenue ({revenueDetails.length})
              </button>
            </div>

            {loading && (
              <p className="py-8 text-center text-sm text-zinc-500">Loading...</p>
            )}
            {!loading && error && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Could not load details.
              </div>
            )}

            {/* Costs tab */}
            {!loading && !error && detailTab === 'costs' && (
              costDetails.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">No costs found</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                      <th className="pb-2 text-left font-medium">Date</th>
                      <th className="pb-2 text-left font-medium">Title</th>
                      <th className="pb-2 text-left font-medium">Category</th>
                      <th className="pb-2 text-right font-medium">Original</th>
                      <th className="pb-2 text-right font-medium">PEN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {costDetails.map((d) => (
                      <tr key={d.cost_id}>
                        <td className="py-2 whitespace-nowrap text-zinc-600">
                          {d.date ? formatDate(d.date) : '—'}
                        </td>
                        <td className="py-2 text-zinc-700">{d.title ?? '—'}</td>
                        <td className="py-2 whitespace-nowrap text-zinc-600">
                          {formatCategory(d.category)}
                        </td>
                        <td className="py-2 whitespace-nowrap text-right font-mono text-zinc-500">
                          {formatCurrency(d.subtotal, (d.currency ?? 'PEN') as Currency)}
                        </td>
                        <td className="py-2 whitespace-nowrap text-right font-mono text-zinc-700">
                          {formatCurrency(d.subtotal_pen, 'PEN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-200">
                      <td colSpan={4} className="py-2 text-sm font-medium text-zinc-700">Total (PEN)</td>
                      <td className="py-2 whitespace-nowrap text-right font-mono font-semibold text-zinc-800">
                        {formatCurrency(costDetails.reduce((sum, d) => sum + d.subtotal_pen, 0), 'PEN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )
            )}

            {/* Revenue tab */}
            {!loading && !error && detailTab === 'revenue' && (
              revenueDetails.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">No payments received</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                      <th className="pb-2 text-left font-medium">Date</th>
                      <th className="pb-2 text-left font-medium">Invoice</th>
                      <th className="pb-2 text-right font-medium">Original</th>
                      <th className="pb-2 text-right font-medium">PEN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {revenueDetails.map((d) => (
                      <tr key={d.payment_id}>
                        <td className="py-2 whitespace-nowrap text-zinc-600">
                          {d.payment_date ? formatDate(d.payment_date) : '—'}
                        </td>
                        <td className="py-2 text-zinc-700">{d.invoice_number ?? '—'}</td>
                        <td className="py-2 whitespace-nowrap text-right font-mono text-zinc-500">
                          {formatCurrency(d.amount, (d.currency ?? 'PEN') as Currency)}
                        </td>
                        <td className="py-2 whitespace-nowrap text-right font-mono text-zinc-700">
                          {formatCurrency(d.amount_pen, 'PEN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-200">
                      <td colSpan={3} className="py-2 text-sm font-medium text-zinc-700">Total (PEN)</td>
                      <td className="py-2 whitespace-nowrap text-right font-mono font-semibold text-zinc-800">
                        {formatCurrency(revenueDetails.reduce((sum, d) => sum + d.amount_pen, 0), 'PEN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )
            )}
          </div>
        )}
      </Modal>
    </SectionCard>
  )
}
