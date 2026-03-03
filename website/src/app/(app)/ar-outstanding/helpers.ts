export function getAgingBucket(daysOverdue: number): 'current' | '31-60' | '61-90' | '90+' {
  if (daysOverdue <= 30) return 'current'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

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

export function getRetencionAgingColor(daysSinceInvoice: number, verified: boolean): string {
  if (verified) return 'text-green-600'
  if (daysSinceInvoice <= 30) return 'text-green-600'
  if (daysSinceInvoice <= 60) return 'text-yellow-600'
  if (daysSinceInvoice <= 90) return 'text-orange-600'
  return 'text-red-600'
}

export function formatPaymentStatus(status: string | null): string {
  if (status === 'pending') return 'Pending'
  if (status === 'partial') return 'Partial'
  if (status === 'paid') return 'Paid'
  return status ?? '--'
}

export function statusBadgeClass(status: string | null): string {
  if (status === 'pending') return 'bg-yellow-100 text-yellow-800'
  if (status === 'partial') return 'bg-orange-100 text-orange-800'
  if (status === 'paid') return 'bg-green-100 text-green-800'
  return 'bg-zinc-100 text-zinc-600'
}
