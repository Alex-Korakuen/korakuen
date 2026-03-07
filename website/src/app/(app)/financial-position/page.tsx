import { getFinancialPosition } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { FPClient } from './fp-client'

export default async function FinancialPositionPage() {
  const partnerIds = await getPartnerFilter()
  const data = await getFinancialPosition(partnerIds)

  return <FPClient data={data} />
}
