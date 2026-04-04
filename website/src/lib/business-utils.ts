/** Calculate percentage of budget used. Returns null if no budget set. */
export function calcPercentUsed(actual: number, budgeted: number | null): number | null {
  if (!budgeted || budgeted <= 0) return null
  return Math.round((actual / budgeted) * 1000) / 10
}

/** Calculate days overdue from a due date string (YYYY-MM-DD). Returns 0 if no due date. */
export function calcDaysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0
  return Math.floor(
    (Date.now() - new Date(dueDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)
  )
}

