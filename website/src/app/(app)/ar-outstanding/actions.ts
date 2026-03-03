'use server'

import { getArInvoiceDetail } from '@/lib/queries'

export async function fetchArInvoiceDetail(arInvoiceId: string) {
  return getArInvoiceDetail(arInvoiceId)
}
