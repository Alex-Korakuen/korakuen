export function getAgingRowBorderClass(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'border-l-4 border-l-aging-ok'
  if (daysOverdue <= 30) return 'border-l-4 border-l-aging-warning'
  if (daysOverdue <= 60) return 'border-l-4 border-l-aging-alert'
  return 'border-l-4 border-l-aging-critical'
}
