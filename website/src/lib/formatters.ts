function formatPEN(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount)
}

function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatCurrency(amount: number, currency: string | null): string {
  return currency === 'USD' ? formatUSD(amount) : formatPEN(amount)
}

/** Signed, whole-number format for compact badges: "+S/ 1,234" or "−US$ 1,234" */
export function formatCurrencyCompact(amount: number, currency: string | null): string {
  const symbol = currency === 'USD' ? 'US$' : 'S/'
  const sign = amount > 0 ? '+' : amount < 0 ? '\u2212' : ''
  const formatted = Math.abs(amount).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return `${sign}${symbol} ${formatted}`
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format date as "15/Mar" — compact dd/Mmm used across all tables. */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}/${SHORT_MONTHS[d.getMonth()]}`
}

/** Returns today's date as an ISO string (YYYY-MM-DD). */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** Maps days remaining to a calendar urgency bucket. */
export function getCalendarBucket(
  daysRemaining: number | null,
): 'overdue' | 'today' | 'next-7' | 'next-30' | 'later' {
  if (daysRemaining === null || daysRemaining < 0) return 'overdue'
  if (daysRemaining === 0) return 'today'
  if (daysRemaining <= 7) return 'next-7'
  if (daysRemaining <= 30) return 'next-30'
  return 'later'
}

/** Converts a "YYYY-MM" month string to dateFrom/dateTo range. */
export function getMonthDateRange(month: string): { dateFrom: string; dateTo: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(`Invalid month format: "${month}". Expected YYYY-MM.`)
  }
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function formatProjectStatus(status: string | null): string {
  if (status === 'prospect') return 'Prospect'
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return status ?? '--'
}

export function projectStatusBadgeVariant(status: string | null): 'green' | 'blue' | 'zinc' | 'red' {
  if (status === 'active') return 'green'
  if (status === 'prospect') return 'blue'
  if (status === 'cancelled') return 'red'
  return 'zinc'
}

export function formatProjectType(type: string | null): string {
  if (type === 'subcontractor') return 'Subcontractor'
  if (type === 'oxi') return 'OxI'
  return type ?? '--'
}

export function formatEntityType(type: string | null): string {
  if (type === 'company') return 'Company'
  if (type === 'individual') return 'Individual'
  return type ?? '--'
}

export function formatCategory(category: string | null): string {
  if (!category) return '--'
  if (category === 'other_sga') return 'Other (SG&A)'
  return category
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function formatExchangeRate(rate: number | null): string {
  return rate?.toFixed(3) ?? '--'
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/** Payment status label — shared by invoices table and loan schedule table. */
export function formatPaymentStatus(status: string): string {
  switch (status) {
    case 'paid': return 'Paid'
    case 'partial': return 'Partial'
    case 'pending': return 'Pending'
    default: return status
  }
}

/** Badge variant for paid/partial/pending status. */
export function paymentStatusBadgeVariant(status: string): 'green' | 'blue' | 'yellow' | 'zinc' {
  switch (status) {
    case 'paid': return 'green'
    case 'partial': return 'blue'
    case 'pending': return 'yellow'
    default: return 'zinc'
  }
}

/** Default payment title by type and direction. */
export function defaultPaymentTitle(paymentType: string, direction: string): string {
  if (paymentType === 'detraccion') return 'Detraccion'
  if (paymentType === 'retencion') return 'Retencion'
  return direction === 'inbound' ? 'Cobro' : 'Pago'
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
