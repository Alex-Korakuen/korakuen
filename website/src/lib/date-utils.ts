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

/** Maps a payment date to a recency bucket (past-looking). */
export function getPaymentBucket(dateStr: string): 'today' | 'last-7' | 'last-30' | 'previous' {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  const daysAgo = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (daysAgo <= 0) return 'today'
  if (daysAgo <= 7) return 'last-7'
  if (daysAgo <= 30) return 'last-30'
  return 'previous'
}

