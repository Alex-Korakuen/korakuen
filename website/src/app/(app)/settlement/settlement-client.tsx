'use client'

import { useState, useTransition } from 'react'
import { formatCurrency, formatCurrencyCompact } from '@/lib/formatters'
import { SectionCard } from '@/components/ui/section-card'
import { HeaderTitlePortal } from '@/components/ui/header-title-portal'
import { FilterMultiSelect } from '@/components/ui/filter-multi-select'
import type {
  ProjectListItem,
  SettlementDashboardData,
} from '@/lib/types'

type Props = {
  projects: ProjectListItem[]
  initialData: SettlementDashboardData
  initialProjectIds: string[]
}

async function fetchSettlement(projectIds: string[]): Promise<SettlementDashboardData> {
  const res = await fetch('/api/settlement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectIds }),
  })
  if (!res.ok) throw new Error('Failed to fetch settlement data')
  return res.json()
}

export function SettlementClient({ projects, initialData, initialProjectIds }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialProjectIds)
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  const projectOptions = projects.map(p => ({
    value: p.id,
    label: `${p.project_code} — ${p.name}`,
  }))

  function handleProjectChange(ids: string[]) {
    setSelectedIds(ids)
    refreshData(ids)
  }

  function refreshData(ids: string[]) {
    startTransition(async () => {
      try {
        const result = await fetchSettlement(ids)
        setData(result)
      } catch (err) {
        console.error('Failed to refresh settlement data:', err)
      }
    })
  }

  const { summary, partners } = data
  const isSingleProject = selectedIds.length === 1

  return (
    <div>
      <HeaderTitlePortal>
        <span className="text-sm font-medium text-ink">Settlement</span>
      </HeaderTitlePortal>

      {/* Project filter */}
      <div className="mb-6">
        <FilterMultiSelect
          values={selectedIds}
          onChange={handleProjectChange}
          options={projectOptions}
          placeholder="All projects"
        />
      </div>

      {/* Summary strip */}
      <div className={`mb-6 grid grid-cols-4 gap-px overflow-hidden rounded-[10px] border border-edge bg-edge ${isPending ? 'opacity-60' : ''}`}>
        <SummaryCell label="Projects" value={String(summary.projectCount)} />
        <SummaryCell label="Income Collected" value={formatCurrency(summary.incomeCollected, 'PEN')} />
        <SummaryCell label="Total Costs" value={formatCurrency(summary.totalCosts, 'PEN')} />
        <SummaryCell label="Total Profit" value={formatCurrency(summary.totalProfit, 'PEN')} isProfit />
      </div>

      {/* Partner table */}
      <SectionCard className={`overflow-hidden ${isPending ? 'opacity-60' : ''}`}>
        {partners.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-faint">
            No partners assigned to the selected projects.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge">
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted">Partner</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted">Share</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted">Costs Paid</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted">Profit Share</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted">Should Receive</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {partners.map(p => {
                const isYou = p.partnerName.toLowerCase().includes('korakuen')
                return (
                  <tr key={p.partnerId} className="transition-colors hover:bg-accent-bg">
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">{p.partnerName}</span>
                      {isYou && (
                        <span className="ml-1.5 inline-block rounded bg-positive-bg px-1.5 py-0.5 text-[10px] font-medium text-positive">
                          you
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {isSingleProject && p.profitSharePct !== null
                        ? `${p.profitSharePct.toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-ink">
                      {formatCurrency(p.costsPaid, 'PEN')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-ink">
                      {formatCurrency(p.profitShare, 'PEN')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-ink">
                      {formatCurrency(p.shouldReceive, 'PEN')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <BalanceBadge amount={p.balance} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-edge bg-panel/50">
                <td className="px-4 py-3 font-medium text-ink">Total</td>
                <td className="px-4 py-3 text-right text-muted">—</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-ink">
                  {formatCurrency(summary.totalCosts, 'PEN')}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-ink">
                  {formatCurrency(summary.totalProfit, 'PEN')}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-ink">
                  {formatCurrency(summary.totalCosts + summary.totalProfit, 'PEN')}
                </td>
                <td className="px-4 py-3 text-right text-muted">—</td>
              </tr>
            </tfoot>
          </table>
        )}
      </SectionCard>
    </div>
  )
}

function SummaryCell({ label, value, isProfit }: { label: string; value: string; isProfit?: boolean }) {
  return (
    <div className="bg-white px-4 py-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-xl font-bold ${isProfit ? 'text-positive' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  )
}

function BalanceBadge({ amount }: { amount: number }) {
  if (amount === 0) {
    return <span className="text-faint">—</span>
  }

  const isPositive = amount > 0
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
        isPositive
          ? 'bg-positive-bg text-positive'
          : 'bg-negative-bg text-negative'
      }`}
    >
      {formatCurrencyCompact(amount, 'PEN')}
    </span>
  )
}
