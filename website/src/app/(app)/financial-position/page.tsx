import { getFinancialPosition, getPartnerCompanies, getProjectsForFilter } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { FPClient } from './fp-client'

export default async function FinancialPositionPage() {
  const partnerIds = await getPartnerFilter()
  const [data, partnerCompanies, projects] = await Promise.all([
    getFinancialPosition(partnerIds),
    getPartnerCompanies(),
    getProjectsForFilter(),
  ])

  return <FPClient data={data} partnerCompanies={partnerCompanies} projects={projects} />
}
