'use client'

import { useMemo, useState, useTransition } from 'react'
import { formatCurrency, formatCategory } from '@/lib/formatters'
import { upsertProjectBudget, removeProjectBudget } from '@/lib/actions'
import type { BudgetVsActualRow, CategoryOption } from '@/lib/types'
import { iconTrash } from '@/lib/styles'

type Props = {
  projectId: string
  budgetRows: BudgetVsActualRow[]
  contractValue: number | null
  contractCurrency: string
  categories: CategoryOption[]
  actualCostsByCategory: Record<string, number>
}

type DisplayRow = {
  category: string
  budgeted_amount: number | null
  actual_amount: number
  pct_used: number | null
  notes: string | null
}

export function ProjectBudgetForm({
  projectId,
  budgetRows,
  contractValue,
  contractCurrency,
  categories,
  actualCostsByCategory,
}: Props) {
  // Merge all categories with budget data and actual costs
  const displayRows = useMemo(() => {
    const budgetMap = new Map(budgetRows.map(b => [b.category, b]))
    return categories.map(c => {
      const budgetRow = budgetMap.get(c.name)
      const actual = budgetRow?.actual_amount ?? actualCostsByCategory[c.name] ?? 0
      const budgeted = budgetRow?.budgeted_amount ?? null
      const pctUsed = budgeted && budgeted > 0
        ? Math.round((actual / budgeted) * 1000) / 10
        : null
      return {
        category: c.name,
        budgeted_amount: budgeted,
        actual_amount: actual,
        pct_used: pctUsed,
        notes: budgetRow?.notes ?? null,
      } satisfies DisplayRow
    })
  }, [budgetRows, categories, actualCostsByCategory])

  const hasBudget = useMemo(
    () => displayRows.some((b) => b.budgeted_amount !== null && b.budgeted_amount > 0),
    [displayRows]
  )
  const totalActual = useMemo(
    () => displayRows.reduce((sum, b) => sum + b.actual_amount, 0),
    [displayRows]
  )
  const totalBudgeted = useMemo(
    () => hasBudget ? displayRows.reduce((sum, b) => sum + (b.budgeted_amount ?? 0), 0) : null,
    [displayRows, hasBudget]
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  function handleEditStart(category: string, currentAmount: number | null) {
    setEditingCategory(category)
    setEditValue(currentAmount !== null ? String(currentAmount) : '')
  }

  function handleEditSave(category: string) {
    const amount = parseFloat(editValue)
    if (isNaN(amount) || amount < 0) return
    setError(null)

    startTransition(async () => {
      const result = await upsertProjectBudget(projectId, category, amount, contractCurrency)
      if (result.error) {
        setError(result.error)
      } else {
        setEditingCategory(null)
        setEditValue('')
      }
    })
  }

  function handleEditCancel() {
    setEditingCategory(null)
    setEditValue('')
  }

  function handleRemove(category: string) {
    startTransition(async () => {
      const result = await removeProjectBudget(projectId, category)
      if (result.error) setError(result.error)
    })
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-edge">
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-2 py-2 text-right font-medium">Budgeted</th>
              <th className="px-2 py-2 text-right font-medium">Actual</th>
              {hasBudget && (
                <th className="px-2 py-2 text-right font-medium">% Used</th>
              )}
              <th className="px-2 py-2 text-right font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {displayRows.map((b) => {
              const isEditing = editingCategory === b.category

              return (
                <tr key={b.category} className="group">
                  <td className="px-3 py-2 font-medium text-ink">
                    {formatCategory(b.category)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-ink">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') handleEditCancel()
                        }}
                        onBlur={() => {
                          const newAmount = parseFloat(editValue)
                          if (newAmount === b.budgeted_amount) {
                            handleEditCancel()
                          } else {
                            handleEditSave(b.category)
                          }
                        }}
                        autoFocus
                        step="0.01"
                        min="0"
                        className="w-24 rounded border border-accent/30 px-1 py-0.5 text-right text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    ) : (
                      <button
                        onClick={() => handleEditStart(b.category, b.budgeted_amount)}
                        className="cursor-pointer rounded px-1 py-0.5 hover:bg-accent-bg"
                        title="Click to edit budget"
                      >
                        {b.budgeted_amount !== null
                          ? formatCurrency(b.budgeted_amount, contractCurrency)
                          : <span className="text-faint">Set budget</span>}
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-ink">
                    {formatCurrency(b.actual_amount, contractCurrency)}
                  </td>
                  {hasBudget && (
                    <td
                      className={`whitespace-nowrap px-2 py-2 text-right font-mono font-medium ${pctUsedColor(
                        b.pct_used ?? 0,
                        b.budgeted_amount
                      )}`}
                    >
                      {b.budgeted_amount !== null && b.budgeted_amount > 0
                        ? `${(b.pct_used ?? 0).toFixed(1)}%`
                        : '--'}
                    </td>
                  )}
                  <td className="px-2 py-2 text-right">
                    {b.budgeted_amount !== null && (
                      <button
                        onClick={() => handleRemove(b.category)}
                        disabled={isPending}
                        className="text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-negative disabled:opacity-50"
                        title="Remove budget"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d={iconTrash} clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-edge bg-panel/50">
              <td className="px-3 py-2 font-medium text-ink">Total</td>
              <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-semibold text-ink">
                {totalBudgeted !== null
                  ? formatCurrency(totalBudgeted, contractCurrency)
                  : '--'}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-semibold text-ink">
                {formatCurrency(totalActual, contractCurrency)}
              </td>
              {hasBudget && (
                <td
                  className={`whitespace-nowrap px-2 py-2 text-right font-mono font-semibold ${
                    totalBudgeted !== null && totalBudgeted > 0
                      ? pctUsedColor((totalActual / totalBudgeted) * 100, totalBudgeted)
                      : 'text-ink'
                  }`}
                >
                  {totalBudgeted !== null && totalBudgeted > 0
                    ? `${((totalActual / totalBudgeted) * 100).toFixed(1)}%`
                    : '--'}
                </td>
              )}
              <td className="px-2 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {error && <p className="px-4 pb-2 text-xs text-negative">{error}</p>}
    </>
  )
}

// --- Helpers ---

function pctUsedColor(pct: number, budgeted: number | null): string {
  if (budgeted === null || budgeted === 0) return 'text-muted'
  if (pct > 100) return 'text-negative'
  if (pct > 90) return 'text-caution'
  return 'text-positive'
}
