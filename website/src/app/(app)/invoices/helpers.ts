export function getAgingRowBorderClass(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'border-l-4 border-l-aging-ok'
  if (daysOverdue <= 30) return 'border-l-4 border-l-aging-warning'
  if (daysOverdue <= 60) return 'border-l-4 border-l-aging-alert'
  return 'border-l-4 border-l-aging-critical'
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
