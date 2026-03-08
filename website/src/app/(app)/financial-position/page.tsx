import { getFinancialPosition, getPartnerCompanies } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { FPClient } from './fp-client'

export default async function FinancialPositionPage() {
  const partnerIds = await getPartnerFilter()
  const [data, partnerCompanies] = await Promise.all([
    getFinancialPosition(partnerIds),
    getPartnerCompanies(),
  ])

  return <FPClient data={data} partnerCompanies={partnerCompanies} />
}
