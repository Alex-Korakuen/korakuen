'use client'

import { useState, useTransition } from 'react'
import { formatCurrency, formatCurrencyCompact } from '@/lib/formatters'
import { HeaderTitlePortal } from '@/components/ui/header-title-portal'
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

  const activeProjects = projects.filter(p => p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')
  const allProjects = [...activeProjects, ...completedProjects]

  const isAllActive = selectedIds.length === activeProjects.length &&
    activeProjects.every(p => selectedIds.includes(p.id))

  function toggleProject(projectId: string) {
    const newIds = selectedIds.includes(projectId)
      ? selectedIds.filter(id => id !== projectId)
      : [...selectedIds, projectId]
    // At least one must remain selected
    if (newIds.length === 0) return
    setSelectedIds(newIds)
    refreshData(newIds)
  }

  function selectAllActive() {
    const ids = activeProjects.map(p => p.id)
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

      {/* Project chips */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted mr-1">Projects</span>
        <button
          onClick={selectAllActive}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            isAllActive
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-edge bg-white text-muted hover:border-edge-strong hover:text-ink'
          }`}
        >
          All active
        </button>
        {allProjects.map(p => {
          const isSelected = selectedIds.includes(p.id)
          return (
            <button
              key={p.id}
              onClick={() => toggleProject(p.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isSelected
                  ? 'border-edge-strong bg-surface text-ink'
                  : 'border-edge bg-white text-faint hover:border-edge-strong hover:text-muted'
              }`}
            >
              <span className="font-mono text-[11px] mr-1">{p.project_code}</span>
              {p.name}
            </button>
          )
        })}
      </div>

      {/* Summary strip */}
      <div className={`mb-6 grid grid-cols-4 gap-px overflow-hidden rounded-[10px] border border-edge bg-edge ${isPending ? 'opacity-60' : ''}`}>
        <SummaryCell label="Projects" value={String(summary.projectCount)} />
        <SummaryCell label="Income Collected" value={formatCurrency(summary.incomeCollected, 'PEN')} />
        <SummaryCell label="Total Costs" value={formatCurrency(summary.totalCosts, 'PEN')} />
        <SummaryCell label="Total Profit" value={formatCurrency(summary.totalProfit, 'PEN')} isProfit />
      </div>

      {/* Partner table */}
      <div className={`overflow-hidden rounded-[10px] border border-edge bg-white ${isPending ? 'opacity-60' : ''}`}>
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
                  <tr key={p.partnerCompanyId} className="transition-colors hover:bg-accent-bg">
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">{p.partnerName}</span>
                      {isYou && (
                        <span className="ml-1.5 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                          you
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {isSingleProject && p.profitSharePct !== null
                        ? `${p.profitSharePct}%`
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
      </div>
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
          ? 'bg-[#edf7f2] text-[#1a7a4a]'
          : 'bg-[#fdf2f1] text-[#c0392b]'
      }`}
    >
      {formatCurrencyCompact(amount, 'PEN')}
    </span>
  )
}
