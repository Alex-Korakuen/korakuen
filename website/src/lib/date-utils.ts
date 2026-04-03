/** Returns today's date as an ISO string (YYYY-MM-DD). */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** Maps days remaining to a calendar urgency bucket. */
export function getCalendarBucket(
  daysRemaining: number | null,
): 'overdue' | 'today' | 'next-7' | 'next-30' | 'later' {
  if (daysRemaining === null || daysRemaining < 0) return 'overdue'
  if (daysRemaining === 0) return 'today'
  if (daysRemaining <= 7) return 'next-7'
  if (daysRemaining <= 30) return 'next-30'
  return 'later'
}

/** Converts a "YYYY-MM" month string to dateFrom/dateTo range. */
export function getMonthDateRange(month: string): { dateFrom: string; dateTo: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(`Invalid month format: "${month}". Expected YYYY-MM.`)
  }
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}


