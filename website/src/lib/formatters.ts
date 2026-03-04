export function formatPEN(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount)
}

export function formatUSD(amount: number): string {
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

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-PE', {
    month: 'short',
    day: 'numeric',
  })
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

export function formatProjectStatus(status: string | null): string {
  if (status === 'prospect') return 'Prospect'
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return status ?? '--'
}

export function projectStatusBadgeClass(status: string | null): string {
  if (status === 'active') return 'bg-green-100 text-green-800'
  if (status === 'prospect') return 'bg-blue-100 text-blue-800'
  if (status === 'completed') return 'bg-zinc-100 text-zinc-600'
  if (status === 'cancelled') return 'bg-red-100 text-red-800'
  return 'bg-zinc-100 text-zinc-600'
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
