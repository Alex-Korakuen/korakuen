'use client'

import { useMemo, useState, useTransition } from 'react'
import { formatCurrency, formatCategory } from '@/lib/formatters'
import { upsertProjectBudget, removeProjectBudget } from '@/lib/actions'
import type { BudgetVsActualRow, CategoryOption } from '@/lib/types'
import { inputCompactClass, iconTrash } from '@/lib/styles'

type Props = {
  projectId: string
  budgetRows: BudgetVsActualRow[]
  contractValue: number | null
  contractCurrency: string
  categories: CategoryOption[]
  showAddForm: boolean
  onHideAddForm: () => void
}

export function ProjectBudgetForm({
  projectId,
  budgetRows,
  contractValue,
  contractCurrency,
  categories,
  showAddForm,
  onHideAddForm,
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

  function handleAdd() {
    if (!newCategory || !newAmount) return
    const amount = parseFloat(newAmount)
    if (isNaN(amount) || amount <= 0) return
    setError(null)

    startTransition(async () => {
      const result = await upsertProjectBudget(projectId, newCategory, amount, contractCurrency)
      if (result.error) {
        setError(result.error)
      } else {
        setNewCategory('')
        setNewAmount('')
        onHideAddForm()
      }
    })
  }

  function handleRemove(category: string) {
    startTransition(async () => {
      const result = await removeProjectBudget(projectId, category)
      if (result.error) setError(result.error)
    })
  }

  return (
    <>
      {budgetRows.length === 0 && !showAddForm ? (
        <div className="px-4 py-6 text-center text-sm text-zinc-400">
          No cost data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-100">
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-2 py-2 text-right font-medium">Budgeted</th>
                <th className="px-2 py-2 text-right font-medium">Actual</th>
                {hasBudget && (
                  <th className="px-2 py-2 text-right font-medium">% Used</th>
                )}
                <th className="px-2 py-2 text-right font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {budgetRows.map((b, i) => {
                const category = b.category ?? `uncategorized-${i}`
                const actual = b.actual_amount ?? 0
                const pctUsed = b.pct_used ?? 0
                const isEditing = editingCategory === category

                return (
                  <tr key={`${category}-${i}`} className="group">
                    <td className="px-3 py-2 font-medium text-zinc-800">
                      {formatCategory(b.category)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-zinc-700">
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
                    <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(actual, contractCurrency)}
                    </td>
                    {hasBudget && (
                      <td
                        className={`whitespace-nowrap px-2 py-2 text-right font-mono font-medium ${pctUsedColor(
                          pctUsed,
                          b.budgeted_amount
                        )}`}
                      >
                        {b.budgeted_amount !== null && b.budgeted_amount > 0
                          ? `${pctUsed.toFixed(1)}%`
                          : '--'}
                      </td>
                    )}
                    <td className="px-2 py-2 text-right">
                      {b.budgeted_amount !== null && (
                        <button
                          onClick={() => handleRemove(category)}
                          disabled={isPending}
                          className="text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600 disabled:opacity-50"
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
              <tr className="border-t border-zinc-200 bg-zinc-50/50">
                <td className="px-3 py-2 font-medium text-zinc-700">Total</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-semibold text-zinc-800">
                  {totalBudgeted !== null
                    ? formatCurrency(totalBudgeted, contractCurrency)
                    : '--'}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-semibold text-zinc-800">
                  {formatCurrency(totalActual, contractCurrency)}
                </td>
                {hasBudget && (
                  <td
                    className={`whitespace-nowrap px-2 py-2 text-right font-mono font-semibold ${
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
                <td className="px-2 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add budget inline form */}
      {showAddForm && (
        <div className="px-4 py-2">
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
                onClick={() => { onHideAddForm(); setError(null) }}
                className="rounded px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// --- Helpers ---

function pctUsedColor(pct: number, budgeted: number | null): string {
  if (budgeted === null || budgeted === 0) return 'text-zinc-600'
  if (pct > 100) return 'text-red-600'
  if (pct > 90) return 'text-amber-600'
  return 'text-green-600'
}
