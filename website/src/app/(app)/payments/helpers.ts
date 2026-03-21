import { formatCurrency } from '@/lib/formatters'

export function formatSignedAmount(amount: number, currency: string, direction: string): string {
  const formatted = formatCurrency(amount, currency)
  return direction === 'inbound' ? `+${formatted}` : `\u2212${formatted}`
}

export function getSignedAmountColorClass(direction: string): string {
  return direction === 'inbound' ? 'text-positive' : 'text-negative'
}

export function getDirectionLabel(direction: string): string {
  return direction === 'inbound' ? 'In' : 'Out'
}

export function getDirectionColorClass(direction: string): string {
  return direction === 'inbound'
    ? 'bg-positive-bg text-positive'
    : 'bg-negative-bg text-negative'
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
  if (relatedTo === 'loan_schedule' || relatedTo === 'loan') return 'Loan'
  return invoiceNumber ?? '--'
}
