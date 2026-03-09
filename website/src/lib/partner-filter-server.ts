import { cookies } from 'next/headers'
import { parsePartnerFilterCookie } from './partner-filter-utils'

/** Read partner filter from cookie on the server side. Returns empty array = all partners. */
export async function getPartnerFilter(): Promise<string[]> {
  const cookieStore = await cookies()
  const value = cookieStore.get('partner_filter')?.value
  return parsePartnerFilterCookie(value)
}
