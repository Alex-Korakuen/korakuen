/** Default page after authentication — used by login, set-password, callback, and middleware */
export const DEFAULT_ROUTE = '/calendar'

/** App branding */
export const APP_NAME = 'Korakuen'
export const APP_NAME_UPPER = 'KORAKUEN'
export const APP_NAME_SHORT = 'K'

/** Lowercase identifier used to match this company in partner lists */
export const COMPANY_IDENTIFIER = 'korakuen'

/** Valid currency codes — used for import validation */
export const VALID_CURRENCIES = ['USD', 'PEN'] as const

/** Default currency when none specified */
export const DEFAULT_CURRENCY = 'PEN'

/** Default payment title by type and direction */
export function defaultPaymentTitle(paymentType: string, direction: string): string {
  if (paymentType === 'detraccion') return 'Detraccion'
  if (paymentType === 'retencion') return 'Retencion'
  return direction === 'inbound' ? 'Cobro' : 'Pago'
}
