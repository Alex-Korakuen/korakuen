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

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format date as "15/Mar" — compact dd/Mmm used across all tables. */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}/${SHORT_MONTHS[d.getMonth()]}`
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
