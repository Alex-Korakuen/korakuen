const COOKIE_NAME = 'partner_filter'

export { COOKIE_NAME }

export function parsePartnerFilterCookie(cookieValue: string | undefined): string[] {
  if (!cookieValue) return []
  return cookieValue.split(',').filter(Boolean)
}
