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

export function formatCurrency(amount: number, currency: 'PEN' | 'USD'): string {
  return currency === 'PEN' ? formatPEN(amount) : formatUSD(amount)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
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
  return category
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Aggregate outstanding amounts by currency — PEN total includes USD converted at mid rate.
 * Used by AP Calendar and AR Outstanding for summary card totals.
 */
export function sumByCurrency(
  rows: { currency: string | null; outstanding: number | null }[],
  midRate: number | null
): { pen: number; usd: number } {
  const penNative = rows.filter(r => r.currency === 'PEN').reduce((acc, r) => acc + (r.outstanding ?? 0), 0)
  const usdNative = rows.filter(r => r.currency === 'USD').reduce((acc, r) => acc + (r.outstanding ?? 0), 0)
  const usdConverted = midRate ? usdNative * midRate : 0
  return { pen: penNative + usdConverted, usd: usdNative }
}

// Convert amount to target reporting currency using stored exchange rate (PEN per USD)
export function convertAmount(
  amount: number,
  currency: string | null,
  exchangeRate: number | null,
  reportingCurrency: 'PEN' | 'USD'
): number {
  if (!currency || currency === reportingCurrency) return amount
  if (!exchangeRate || exchangeRate === 0) return amount
  if (reportingCurrency === 'PEN' && currency === 'USD') return amount * exchangeRate
  if (reportingCurrency === 'USD' && currency === 'PEN') return amount / exchangeRate
  return amount
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
