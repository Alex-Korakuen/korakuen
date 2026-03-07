import { getPartnerLedger, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { PartnerBalancesWrapper } from './partner-balances-wrapper'

type Props = {
  searchParams: Promise<{ project?: string }>
}

export default async function PartnerBalancesPage({ searchParams }: Props) {
  const params = await searchParams
  const projectId = params.project || null

  const [projects, exchangeRate] = await Promise.all([
    getProjectsForFilter(),
    getLatestExchangeRate(),
  ])

  const currentRate = exchangeRate?.mid_rate ?? 1
  const data = projectId ? await getPartnerLedger(projectId, currentRate) : null

  return (
    <PartnerBalancesWrapper
      initialData={data}
      projects={projects}
      projectId={projectId}
      exchangeRate={exchangeRate}
    />
  )
}
