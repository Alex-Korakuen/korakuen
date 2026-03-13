export { getAgingBucket } from '@/lib/date-utils'

export function getAgingColorClass(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'text-green-600'
  if (daysOverdue <= 30) return 'text-yellow-600 font-medium'
  if (daysOverdue <= 60) return 'text-orange-600 font-medium'
  if (daysOverdue <= 90) return 'text-red-600 font-medium'
  return 'text-red-700 font-bold'
}

export function getAgingRowBorderClass(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'border-l-4 border-l-green-400'
  if (daysOverdue <= 30) return 'border-l-4 border-l-yellow-400'
  if (daysOverdue <= 60) return 'border-l-4 border-l-orange-400'
  return 'border-l-4 border-l-red-400'
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'paid': return 'Paid'
    case 'partial': return 'Partial'
    case 'pending': return 'Pending'
    default: return status
  }
}

export function getStatusVariant(status: string): 'green' | 'blue' | 'yellow' | 'zinc' {
  switch (status) {
    case 'paid': return 'green'
    case 'partial': return 'blue'
    case 'pending': return 'yellow'
    default: return 'zinc'
  }
}

export function getDirectionLabel(direction: string): string {
  return direction === 'receivable' ? 'AR' : 'AP'
}

export function getDirectionColorClass(direction: string): string {
  return direction === 'receivable'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-amber-100 text-amber-700'
}
