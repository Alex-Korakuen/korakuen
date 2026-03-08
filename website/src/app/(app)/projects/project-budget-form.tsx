'use client'

import { useMemo, useState, useTransition } from 'react'
import { formatCurrency, formatCategory } from '@/lib/formatters'
import { SectionCard } from '@/components/ui/section-card'
import { upsertProjectBudget, removeProjectBudget } from '@/lib/actions'
import type { BudgetVsActualRow, Currency } from '@/lib/types'
import type { CategoryOption } from '@/lib/queries'
import { inputCompactClass } from '@/lib/styles'

type Props = {
  projectId: string
  budgetRows: BudgetVsActualRow[]
  contractValue: number | null
  contractCurrency: Currency
  categories: CategoryOption[]
}

export function ProjectBudgetForm({
  projectId,
  budgetRows,
  contractValue,
  contractCurrency,
  categories,
}: Props) {
  const hasBudget = useMemo(
    () => budgetRows.some((b) => b.budgeted_amount !== null && b.budgeted_amount > 0),
    [budgetRows]
  )
  const totalActual = useMemo(
    () => budgetRows.reduce((sum, b) => sum + (b.actual_amount ?? 0), 0),
    [budgetRows]
  )
  const totalBudgeted = useMemo(
    () => hasBudget ? budgetRows.reduce((sum, b) => sum + (b.budgeted_amount ?? 0), 0) : null,
    [budgetRows, hasBudget]
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newAmount, setNewAmount] = useState('')

  // Categories already used in budget rows
  const usedCategories = new Set(budgetRows.map(b => b.category))
  const availableCategories = categories.filter(c => !usedCategories.has(c.name))

  function handleEditStart(category: string, currentAmount: number | null) {
    setEditingCategory(category)
    setEditValue(currentAmount !== null ? String(currentAmount) : '')
  }

  function handleEditSave(category: string) {
    const amount = parseFloat(editValue)
    if (isNaN(amount) || amount < 0) return
    setError(null)

    startTransition(async () => {
      try {
        await upsertProjectBudget(projectId, category, amount, contractCurrency)
        setEditingCategory(null)
        setEditValue('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save budget')
      }
    })
  }

  function handleEditCancel() {
    setEditingCategory(null)
    setEditValue('')
  }

  function handleAdd() {
    if (!newCategory || !newAmount) return
    const amount = parseFloat(newAmount)
    if (isNaN(amount) || amount <= 0) return
    setError(null)

    startTransition(async () => {
      try {
        await upsertProjectBudget(projectId, newCategory, amount, contractCurrency)
        setNewCategory('')
        setNewAmount('')
        setShowAddForm(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add budget')
      }
    })
  }

  function handleRemove(category: string) {
    startTransition(async () => {
      try {
        await removeProjectBudget(projectId, category)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove budget')
      }
    })
  }

  return (
    <SectionCard title="Costs & Budget">
      {budgetRows.length === 0 && !showAddForm ? (
        <div className="px-4 py-6 text-center text-sm text-zinc-400">
          No cost data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Category</th>
                <th className="px-4 py-2 text-right font-medium">Budgeted</th>
                <th className="px-4 py-2 text-right font-medium">Actual</th>
                {hasBudget && (
                  <th className="px-4 py-2 text-right font-medium">% Used</th>
                )}
                {contractValue !== null && (
                  <th className="px-4 py-2 text-right font-medium">% of Contract</th>
                )}
                <th className="px-4 py-2 text-right font-medium w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {budgetRows.map((b, i) => {
                const category = b.category ?? `uncategorized-${i}`
                const actual = b.actual_amount ?? 0
                const pctUsed = b.pct_used ?? 0
                const pctOfContract =
                  contractValue !== null && contractValue > 0
                    ? (actual / contractValue) * 100
                    : null
                const isEditing = editingCategory === category

                return (
                  <tr key={`${category}-${i}`}>
                    <td className="px-4 py-2 font-medium text-zinc-800">
                      {formatCategory(b.category)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave(category)
                            if (e.key === 'Escape') handleEditCancel()
                          }}
                          onBlur={() => {
                            const newAmount = parseFloat(editValue)
                            if (newAmount === b.budgeted_amount) {
                              handleEditCancel()
                            } else {
                              handleEditSave(category)
                            }
                          }}
                          autoFocus
                          step="0.01"
                          min="0"
                          className="w-24 rounded border border-blue-300 px-1 py-0.5 text-right text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      ) : (
                        <button
                          onClick={() => handleEditStart(category, b.budgeted_amount)}
                          className="cursor-pointer rounded px-1 py-0.5 hover:bg-blue-50"
                          title="Click to edit budget"
                        >
                          {b.budgeted_amount !== null
                            ? formatCurrency(b.budgeted_amount, contractCurrency)
                            : <span className="text-zinc-400">Set budget</span>}
                        </button>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(actual, contractCurrency)}
                    </td>
                    {hasBudget && (
                      <td
                        className={`whitespace-nowrap px-4 py-2 text-right font-mono font-medium ${pctUsedColor(
                          pctUsed,
                          b.budgeted_amount
                        )}`}
                      >
                        {b.budgeted_amount !== null && b.budgeted_amount > 0
                          ? `${pctUsed.toFixed(1)}%`
                          : '--'}
                      </td>
                    )}
                    {contractValue !== null && (
                      <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-600">
                        {pctOfContract !== null ? `${pctOfContract.toFixed(1)}%` : '--'}
                      </td>
                    )}
                    <td className="px-4 py-2 text-right">
                      {b.budgeted_amount !== null && (
                        <button
                          onClick={() => handleRemove(category)}
                          disabled={isPending}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50">
                <td className="px-4 py-2 font-medium text-zinc-700">Total</td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                  {totalBudgeted !== null
                    ? formatCurrency(totalBudgeted, contractCurrency)
                    : '--'}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                  {formatCurrency(totalActual, contractCurrency)}
                </td>
                {hasBudget && (
                  <td
                    className={`whitespace-nowrap px-4 py-2 text-right font-mono font-semibold ${
                      totalBudgeted !== null && totalBudgeted > 0
                        ? pctUsedColor((totalActual / totalBudgeted) * 100, totalBudgeted)
                        : 'text-zinc-700'
                    }`}
                  >
                    {totalBudgeted !== null && totalBudgeted > 0
                      ? `${((totalActual / totalBudgeted) * 100).toFixed(1)}%`
                      : '--'}
                  </td>
                )}
                {contractValue !== null && (
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-700">
                    {contractValue > 0
                      ? `${((totalActual / contractValue) * 100).toFixed(1)}%`
                      : '--'}
                  </td>
                )}
                <td className="px-4 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add budget row */}
      <div className="px-4 py-2">
        {showAddForm ? (
          <div className="space-y-2 border-t border-zinc-100 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className={inputCompactClass}
              >
                <option value="">Select category...</option>
                {availableCategories.map((c) => (
                  <option key={c.name} value={c.name}>{formatCategory(c.name)}</option>
                ))}
              </select>
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="Amount"
                step="0.01"
                min="0"
                className={`${inputCompactClass} font-mono`}
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newCategory || !newAmount || isPending}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setError(null) }}
                className="rounded px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            disabled={availableCategories.length === 0}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:text-zinc-400"
          >
            + Add budget category
          </button>
        )}
      </div>
    </SectionCard>
  )
}

// --- Helpers ---

function pctUsedColor(pct: number, budgeted: number | null): string {
  if (budgeted === null || budgeted === 0) return 'text-zinc-600'
  if (pct > 100) return 'text-red-600'
  if (pct > 90) return 'text-amber-600'
  return 'text-green-600'
}
