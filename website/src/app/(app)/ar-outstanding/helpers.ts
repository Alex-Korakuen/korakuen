export { getAgingBucket } from '@/lib/date-utils'

export function getAgingColorClass(daysOverdue: number): string {
  if (daysOverdue <= 30) return 'text-green-600'
  if (daysOverdue <= 60) return 'text-yellow-600 font-medium'
  if (daysOverdue <= 90) return 'text-orange-600 font-medium'
  return 'text-red-600 font-medium'
}

export function getAgingRowBorderClass(daysOverdue: number): string {
  if (daysOverdue <= 30) return 'border-l-4 border-l-green-400'
  if (daysOverdue <= 60) return 'border-l-4 border-l-yellow-400'
  if (daysOverdue <= 90) return 'border-l-4 border-l-orange-400'
  return 'border-l-4 border-l-red-400'
}
