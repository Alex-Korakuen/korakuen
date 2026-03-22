import { getFinancialPosition, getPartners, getProjectsForFilter } from '@/lib/queries'
import { FPClient } from './fp-client'

export default async function FinancialPositionPage() {
  const [data, partners, projects] = await Promise.all([
    getFinancialPosition(),
    getPartners(),
    getProjectsForFilter(),
  ])

  return <FPClient data={data} partners={partners} projects={projects} />
}
