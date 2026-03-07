'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { categoryLabels } from '@/lib/constants'
import { Modal } from '@/components/ui/modal'
import { fetchPartnerCosts } from '@/lib/actions'
import { RateIndicator } from '@/components/ui/rate-indicator'
import type { PartnerBalanceData, PartnerContribution, PartnerCostDetail, Currency } from '@/lib/types'

type Props = {
  data: PartnerBalanceData | null
  projects: { id: string; project_code: string; name: string }[]
  projectId: string | null
  exchangeRate: { mid_rate: number; rate_date: string } | null
  onProjectChange: (projectId: string | null) => void
}

export function PartnerBalancesClient({
  data,
  projects,
  projectId,
  exchangeRate,
  onProjectChange,
}: Props) {
  const [selectedPartner, setSelectedPartner] = useState<PartnerContribution | null>(null)
  const [costDetails, setCostDetails] = useState<PartnerCostDetail[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)

  async function handlePartnerClick(partner: PartnerContribution) {
    setSelectedPartner(partner)
    setDetailLoading(true)
    setDetailError(false)
    setCostDetails([])
    try {
      const details = await fetchPartnerCosts(projectId!, partner.partner_company_id)
      setCostDetails(details)
    } catch {
      setDetailError(true)
    } finally {
      setDetailLoading(false)
    }
  }

  function handleCloseModal() {
    setSelectedPartner(null)
    setCostDetails([])
  }

  const contributions = data?.contributions ?? []
  const settlements = data?.settlements ?? []
  const totalContribution = contributions.reduce((sum, c) => sum + c.contribution_amount_pen, 0)
  const totalIncome = contributions[0]?.project_income_pen ?? 0

  return (
    <div>
      {/* Project selector */}
      <div className="mt-6 flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Project</label>
        <select
          value={projectId ?? ''}
          onChange={(e) => onProjectChange(e.target.value || null)}
          className="w-full max-w-md rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
        >
          <option value="">Select a project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_code} — {p.name}
            </option>
          ))}
        </select>
      </div>

      <RateIndicator data={exchangeRate ? { rate: exchangeRate.mid_rate, date: exchangeRate.rate_date } : null} />

      {!projectId && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-12 text-center">
          <p className="text-zinc-500">Select a project to view partner balances</p>
        </div>
      )}

      {projectId && data && (
        <div className="mt-6 space-y-8">
          <p className="text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">{data.projectCode}</span>
            {' — '}
            {data.projectName}
          </p>

          {contributions.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-12 text-center">
              <p className="text-zinc-500">No cost contributions recorded for this project</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Contributions — all in PEN at transaction-date rates */}
              <div className="rounded-lg border border-zinc-200">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <h3 className="text-sm font-medium text-zinc-700">
                    Contributions (in PEN at transaction-date rates)
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Total: {formatCurrency(totalContribution, 'PEN')}
                  </p>
                </div>
                <div className="divide-y divide-zinc-100">
                  {contributions.map((c) => (
                    <div
                      key={c.partner_company_id}
                      className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-blue-50"
                      onClick={() => handlePartnerClick(c)}
                    >
                      <div className="flex-1">
                        <span className="font-medium text-zinc-800">
                          {c.partner_name}
                        </span>
                        {/* Proportion bar */}
                        <div className="mt-1.5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${c.contribution_pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-medium text-zinc-800">
                          {formatCurrency(c.contribution_amount_pen, 'PEN')}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Contributed {c.contribution_pct}% · Profit share {c.profit_share_pct}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Income — in PEN at transaction-date rates */}
              <div className="rounded-lg border border-zinc-200">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <h3 className="text-sm font-medium text-zinc-700">
                    Project Income (in PEN at transaction-date rates)
                  </h3>
                </div>
                <div className="px-4 py-3">
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-zinc-600">Total AR Invoiced</span>
                    <span className="font-mono text-sm font-medium text-zinc-800">
                      {formatCurrency(totalIncome, 'PEN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Settlement — in PEN */}
              <div className="rounded-lg border border-zinc-200">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <h3 className="text-sm font-medium text-zinc-700">Settlement Position (in PEN)</h3>
                  <p className="text-xs text-zinc-500">
                    All amounts converted at transaction-date exchange rates
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs text-zinc-500">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Partner</th>
                        <th className="px-4 py-2 text-right font-medium">Should Receive</th>
                        <th className="px-4 py-2 text-right font-medium">Actually Received</th>
                        <th className="px-4 py-2 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {settlements.map((s) => (
                        <tr key={s.partner_company_id} className="transition-colors hover:bg-blue-50">
                          <td className="px-4 py-2 font-medium text-zinc-800">
                            {s.partner_name}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-zinc-700">
                            {formatCurrency(s.income_share_pen, 'PEN')}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-zinc-700">
                            {formatCurrency(s.actually_received_pen, 'PEN')}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-mono font-medium ${
                              s.settlement_balance_pen > 0
                                ? 'text-amber-600'
                                : s.settlement_balance_pen < 0
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}
                          >
                            {s.settlement_balance_pen === 0
                              ? 'Settled'
                              : formatCurrency(s.settlement_balance_pen, 'PEN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-zinc-200 px-4 py-2">
                  <p className="text-xs text-zinc-400">
                    Positive balance = partner is owed. Negative = partner has been overpaid.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cost detail modal — shows original currency alongside PEN equivalent */}
      <Modal
        isOpen={!!selectedPartner}
        onClose={handleCloseModal}
        title={selectedPartner ? `${selectedPartner.partner_name} — Costs` : ''}
      >
        {selectedPartner && (
          <div>
            <div className="mb-4 flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
              <span className="text-sm text-zinc-600">
                Total contribution (PEN)
              </span>
              <span className="font-mono text-sm font-semibold text-zinc-800">
                {formatCurrency(selectedPartner.contribution_amount_pen, 'PEN')}
              </span>
            </div>

            {!detailLoading && detailError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Could not load cost details.
              </div>
            )}

            {detailLoading ? (
              <p className="py-8 text-center text-sm text-zinc-500">Loading costs...</p>
            ) : costDetails.length === 0 && !detailError ? (
              <p className="py-8 text-center text-sm text-zinc-500">No individual costs found</p>
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
                      <td className="py-2 text-zinc-700">
                        {d.title ?? '—'}
                      </td>
                      <td className="py-2 whitespace-nowrap text-zinc-600">
                        {categoryLabels[d.category] ?? d.category}
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
                      {formatCurrency(
                        costDetails.reduce((sum, d) => sum + d.subtotal_pen, 0),
                        'PEN'
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
