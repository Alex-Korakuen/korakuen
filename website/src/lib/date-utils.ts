/** Returns days remaining until end of the current week (Sunday = 0). */
export function getDaysUntilEndOfWeek(): number {
  const dayOfWeek = new Date().getDay() // 0=Sunday
  if (dayOfWeek === 0) return 0
  return 7 - dayOfWeek
}

/** Maps days remaining to a calendar urgency bucket. */
export function getCalendarBucket(
  daysRemaining: number | null,
  daysToEndOfWeek: number,
): 'overdue' | 'today' | 'this-week' | 'next-30' | null {
  if (daysRemaining === null) return null
  if (daysRemaining < 0) return 'overdue'
  if (daysRemaining === 0) return 'today'
  if (daysRemaining <= daysToEndOfWeek) return 'this-week'
  if (daysRemaining <= 30) return 'next-30'
  return null
}

/** Maps days overdue to an aging bucket for AR outstanding. */
export function getAgingBucket(daysOverdue: number): 'current' | '1-30' | '31-60' | '61-90' | '90+' {
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}
