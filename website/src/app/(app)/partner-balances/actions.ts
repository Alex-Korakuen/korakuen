'use server'

import { getPartnerCostDetails } from '@/lib/queries'
import type { PartnerCostDetail } from '@/lib/types'

export async function fetchPartnerCosts(
  projectId: string,
  partnerCompanyId: string,
  currency: string
): Promise<PartnerCostDetail[]> {
  return getPartnerCostDetails(projectId, partnerCompanyId, currency)
}
