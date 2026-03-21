'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { fetchPartnerPayables, fetchPartnerReceivables, addProjectPartner, removeProjectPartner, updatePartnerProfitShare } from '@/lib/actions'
import { inputCompactClass, btnDangerIcon, iconTrash } from '@/lib/styles'
import type { ProjectPartnerSettlement as SettlementRow, ProjectPartnerRow, PartnerPayableDetail, PartnerReceivableDetail, PartnerCompanyOption } from '@/lib/types'

type Props = {
  projectId: string
  partners: ProjectPartnerRow[]
  settlements: SettlementRow[]
  partnerCompanies: PartnerCompanyOption[]
  showForm: boolean
  onHideForm: () => void
}

export function ProjectPartnerSettlement({ projectId, partners, settlements, partnerCompanies, showForm, onHideForm }: Props) {
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'costs' | 'revenue'>('costs')
  const [costDetails, setCostDetails] = useState<PartnerPayableDetail[]>([])
  const [revenueDetails, setRevenueDetails] = useState<PartnerReceivableDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedPartner, setSelectedPartner] = useState('')
  const [profitShare, setProfitShare] = useState('')

  // Inline share edit state
  const [editingShareId, setEditingShareId] = useState<string | null>(null)
  const [editShareValue, setEditShareValue] = useState('')
  const [editShareError, setEditShareError] = useState<string | null>(null)

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
      if (partnerCompanyId === '__all__') {
        // Fetch costs and revenue for all partners
        const partnerIds = partners.map(p => p.partnerCompanyId)
        const results = await Promise.all(
          partnerIds.flatMap(id => [fetchPartnerPayables(projectId, id), fetchPartnerReceivables(projectId, id)])
        )
        const allCosts: PartnerPayableDetail[] = []
        const allRevenue: PartnerReceivableDetail[] = []
        for (let i = 0; i < partnerIds.length; i++) {
          allCosts.push(...(results[i * 2] as PartnerPayableDetail[]))
          allRevenue.push(...(results[i * 2 + 1] as PartnerReceivableDetail[]))
        }
        allCosts.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
        allRevenue.sort((a, b) => (b.payment_date ?? '').localeCompare(a.payment_date ?? ''))
        setCostDetails(allCosts)
        setRevenueDetails(allRevenue)
      } else {
        const [costs, revenue] = await Promise.all([
          fetchPartnerPayables(projectId, partnerCompanyId),
          fetchPartnerReceivables(projectId, partnerCompanyId),
        ])
        setCostDetails(costs)
        setRevenueDetails(revenue)
      }
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
      const result = await addProjectPartner(projectId, selectedPartner, pct)
      if (result.error) {
        setFormError(result.error)
      } else {
        setSelectedPartner('')
        setProfitShare('')
        onHideForm()
      }
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeProjectPartner(id)
      if (result.error) setFormError(result.error)
    })
  }

  function startShareEdit(partnerId: string, currentPct: number) {
    setEditingShareId(partnerId)
    setEditShareValue(currentPct.toString())
    setEditShareError(null)
  }

  function handleSaveShare(projectPartnerId: string) {
    const pct = parseFloat(editShareValue)
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setEditShareError('Must be 0–100%')
      return
    }
    setEditShareError(null)
    startTransition(async () => {
      const result = await updatePartnerProfitShare(projectPartnerId, pct)
      if (result.error) {
        setEditShareError(result.error)
      } else {
        setEditingShareId(null)
      }
    })
  }

  const selectedSettlement = expandedPartner === '__all__'
    ? {
        partnerCompanyId: '__all__',
        partnerName: 'All Partners',
        profitSharePct: totalShare,
        costsContributed: settlements.reduce((sum, s) => sum + s.costsContributed, 0),
        revenueReceived: settlements.reduce((sum, s) => sum + s.revenueReceived, 0),
        profit: totalProfit,
        shouldReceive: totalShouldReceive,
        balance: totalBalance,
      }
    : settlements.find(s => s.partnerCompanyId === expandedPartner)

  return (
    <>
      {partners.length === 0 && !showForm ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="px-4 py-6 text-center text-sm text-faint">No partners assigned</p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-edge">
                <th className="px-3 py-2 text-left font-medium">Partner</th>
                <th className="px-2 py-2 text-right font-medium">Share</th>
                <th className="px-2 py-2 text-right font-medium">Profit</th>
                <th className="px-2 py-2 text-right font-medium">Owed</th>
                <th className="px-2 py-2 text-right font-medium">Balance (+&nbsp;=&nbsp;owed)</th>
                <th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {partners.map((p) => {
                const s = settlements.find(s => s.partnerCompanyId === p.partnerCompanyId)
                const isEditingShare = editingShareId === p.id
                return (
                  <tr
                    key={p.id}
                    onClick={() => !isEditingShare && handlePartnerClick(p.partnerCompanyId)}
                    className={`group cursor-pointer transition-colors ${isEditingShare ? 'bg-accent-bg' : 'hover:bg-accent-bg'}`}
                  >
                    <td className="px-3 py-2 font-medium text-ink truncate max-w-[120px]">{p.partnerName}</td>
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {isEditingShare ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={editShareValue}
                            onChange={(e) => setEditShareValue(e.target.value)}
                            min="0"
                            max="100"
                            step="0.01"
                            className={`${inputCompactClass} w-14 bg-white font-mono text-right`}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveShare(p.id)
                              if (e.key === 'Escape') { setEditingShareId(null); setEditShareError(null) }
                            }}
                          />
                          <span className="text-xs text-muted">%</span>
                          <button
                            onClick={() => handleSaveShare(p.id)}
                            disabled={isPending}
                            className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                          >
                            {isPending ? '...' : 'Save'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startShareEdit(p.id, p.profitSharePct)}
                          className="rounded border border-dashed border-edge-strong px-1.5 py-0.5 font-mono text-accent transition-colors hover:border-accent hover:bg-accent-bg"
                          title="Click to edit share"
                        >
                          {p.profitSharePct}%
                        </button>
                      )}
                      {isEditingShare && editShareError && (
                        <p className="mt-1 text-[10px] text-negative">{editShareError}</p>
                      )}
                    </td>
                    <td className={`px-2 py-2 text-right font-mono font-medium whitespace-nowrap ${
                      (s?.profit ?? 0) >= 0 ? 'text-positive' : 'text-negative'
                    }`}>
                      {formatCurrency(s?.profit ?? 0, 'PEN')}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-ink whitespace-nowrap">
                      {formatCurrency(s?.shouldReceive ?? 0, 'PEN')}
                    </td>
                    <td className={`px-2 py-2 text-right font-mono font-medium whitespace-nowrap ${
                      (s?.balance ?? 0) > 0
                        ? 'text-caution'
                        : (s?.balance ?? 0) < 0
                        ? 'text-negative'
                        : 'text-positive'
                    }`}>
                      {(s?.balance ?? 0) === 0 ? 'Settled' : formatCurrency(s?.balance ?? 0, 'PEN')}
                    </td>
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleRemove(p.id)}
                        disabled={isPending}
                        className={`${btnDangerIcon} opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50`}
                        title="Remove partner"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          <path fillRule="evenodd" d={iconTrash} clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Total row — pinned to bottom via mt-auto in flex-col parent */}
      {partners.length > 0 && (
        <div
          className="mt-auto border-t border-edge bg-panel/50 rounded-b-xl cursor-pointer transition-colors hover:bg-accent-bg"
          onClick={() => handlePartnerClick('__all__')}
          title="Click to view all costs and revenue"
        >
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="px-3 py-2 font-medium text-ink">Total</td>
                <td className={`px-2 py-2 text-right font-mono font-semibold ${
                  totalShare === 100 ? 'text-positive' : 'text-caution'
                }`}>
                  {totalShare}%
                </td>
                <td className={`px-2 py-2 text-right font-mono font-semibold whitespace-nowrap ${
                  totalProfit >= 0 ? 'text-positive' : 'text-negative'
                }`}>
                  {formatCurrency(totalProfit, 'PEN')}
                </td>
                <td className="px-2 py-2 text-right font-mono font-semibold text-ink whitespace-nowrap">
                  {formatCurrency(totalShouldReceive, 'PEN')}
                </td>
                <td className={`px-2 py-2 text-right font-mono font-semibold whitespace-nowrap ${
                  totalBalance > 0 ? 'text-caution' : totalBalance < 0 ? 'text-negative' : 'text-positive'
                }`}>
                  {totalBalance === 0 ? 'Settled' : formatCurrency(totalBalance, 'PEN')}
                </td>
                <td className="w-10 px-2 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Add partner inline form */}
      {showForm && (
        <div className="px-4 py-2">
          <div className="space-y-2 border-t border-edge pt-3">
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
            {formError && <p className="text-xs text-negative">{formError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!selectedPartner || !profitShare || isPending}
                className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { onHideForm(); setFormError(null) }}
                className="rounded px-3 py-1 text-xs text-muted hover:bg-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      <Modal
        isOpen={!!expandedPartner}
        onClose={handleClose}
        title={selectedSettlement ? `${selectedSettlement.partnerName} — Details` : ''}
      >
        {selectedSettlement && (
          <div>
            {/* Summary card */}
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-panel px-3 py-2 text-sm">
              <div>
                <span className="text-muted">Costs</span>
                <p className="font-mono font-medium text-ink">
                  {formatCurrency(selectedSettlement.costsContributed, 'PEN')}
                </p>
              </div>
              <div>
                <span className="text-muted">Revenue</span>
                <p className="font-mono font-medium text-ink">
                  {formatCurrency(selectedSettlement.revenueReceived, 'PEN')}
                </p>
              </div>
              <div>
                <span className="text-muted">Profit</span>
                <p className={`font-mono font-medium ${
                  selectedSettlement.profit >= 0 ? 'text-positive' : 'text-negative'
                }`}>
                  {formatCurrency(selectedSettlement.profit, 'PEN')}
                </p>
              </div>
              <div>
                <span className="text-muted">Balance</span>
                <p className={`font-mono font-medium ${
                  selectedSettlement.balance > 0 ? 'text-caution'
                    : selectedSettlement.balance < 0 ? 'text-negative'
                    : 'text-positive'
                }`}>
                  {selectedSettlement.balance === 0 ? 'Settled' : formatCurrency(selectedSettlement.balance, 'PEN')}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 border-b border-edge">
              <button
                onClick={() => setDetailTab('costs')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  detailTab === 'costs'
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Costs ({costDetails.length})
              </button>
              <button
                onClick={() => setDetailTab('revenue')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  detailTab === 'revenue'
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Revenue ({revenueDetails.length})
              </button>
            </div>

            {loading && (
              <p className="py-8 text-center text-sm text-muted">Loading...</p>
            )}
            {!loading && error && (
              <div className="mb-4 rounded border border-negative/20 bg-negative-bg px-4 py-3 text-sm text-negative">
                Could not load details.
              </div>
            )}

            {/* Costs tab */}
            {!loading && !error && detailTab === 'costs' && (
              costDetails.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No costs found</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-edge text-xs text-muted">
                      <th className="pb-2 text-left font-medium">Date</th>
                      <th className="pb-2 text-left font-medium">Invoice</th>
                      <th className="pb-2 text-right font-medium">Original</th>
                      <th className="pb-2 text-right font-medium">PEN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {costDetails.map((d) => (
                      <tr key={d.invoice_id}>
                        <td className="py-2 whitespace-nowrap text-muted">
                          {d.date ? formatDate(d.date) : '—'}
                        </td>
                        <td className="py-2 text-ink">{d.invoice_number ?? '—'}</td>
                        <td className="py-2 whitespace-nowrap text-right font-mono text-muted">
                          {formatCurrency(d.subtotal, d.currency ?? 'PEN')}
                        </td>
                        <td className="py-2 whitespace-nowrap text-right font-mono text-ink">
                          {formatCurrency(d.subtotal_pen, 'PEN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-edge">
                      <td colSpan={3} className="py-2 text-sm font-medium text-ink">Total (PEN)</td>
                      <td className="py-2 whitespace-nowrap text-right font-mono font-semibold text-ink">
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
                <p className="py-8 text-center text-sm text-muted">No payments received</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-edge text-xs text-muted">
                      <th className="pb-2 text-left font-medium">Date</th>
                      <th className="pb-2 text-left font-medium">Invoice</th>
                      <th className="pb-2 text-right font-medium">Original</th>
                      <th className="pb-2 text-right font-medium">PEN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {revenueDetails.map((d) => (
                      <tr key={d.payment_id}>
                        <td className="py-2 whitespace-nowrap text-muted">
                          {d.payment_date ? formatDate(d.payment_date) : '—'}
                        </td>
                        <td className="py-2 text-ink">{d.invoice_number ?? '—'}</td>
                        <td className="py-2 whitespace-nowrap text-right font-mono text-muted">
                          {formatCurrency(d.amount, d.currency ?? 'PEN')}
                        </td>
                        <td className="py-2 whitespace-nowrap text-right font-mono text-ink">
                          {formatCurrency(d.amount_pen, 'PEN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-edge">
                      <td colSpan={3} className="py-2 text-sm font-medium text-ink">Total (PEN)</td>
                      <td className="py-2 whitespace-nowrap text-right font-mono font-semibold text-ink">
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

    </>
  )
}
