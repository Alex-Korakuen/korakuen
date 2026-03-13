export function getDirectionLabel(direction: string): string {
  return direction === 'inbound' ? 'In' : 'Out'
}

export function getDirectionColorClass(direction: string): string {
  return direction === 'inbound'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700'
}

export function getPaymentTypeLabel(type: string): string {
  switch (type) {
    case 'regular': return 'Regular'
    case 'detraccion': return 'Detraccion'
    case 'retencion': return 'Retencion'
    default: return type
  }
}

export function getPaymentTypeBadgeVariant(type: string): 'zinc' | 'blue' | 'yellow' {
  switch (type) {
    case 'detraccion': return 'blue'
    case 'retencion': return 'yellow'
    default: return 'zinc'
  }
}

export function getRelatedLabel(relatedTo: string, invoiceNumber: string | null): string {
  if (relatedTo === 'loan_schedule') return 'Loan'
  return invoiceNumber ?? '--'
}
