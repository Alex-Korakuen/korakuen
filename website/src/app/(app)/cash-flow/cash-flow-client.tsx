'use client'

import { useMemo } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { FilterSelect } from '@/components/ui/filter-select'
import { getNetColorClass } from './helpers'
import { RateIndicator } from '@/components/ui/rate-indicator'
import type { CashFlowData, Currency } from '@/lib/types'

type Props = {
  initialData: CashFlowData
  projects: { id: string; project_code: string; name: string }[]
  year: number
  projectId: string | null
  exchangeRate: { mid_rate: number; rate_date: string } | null
  onParamsChange: (year: number, projectId: string | null) => void
}

export function CashFlowClient({
  initialData,
  projects,
  year,
  projectId,
  exchangeRate,
  onParamsChange,
}: Props) {
  const data = initialData
  const cur: Currency = 'PEN'

  // Find first forecast month index for separator
  const firstForecastIdx = data.months.findIndex((m) => !m.isActual)

  // Totals
  const totals = useMemo(() => {
    const t = {
      cashIn: 0,
      loansCashIn: 0,
      cashInByProject: {} as Record<string, number>,
      materials: 0,
      labor: 0,
      subcontractor: 0,
      equipment: 0,
      other: 0,
      projectCosts: 0,
      sga: 0,
      loanRepayment: 0,
      cashOut: 0,
      net: 0,
    }
    for (const m of data.months) {
      t.cashIn += m.cashIn
      t.loansCashIn += m.loansCashIn
      t.materials += m.materials
      t.labor += m.labor
      t.subcontractor += m.subcontractor
      t.equipment += m.equipment
      t.other += m.other
      t.projectCosts += m.projectCosts
      t.sga += m.sga
      t.loanRepayment += m.loanRepayment
      t.cashOut += m.cashOut
      t.net += m.net
      for (const [pid, amt] of Object.entries(m.cashInByProject)) {
        t.cashInByProject[pid] = (t.cashInByProject[pid] ?? 0) + amt
      }
    }
    return t
  }, [data.months])

  function formatAmount(amount: number): string {
    if (amount === 0) return '--'
    return formatCurrency(amount, cur)
  }

  function forecastBorder(idx: number): string {
    return idx === firstForecastIdx && firstForecastIdx > 0
      ? ' border-l-2 border-dashed border-zinc-300'
      : ''
  }

  function forecastBg(isActual: boolean, isCurrentMonth?: boolean): string {
    if (isCurrentMonth) return ' bg-amber-50/60'
    return !isActual ? ' bg-zinc-50/50' : ''
  }

  // Cash Out category rows
  const cashOutRows = [
    { key: 'materials' as const, label: 'Materials' },
    { key: 'labor' as const, label: 'Labor' },
    { key: 'subcontractor' as const, label: 'Subcontractor' },
    { key: 'equipment' as const, label: 'Equipment' },
    { key: 'other' as const, label: 'Other' },
    { key: 'sga' as const, label: 'SG&A' },
  ].filter((row) => totals[row.key] !== 0)

  return (
    <div>
      {/* Selectors */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <FilterSelect
          label="Scope"
          value={projectId ?? ''}
          onChange={(v) => onParamsChange(year, v || null)}
          options={projects.map((p) => ({ value: p.id, label: `${p.project_code} — ${p.name}` }))}
          placeholder="All Projects"
        />

        <FilterSelect
          label="Year"
          value={String(year)}
          onChange={(v) => onParamsChange(Number(v), projectId)}
          options={[2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) }))}
        />
      </div>

      <RateIndicator data={exchangeRate ? { rate: exchangeRate.mid_rate, date: exchangeRate.rate_date } : null} />

      {/* Monthly table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="sticky left-0 bg-zinc-50 px-4 py-3"></th>
              {data.months.map((m, idx) => (
                <th
                  key={m.month}
                  className={`whitespace-nowrap px-4 py-3 text-right ${
                    m.isCurrentMonth ? 'text-amber-700 font-semibold' : !m.isActual ? 'text-zinc-400' : ''
                  }${forecastBorder(idx)}`}
                >
                  {m.label}
                </th>
              ))}
              <th className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {/* === CASH IN header === */}
            <tr>
              <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-3 font-semibold text-green-700">
                Cash In
              </td>
              {data.months.map((m, idx) => (
                <td
                  key={m.month}
                  className={`whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-green-700${forecastBg(m.isActual, m.isCurrentMonth)}${forecastBorder(idx)}`}
                >
                  {formatAmount(m.cashIn)}
                </td>
              ))}
              <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-semibold text-green-700">
                {formatAmount(totals.cashIn)}
              </td>
            </tr>

            {/* One row per project */}
            {data.projects.map((proj) => (
              <tr key={proj.id}>
                <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-3 pl-8 text-zinc-600">
                  {proj.code}
                </td>
                {data.months.map((m, idx) => (
                  <td
                    key={m.month}
                    className={`whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600${forecastBg(m.isActual, m.isCurrentMonth)}${forecastBorder(idx)}`}
                  >
                    {formatAmount(m.cashInByProject[proj.id] ?? 0)}
                  </td>
                ))}
                <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-medium text-zinc-700">
                  {formatAmount(totals.cashInByProject[proj.id] ?? 0)}
                </td>
              </tr>
            ))}

            {/* Loans received */}
            {totals.loansCashIn !== 0 && (
              <tr>
                <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-3 pl-8 text-zinc-600">
                  Loans
                </td>
                {data.months.map((m, idx) => (
                  <td
                    key={m.month}
                    className={`whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600${forecastBg(m.isActual, m.isCurrentMonth)}${forecastBorder(idx)}`}
                  >
                    {formatAmount(m.loansCashIn)}
                  </td>
                ))}
                <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-medium text-zinc-700">
                  {formatAmount(totals.loansCashIn)}
                </td>
              </tr>
            )}

            {/* === CASH OUT header === */}
            <tr className="border-t border-zinc-200">
              <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-3 font-semibold text-zinc-700">
                Cash Out
              </td>
              {data.months.map((m, idx) => (
                <td
                  key={m.month}
                  className={`whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-700${forecastBg(m.isActual, m.isCurrentMonth)}${forecastBorder(idx)}`}
                >
                  {formatAmount(m.cashOut)}
                </td>
              ))}
              <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                {formatAmount(totals.cashOut)}
              </td>
            </tr>

            {/* One row per cost type */}
            {cashOutRows.map((row) => (
              <tr key={row.key}>
                <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-3 pl-8 text-zinc-600">
                  {row.label}
                </td>
                {data.months.map((m, idx) => (
                  <td
                    key={m.month}
                    className={`whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600${forecastBg(m.isActual, m.isCurrentMonth)}${forecastBorder(idx)}`}
                  >
                    {formatAmount(m[row.key])}
                  </td>
                ))}
                <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-medium text-zinc-700">
                  {formatAmount(totals[row.key])}
                </td>
              </tr>
            ))}

            {/* Loan repayment */}
            {totals.loanRepayment !== 0 && (
              <tr>
                <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-3 pl-8 text-zinc-600">
                  Loans
                </td>
                {data.months.map((m, idx) => (
                  <td
                    key={m.month}
                    className={`whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600${forecastBg(m.isActual, m.isCurrentMonth)}${forecastBorder(idx)}`}
                  >
                    {formatAmount(m.loanRepayment)}
                  </td>
                ))}
                <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-medium text-zinc-700">
                  {formatAmount(totals.loanRepayment)}
                </td>
              </tr>
            )}

            {/* === NET row === */}
            <tr className="bg-zinc-50">
              <td className="sticky left-0 bg-zinc-50 whitespace-nowrap px-4 py-3 font-semibold text-zinc-700">
                Net
              </td>
              {data.months.map((m, idx) => (
                <td
                  key={m.month}
                  className={`whitespace-nowrap px-4 py-3 text-right font-mono ${getNetColorClass(m.net)}${forecastBorder(idx)}`}
                >
                  {m.net === 0 ? '--' : formatCurrency(m.net, cur)}
                </td>
              ))}
              <td className={`whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-semibold ${getNetColorClass(totals.net)}`}>
                {formatCurrency(totals.net, cur)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        Actual months reflect payments made. Forecast months use due dates from outstanding costs and AR invoices.
        Loan disbursements and repayment obligations included.
        {' '}Actual months: USD converted at transaction-date rate. Forecast months: USD converted at latest exchange rate.
      </p>
    </div>
  )
}
