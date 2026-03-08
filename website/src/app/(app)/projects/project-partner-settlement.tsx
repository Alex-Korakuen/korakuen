'use client'

import { useState, useTransition } from 'react'
import { SectionCard } from '@/components/ui/section-card'
import { Modal } from '@/components/ui/modal'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { fetchPartnerCosts, fetchPartnerRevenue, addProjectPartner, removeProjectPartner } from '@/lib/actions'
import { inputCompactClass } from '@/lib/styles'
import type { ProjectPartnerSettlement as SettlementRow, ProjectPartnerRow, ProjectArInvoice, PartnerCostDetail, PartnerRevenueDetail, Currency } from '@/lib/types'
import type { PartnerCompanyOption } from '@/lib/queries'

type Props = {
  projectId: string
  partners: ProjectPartnerRow[]
  settlements: SettlementRow[]
  partnerCompanies: PartnerCompanyOption[]
  arInvoices: ProjectArInvoice[]
}

export function ProjectPartnerSettlement({ projectId, partners, settlements, partnerCompanies, arInvoices }: Props) {
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null)
  const [showArModal, setShowArModal] = useState(false)
  const [detailTab, setDetailTab] = useState<'costs' | 'revenue'>('costs')
  const [costDetails, setCostDetails] = useState<PartnerCostDetail[]>([])
  const [revenueDetails, setRevenueDetails] = useState<PartnerRevenueDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Add/remove partner form state
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedPartner, setSelectedPartner] = useState('')
  const [profitShare, setProfitShare] = useState('')

  const totalShare = partners.reduce((sum, p) => sum + p.profitSharePct, 0)
  const assignedIds = new Set(partners.map(p => p.partnerCompanyId))
  const availablePartners = partnerCompanies.filter(p => !assignedIds.has(p.id))

  const totalProfit = settlements.reduce((sum, s) => sum + s.profit, 0)
  const totalShouldReceive = settlements.reduce((sum, s) => sum + s.shouldReceive, 0)
  const totalBalance = settlements.reduce((sum, s) => sum + s.balance, 0)

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

  function handleAdd() {
    if (!selectedPartner || !profitShare) return
    const pct = parseFloat(profitShare)
    if (isNaN(pct) || pct <= 0 || pct > 100) return
    setFormError(null)

    startTransition(async () => {
      try {
        await addProjectPartner(projectId, selectedPartner, pct)
        setSelectedPartner('')
        setProfitShare('')
        setShowForm(false)
      } catch (e) {
        setFormError(e instanceof Error ? e.message : 'Failed to add partner')
      }
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      try {
        await removeProjectPartner(id)
      } catch (e) {
        setFormError(e instanceof Error ? e.message : 'Failed to remove partner')
      }
    })
  }

  const selectedSettlement = settlements.find(s => s.partnerCompanyId === expandedPartner)

  return (
    <SectionCard title="Partners">
      {partners.length === 0 && !showForm ? (
        <p className="px-4 py-6 text-center text-sm text-zinc-400">No partners assigned</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Partner</th>
                <th className="px-4 py-2 text-right font-medium">Share</th>
                <th className="px-4 py-2 text-right font-medium">Profit</th>
                <th className="px-4 py-2 text-right font-medium">Should Receive</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
                <th className="w-16 px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {partners.map((p) => {
                const s = settlements.find(s => s.partnerCompanyId === p.partnerCompanyId)
                return (
                  <tr
                    key={p.id}
                    onClick={() => handlePartnerClick(p.partnerCompanyId)}
                    className="cursor-pointer transition-colors hover:bg-blue-50"
                  >
                    <td className="px-4 py-2 font-medium text-zinc-800">{p.partnerName}</td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-600">{p.profitSharePct}%</td>
                    <td className={`px-4 py-2 text-right font-mono font-medium ${
                      (s?.profit ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'
                    }`}>
                      {formatCurrency(s?.profit ?? 0, 'PEN')}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(s?.shouldReceive ?? 0, 'PEN')}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono font-medium ${
                      (s?.balance ?? 0) > 0
                        ? 'text-amber-600'
                        : (s?.balance ?? 0) < 0
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}>
                      {(s?.balance ?? 0) === 0 ? 'Settled' : formatCurrency(s?.balance ?? 0, 'PEN')}
                    </td>
                    <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleRemove(p.id)}
                        disabled={isPending}
                        className="text-red-400 hover:text-red-600 disabled:opacity-50"
                        title="Remove partner"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr
                className="border-t border-zinc-200 bg-zinc-50 cursor-pointer transition-colors hover:bg-blue-50"
                onClick={() => setShowArModal(true)}
                title="Click to view all AR invoices"
              >
                <td className="px-4 py-2 font-medium text-zinc-700">Total</td>
                <td className={`px-4 py-2 text-right font-mono font-semibold ${
                  totalShare === 100 ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {totalShare}%
                </td>
                <td className={`px-4 py-2 text-right font-mono font-semibold ${
                  totalProfit >= 0 ? 'text-green-700' : 'text-red-600'
                }`}>
                  {formatCurrency(totalProfit, 'PEN')}
                </td>
                <td className="px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                  {formatCurrency(totalShouldReceive, 'PEN')}
                </td>
                <td className={`px-4 py-2 text-right font-mono font-semibold ${
                  totalBalance > 0 ? 'text-amber-600' : totalBalance < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {totalBalance === 0 ? 'Settled' : formatCurrency(totalBalance, 'PEN')}
                </td>
                <td className="px-4 py-2 text-right">
                  {totalShare === 100 ? (
                    <span className="text-xs text-green-600">OK</span>
                  ) : (
                    <span className="text-xs text-amber-600">{totalShare < 100 ? `${100 - totalShare}%` : 'Over'}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add partner form */}
      <div className="px-4 py-2">
        {showForm ? (
          <div className="space-y-2 border-t border-zinc-100 pt-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <select
                  value={selectedPartner}
                  onChange={(e) => setSelectedPartner(e.target.value)}
                  className={`w-full ${inputCompactClass}`}
                >
                  <option value="">Select partner...</option>
                  {availablePartners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="number"
                  value={profitShare}
                  onChange={(e) => setProfitShare(e.target.value)}
                  placeholder="%"
                  min="0"
                  max="100"
                  step="0.01"
                  className={`w-full ${inputCompactClass} font-mono`}
                />
              </div>
            </div>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!selectedPartner || !profitShare || isPending}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowForm(false); setFormError(null) }}
                className="rounded px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            disabled={availablePartners.length === 0}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:text-zinc-400"
          >
            + Add partner
          </button>
        )}
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
                      <th className="pb-2 text-left font-medium">Invoice</th>
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
                        <td className="py-2 text-zinc-700">{d.comprobante_number ?? '—'}</td>
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
                      <td colSpan={3} className="py-2 text-sm font-medium text-zinc-700">Total (PEN)</td>
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

      {/* Project AR invoices modal */}
      <Modal
        isOpen={showArModal}
        onClose={() => setShowArModal(false)}
        title="AR Invoices"
      >
        {arInvoices.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No AR invoices</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                <th className="pb-2 text-left font-medium">Invoice #</th>
                <th className="pb-2 text-left font-medium">Date</th>
                <th className="pb-2 text-right font-medium">Gross Total</th>
                <th className="pb-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {arInvoices.map((ar) => (
                <tr key={ar.id}>
                  <td className="py-2 font-medium text-zinc-800">
                    {ar.invoice_number ?? '—'}
                  </td>
                  <td className="py-2 whitespace-nowrap text-zinc-600">
                    {ar.invoice_date ? formatDate(ar.invoice_date) : '—'}
                  </td>
                  <td className="py-2 whitespace-nowrap text-right font-mono text-zinc-700">
                    {formatCurrency(ar.gross_total, ar.currency as Currency)}
                  </td>
                  <td className="py-2 whitespace-nowrap text-zinc-600">
                    {ar.payment_status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </SectionCard>
  )
}
