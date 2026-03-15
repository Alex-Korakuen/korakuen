/** Returns days remaining until end of the current week (Sunday = 0). */
export function getDaysUntilEndOfWeek(): number {
  const dayOfWeek = new Date().getDay() // 0=Sunday
  if (dayOfWeek === 0) return 0
  return 7 - dayOfWeek
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

/** Maps days overdue to an aging bucket for AR outstanding. */
export function getAgingBucket(daysOverdue: number): 'current' | '1-30' | '31-60' | '61-90' | '90+' {
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}
