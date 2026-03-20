export const COOKIE_NAME = 'partner_filter'

export function parsePartnerFilterCookie(cookieValue: string | undefined): string[] {
  if (!cookieValue) return []
  return cookieValue.split(',').filter(Boolean)
}

export function serializePartnerFilterCookie(ids: string[]): string {
  return ids.join(',')
}
