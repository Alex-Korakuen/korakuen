import { getCashFlow, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { CashFlowWrapper } from './cash-flow-wrapper'

type Props = {
  searchParams: Promise<{ year?: string; project?: string }>
}

export default async function CashFlowPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()

  const year = params.year ? Number(params.year) : new Date().getFullYear()
  const projectId = params.project || null

  const [data, projects, exchangeRate] = await Promise.all([
    getCashFlow(year, projectId, partnerIds),
    getProjectsForFilter(),
    getLatestExchangeRate(),
  ])

  return (
    <CashFlowWrapper
      initialData={data}
      projects={projects}
      year={year}
      projectId={projectId}
      exchangeRate={exchangeRate}
    />
  )
}
