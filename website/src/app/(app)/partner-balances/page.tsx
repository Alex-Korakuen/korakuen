import { isCompanyView } from '@/lib/auth'
import { getPartnerLedger, getProjectsForFilter } from '@/lib/queries'
import { PartnerBalancesWrapper } from './partner-balances-wrapper'

type Props = {
  searchParams: Promise<{ project?: string }>
}

export default async function PartnerBalancesPage({ searchParams }: Props) {
  const params = await searchParams
  const isAlex = await isCompanyView()
  const projectId = params.project || null

  const projects = await getProjectsForFilter()

  // Only fetch ledger data if a project is selected
  const data = projectId ? await getPartnerLedger(projectId) : null

  return (
    <PartnerBalancesWrapper
      initialData={data}
      projects={projects}
      isAlex={isAlex}
      projectId={projectId}
    />
  )
}
