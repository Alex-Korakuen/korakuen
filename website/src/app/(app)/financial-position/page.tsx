import { getFinancialPosition, getPartnerCompanies, getProjectsForFilter } from '@/lib/queries'
import { FPClient } from './fp-client'

export default async function FinancialPositionPage() {
  const [data, partnerCompanies, projects] = await Promise.all([
    getFinancialPosition(),
    getPartnerCompanies(),
    getProjectsForFilter(),
  ])

  return <FPClient data={data} partnerCompanies={partnerCompanies} projects={projects} />
}
