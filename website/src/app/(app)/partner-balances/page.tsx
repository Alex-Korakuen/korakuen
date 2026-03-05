import { isCompanyView } from '@/lib/auth'
import { getPartnerLedger, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { PartnerBalancesWrapper } from './partner-balances-wrapper'

type Props = {
  searchParams: Promise<{ project?: string }>
}

export default async function PartnerBalancesPage({ searchParams }: Props) {
  const params = await searchParams
  const isAlex = await isCompanyView()
  const projectId = params.project || null

  const [projects, exchangeRate] = await Promise.all([
    getProjectsForFilter(),
    getLatestExchangeRate(),
  ])

  // Current mid_rate for converting USD AR payments to PEN in settlement calculations
  const currentRate = exchangeRate?.mid_rate ?? 1

  // Only fetch ledger data if a project is selected
  const data = projectId ? await getPartnerLedger(projectId, currentRate) : null

  return (
    <PartnerBalancesWrapper
      initialData={data}
      projects={projects}
      isAlex={isAlex}
      projectId={projectId}
      exchangeRate={exchangeRate}
    />
  )
}
