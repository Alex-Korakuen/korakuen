'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { PROJECT_COST_CATEGORIES, SGA_CATEGORIES } from '@/lib/constants'
import { FilterSelect } from '@/components/ui/filter-select'
import { RateIndicator } from '@/components/ui/rate-indicator'
import type { PLData, PLPeriodMode, PLLineItem, Currency } from '@/lib/types'

type Props = {
  data: PLData
  isAlex: boolean
  periodMode: PLPeriodMode
  year: number
  quarter: number
  month: number
  exchangeRate: { mid_rate: number; rate_date: string } | null
  onParamsChange: (period: PLPeriodMode, year: number, quarter: number, month: number) => void
}

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function PLClient({
  data,
  isAlex,
  periodMode,
  year,
  quarter,
  month,
  exchangeRate,
  onParamsChange,
}: Props) {
  const [incomeExpanded, setIncomeExpanded] = useState(false)
  const [projectCostsExpanded, setProjectCostsExpanded] = useState(false)
  const [sgaExpanded, setSgaExpanded] = useState(false)
  const cur: Currency = 'PEN'
  const showTotal = data.columns.length > 1

  function fmt(amount: number): string {
    if (amount === 0) return '—'
    return formatCurrency(amount, cur)
  }

  function fmtPct(pct: number): string {
    if (pct === 0) return '—'
    return `${pct}%`
  }

  function getVal(mk: string): PLLineItem {
    return data.byMonth[mk]
  }

  function netColorClass(amount: number): string {
    if (amount > 0) return 'text-green-700'
    if (amount < 0) return 'text-red-600'
    return 'text-zinc-600'
  }

  return (
    <div>
      {/* Selectors */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <FilterSelect
          label="Period"
          value={periodMode}
          onChange={(v) => onParamsChange(v as PLPeriodMode, year, quarter, month)}
          options={[
            { value: 'year', label: 'Year' },
            { value: 'quarter', label: 'Quarter' },
            { value: 'month', label: 'Month' },
          ]}
        />

        <FilterSelect
          label="Year"
          value={String(year)}
          onChange={(v) => onParamsChange(periodMode, Number(v), quarter, month)}
          options={[2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) }))}
        />

        {periodMode === 'quarter' && (
          <FilterSelect
            label="Quarter"
            value={String(quarter)}
            onChange={(v) => onParamsChange(periodMode, year, Number(v), month)}
            options={QUARTER_LABELS.map((q, i) => ({ value: String(i + 1), label: q }))}
          />
        )}

        {periodMode === 'month' && (
          <FilterSelect
            label="Month"
            value={String(month)}
            onChange={(v) => onParamsChange(periodMode, year, quarter, Number(v))}
            options={MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))}
          />
        )}
      </div>

      <RateIndicator data={exchangeRate ? { rate: exchangeRate.mid_rate, date: exchangeRate.rate_date } : null} />

      {/* P&L table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="sticky left-0 bg-zinc-50 px-4 py-3 min-w-[200px]"></th>
              {data.columns.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-4 py-3 text-right">
                  {col.label}
                </th>
              ))}
              {showTotal && (
                <th className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right">
                  Total
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {/* === INCOME === */}
            <tr>
              <td
                className="sticky left-0 bg-white whitespace-nowrap px-4 py-3 font-semibold text-green-700 cursor-pointer select-none"
                onClick={() => setIncomeExpanded(!incomeExpanded)}
              >
                <span className="mr-1.5 inline-block w-3 text-zinc-400">{incomeExpanded ? '▼' : '▶'}</span>
                Income
              </td>
              {data.columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-green-700">
                  {fmt(getVal(col.key).income)}
                </td>
              ))}
              {showTotal && (
                <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-semibold text-green-700">
                  {fmt(data.total.income)}
                </td>
              )}
            </tr>

            {/* Income by project (expanded) */}
            {incomeExpanded && data.total.incomeByProject.map((proj) => (
              <tr key={proj.projectCode}>
                <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-2 pl-14 text-xs text-zinc-500">
                  {proj.projectCode} — {proj.projectName}
                </td>
                {data.columns.map((col) => {
                  const projIncome = getVal(col.key).incomeByProject.find(p => p.projectCode === proj.projectCode)
                  return (
                    <td key={col.key} className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs text-zinc-500">
                      {fmt(projIncome?.amount ?? 0)}
                    </td>
                  )
                })}
                {showTotal && (
                  <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-2 text-right font-mono text-xs font-medium text-zinc-600">
                    {fmt(proj.amount)}
                  </td>
                )}
              </tr>
            ))}

            {/* === PROJECT COSTS === */}
            <tr>
              <td
                className="sticky left-0 bg-white whitespace-nowrap px-4 py-3 font-semibold text-zinc-700 cursor-pointer select-none"
                onClick={() => setProjectCostsExpanded(!projectCostsExpanded)}
              >
                <span className="mr-1.5 inline-block w-3 text-zinc-400">{projectCostsExpanded ? '▼' : '▶'}</span>
                Project Costs
              </td>
              {data.columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-700">
                  {getVal(col.key).projectCosts === 0 ? '—' : `(${formatCurrency(getVal(col.key).projectCosts, cur)})`}
                </td>
              ))}
              {showTotal && (
                <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-semibold text-zinc-700">
                  {data.total.projectCosts === 0 ? '—' : `(${formatCurrency(data.total.projectCosts, cur)})`}
                </td>
              )}
            </tr>

            {/* Project costs by category (expanded) */}
            {projectCostsExpanded && PROJECT_COST_CATEGORIES.map((cat) => {
              const totalAmt = data.total.projectCostsByCategory[cat.key] ?? 0
              if (totalAmt === 0 && !data.columns.some(col => (getVal(col.key).projectCostsByCategory[cat.key] ?? 0) > 0)) return null
              return (
                <tr key={cat.key}>
                  <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-2 pl-14 text-xs text-zinc-500">
                    {cat.label}
                  </td>
                  {data.columns.map((col) => (
                    <td key={col.key} className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs text-zinc-500">
                      {fmt(getVal(col.key).projectCostsByCategory[cat.key] ?? 0)}
                    </td>
                  ))}
                  {showTotal && (
                    <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-2 text-right font-mono text-xs font-medium text-zinc-600">
                      {fmt(totalAmt)}
                    </td>
                  )}
                </tr>
              )
            })}

            {/* === GROSS PROFIT === */}
            <tr className="bg-zinc-50/50">
              <td className="sticky left-0 bg-zinc-50/50 whitespace-nowrap px-4 py-3 font-semibold text-zinc-800">
                Gross Profit
              </td>
              {data.columns.map((col) => (
                <td key={col.key} className={`whitespace-nowrap px-4 py-3 text-right font-mono font-medium ${netColorClass(getVal(col.key).grossProfit)}`}>
                  {fmt(getVal(col.key).grossProfit)}
                </td>
              ))}
              {showTotal && (
                <td className={`whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-semibold ${netColorClass(data.total.grossProfit)}`}>
                  {fmt(data.total.grossProfit)}
                </td>
              )}
            </tr>

            {/* Gross Margin % */}
            <tr>
              <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-2 pl-8 text-xs text-zinc-500">
                Gross Margin
              </td>
              {data.columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs text-zinc-500">
                  {fmtPct(getVal(col.key).grossMarginPct)}
                </td>
              ))}
              {showTotal && (
                <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-2 text-right font-mono text-xs font-medium text-zinc-600">
                  {fmtPct(data.total.grossMarginPct)}
                </td>
              )}
            </tr>

            {/* === SG&A === */}
            <tr>
              <td
                className="sticky left-0 bg-white whitespace-nowrap px-4 py-3 font-semibold text-zinc-700 cursor-pointer select-none"
                onClick={() => setSgaExpanded(!sgaExpanded)}
              >
                <span className="mr-1.5 inline-block w-3 text-zinc-400">{sgaExpanded ? '▼' : '▶'}</span>
                SG&A
              </td>
              {data.columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-700">
                  {getVal(col.key).sga === 0 ? '—' : `(${formatCurrency(getVal(col.key).sga, cur)})`}
                </td>
              ))}
              {showTotal && (
                <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-semibold text-zinc-700">
                  {data.total.sga === 0 ? '—' : `(${formatCurrency(data.total.sga, cur)})`}
                </td>
              )}
            </tr>

            {/* SG&A by category (expanded) */}
            {sgaExpanded && SGA_CATEGORIES.map((cat) => {
              const totalAmt = data.total.sgaByCategory[cat.key] ?? 0
              if (totalAmt === 0 && !data.columns.some(col => (getVal(col.key).sgaByCategory[cat.key] ?? 0) > 0)) return null
              return (
                <tr key={cat.key}>
                  <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-2 pl-14 text-xs text-zinc-500">
                    {cat.label}
                  </td>
                  {data.columns.map((col) => (
                    <td key={col.key} className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs text-zinc-500">
                      {fmt(getVal(col.key).sgaByCategory[cat.key] ?? 0)}
                    </td>
                  ))}
                  {showTotal && (
                    <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-2 text-right font-mono text-xs font-medium text-zinc-600">
                      {fmt(totalAmt)}
                    </td>
                  )}
                </tr>
              )
            })}

            {/* === NET PROFIT === */}
            <tr className="bg-zinc-50">
              <td className="sticky left-0 bg-zinc-50 whitespace-nowrap px-4 py-3 font-semibold text-zinc-800">
                Net Profit
              </td>
              {data.columns.map((col) => (
                <td key={col.key} className={`whitespace-nowrap px-4 py-3 text-right font-mono font-semibold ${netColorClass(getVal(col.key).netProfit)}`}>
                  {fmt(getVal(col.key).netProfit)}
                </td>
              ))}
              {showTotal && (
                <td className={`whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-3 text-right font-mono font-bold ${netColorClass(data.total.netProfit)}`}>
                  {fmt(data.total.netProfit)}
                </td>
              )}
            </tr>

            {/* Net Margin % */}
            <tr>
              <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-2 pl-8 text-xs text-zinc-500">
                Net Margin
              </td>
              {data.columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs text-zinc-500">
                  {fmtPct(getVal(col.key).netMarginPct)}
                </td>
              ))}
              {showTotal && (
                <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-2 text-right font-mono text-xs font-medium text-zinc-600">
                  {fmtPct(data.total.netMarginPct)}
                </td>
              )}
            </tr>

            {/* === ALEX PERSONAL POSITION (Alex-only) === */}
            {isAlex && data.alexProfitShare !== null && (
              <>
                <tr>
                  <td colSpan={data.columns.length + (showTotal ? 2 : 1)} className="border-t-2 border-zinc-300 px-4 py-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Personal Position</span>
                  </td>
                </tr>
                <tr>
                  <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-2 text-sm text-zinc-700">
                    Profit Share
                  </td>
                  <td colSpan={data.columns.length - (showTotal ? 0 : 1)} />
                  {showTotal && (
                    <td className={`whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-2 text-right font-mono font-medium ${netColorClass(data.alexProfitShare)}`}>
                      {fmt(data.alexProfitShare)}
                    </td>
                  )}
                  {!showTotal && (
                    <td className={`whitespace-nowrap px-4 py-2 text-right font-mono font-medium ${netColorClass(data.alexProfitShare)}`}>
                      {fmt(data.alexProfitShare)}
                    </td>
                  )}
                </tr>
                <tr>
                  <td className="sticky left-0 bg-white whitespace-nowrap px-4 py-2 text-sm text-zinc-700">
                    Loan Obligations
                  </td>
                  <td colSpan={data.columns.length - (showTotal ? 0 : 1)} />
                  {showTotal && (
                    <td className="whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-2 text-right font-mono font-medium text-red-600">
                      {data.loanObligations ? `(${formatCurrency(data.loanObligations, cur)})` : '—'}
                    </td>
                  )}
                  {!showTotal && (
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-medium text-red-600">
                      {data.loanObligations ? `(${formatCurrency(data.loanObligations, cur)})` : '—'}
                    </td>
                  )}
                </tr>
                <tr className="bg-zinc-50">
                  <td className="sticky left-0 bg-zinc-50 whitespace-nowrap px-4 py-2 text-sm font-semibold text-zinc-800">
                    Net after Obligations
                  </td>
                  <td colSpan={data.columns.length - (showTotal ? 0 : 1)} />
                  {(() => {
                    const net = (data.alexProfitShare ?? 0) - (data.loanObligations ?? 0)
                    return showTotal ? (
                      <td className={`whitespace-nowrap border-l border-zinc-200 bg-zinc-100 px-4 py-2 text-right font-mono font-semibold ${netColorClass(net)}`}>
                        {fmt(net)}
                      </td>
                    ) : (
                      <td className={`whitespace-nowrap px-4 py-2 text-right font-mono font-semibold ${netColorClass(net)}`}>
                        {fmt(net)}
                      </td>
                    )
                  })()}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        Amounts are accrual-based (when invoiced/recorded, not when paid).
        {' '}USD transactions converted at historical transaction-date exchange rate.
      </p>
    </div>
  )
}
