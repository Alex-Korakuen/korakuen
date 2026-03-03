export function getDaysUntilEndOfWeek(): number {
  const dayOfWeek = new Date().getDay() // 0=Sunday
  if (dayOfWeek === 0) return 0
  return 7 - dayOfWeek
}

export function getRowBorderClass(daysRemaining: number | null): string {
  if (daysRemaining === null) return ''
  if (daysRemaining < 0) return 'border-l-4 border-l-[var(--color-overdue)]'
  if (daysRemaining === 0) return 'border-l-4 border-l-[var(--color-today)]'
  const daysToEndOfWeek = getDaysUntilEndOfWeek()
  if (daysRemaining > 0 && daysRemaining <= daysToEndOfWeek) {
    return 'border-l-4 border-l-[var(--color-this-week)]'
  }
  return 'border-l-4 border-l-transparent'
}

export function formatType(type: string | null): string {
  if (type === 'supplier_invoice') return 'Supplier'
  if (type === 'loan_payment') return 'Loan'
  return type ?? '--'
}

export function formatComprobanteType(type: string | null): string {
  if (!type) return '--'
  const map: Record<string, string> = {
    factura: 'Factura',
    boleta: 'Boleta',
    recibo_por_honorarios: 'Recibo por Honorarios',
    liquidacion_de_compra: 'Liquidacion de Compra',
    planilla_jornales: 'Planilla de Jornales',
    none: 'Sin comprobante',
  }
  return map[type] ?? type
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
