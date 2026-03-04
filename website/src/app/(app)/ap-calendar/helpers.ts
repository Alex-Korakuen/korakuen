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


