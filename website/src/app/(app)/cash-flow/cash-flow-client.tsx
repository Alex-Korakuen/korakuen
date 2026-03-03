'use client'

import { useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { getNetColorClass, getCumulativeColorClass } from './helpers'
import type { CashFlowData, Currency } from '@/lib/types'

type Props = {
  initialData: CashFlowData
  projects: { id: string; project_code: string; name: string }[]
  isAlex: boolean
  year: number
  projectId: string | null
  currency: Currency
  onParamsChange: (year: number, projectId: string | null, currency: Currency) => void
}

export function CashFlowClient({
  initialData,
  projects,
  isAlex,
  year,
  projectId,
  currency,
  onParamsChange,
}: Props) {
  const data = initialData
  const cur = currency

  // Find first forecast month index for separator
  const firstForecastIdx = data.months.findIndex((m) => !m.isActual)

  // Totals row
  const totals = useMemo(() => {
    return data.months.reduce(
      (acc, m) => ({
        cashIn: acc.cashIn + m.cashIn,
        materials: acc.materials + m.materials,
        labor: acc.labor + m.labor,
        subcontractor: acc.subcontractor + m.subcontractor,
        equipment: acc.equipment + m.equipment,
        other: acc.other + m.other,
        loans: acc.loans + m.loans,
        cashOut: acc.cashOut + m.cashOut,
        net: acc.net + m.net,
      }),
      {
        cashIn: 0, materials: 0, labor: 0, subcontractor: 0,
        equipment: 0, other: 0, loans: 0, cashOut: 0, net: 0,
      }
    )
  }, [data.months])

  function formatAmount(amount: number): string {
    if (amount === 0) return '--'
    return formatCurrency(amount, cur)
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-800">Cash Flow</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Actual cash movements and forecast
      </p>

      {/* Selectors */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Scope</label>
          <select
            value={projectId ?? ''}
            onChange={(e) => onParamsChange(year, e.target.value || null, currency)}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_code} — {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Year</label>
          <select
            value={year}
            onChange={(e) => onParamsChange(Number(e.target.value), projectId, currency)}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Currency</label>
          <select
            value={currency}
            onChange={(e) => onParamsChange(year, projectId, e.target.value as Currency)}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
          >
            <option value="PEN">PEN</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {/* Cash shortfall warning */}
      {data.hasShortfall && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            Cash shortfall risk — cumulative goes negative in {data.shortfallMonth}
          </p>
        </div>
      )}

      {/* Monthly table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3 text-right">Cash In</th>
              <th className="px-4 py-3 text-right">Materials</th>
              <th className="px-4 py-3 text-right">Labor</th>
              <th className="px-4 py-3 text-right">Subcontr.</th>
              <th className="px-4 py-3 text-right">Equip.</th>
              <th className="px-4 py-3 text-right">Other</th>
              {isAlex && <th className="px-4 py-3 text-right">Loans</th>}
              <th className="px-4 py-3 text-right">Cash Out</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-right">Cumulative</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.months.map((m, idx) => {
              // Insert forecast separator row
              const showSeparator = idx === firstForecastIdx && firstForecastIdx > 0

              return [
                showSeparator && (
                  <tr key={`sep-${idx}`}>
                    <td
                      colSpan={isAlex ? 11 : 10}
                      className="border-t-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400"
                    >
                      Forecast
                    </td>
                  </tr>
                ),
                <tr
                  key={m.month}
                  className={!m.isActual ? 'bg-zinc-50/50' : ''}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-700">
                    {m.label}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-green-700">
                    {formatAmount(m.cashIn)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                    {formatAmount(m.materials)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                    {formatAmount(m.labor)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                    {formatAmount(m.subcontractor)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                    {formatAmount(m.equipment)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                    {formatAmount(m.other)}
                  </td>
                  {isAlex && (
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-600">
                      {formatAmount(m.loans)}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium text-zinc-700">
                    {formatAmount(m.cashOut)}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-mono ${getNetColorClass(m.net)}`}>
                    {m.net === 0 ? '--' : formatCurrency(m.net, cur)}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-mono ${getCumulativeColorClass(m.cumulative, !m.isActual)}`}>
                    {formatCurrency(m.cumulative, cur)}
                  </td>
                </tr>,
              ]
            })}
            {/* Total row */}
            <tr className="bg-zinc-100 font-medium">
              <td className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">Total</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-green-700">
                {formatAmount(totals.cashIn)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                {formatAmount(totals.materials)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                {formatAmount(totals.labor)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                {formatAmount(totals.subcontractor)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                {formatAmount(totals.equipment)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                {formatAmount(totals.other)}
              </td>
              {isAlex && (
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-zinc-700">
                  {formatAmount(totals.loans)}
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                {formatAmount(totals.cashOut)}
              </td>
              <td className={`whitespace-nowrap px-4 py-3 text-right font-mono font-semibold ${getNetColorClass(totals.net)}`}>
                {formatCurrency(totals.net, cur)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        Actual months reflect payments made. Forecast months use due dates from outstanding costs and AR invoices.
        {isAlex && ' Loan obligations included in forecast.'}
      </p>
    </div>
  )
}
