/** Returns days remaining until end of the current week (Sunday = 0). */
export function getDaysUntilEndOfWeek(): number {
  const dayOfWeek = new Date().getDay() // 0=Sunday
  if (dayOfWeek === 0) return 0
  return 7 - dayOfWeek
}

/** Maps days overdue to an aging bucket for AR outstanding. */
export function getAgingBucket(daysOverdue: number): 'current' | '31-60' | '61-90' | '90+' {
  if (daysOverdue <= 30) return 'current'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}
