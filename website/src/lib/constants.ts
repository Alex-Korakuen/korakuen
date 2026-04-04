import type { Currency } from './types'

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

// --- Peruvian tax defaults ---

/** IGV (VAT) rate — 18% since 2011 */
export const DEFAULT_IGV_RATE = 18

/** Default retencion rate when retencion_applicable is true but no rate is specified */
export const DEFAULT_RETENCION_RATE = 8

/** Exchange rate (PEN per USD) validation range for imports */
export const EXCHANGE_RATE_MIN = 2.5
export const EXCHANGE_RATE_MAX = 6.0

/** Default currency when none specified */
export const DEFAULT_CURRENCY: Currency = 'PEN'
