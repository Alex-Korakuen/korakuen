import { isCompanyView } from '@/lib/auth'
import { getCashFlow, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { CashFlowWrapper } from './cash-flow-wrapper'

type Props = {
  searchParams: Promise<{ year?: string; project?: string }>
}

export default async function CashFlowPage({ searchParams }: Props) {
  const params = await searchParams
  const isAlex = await isCompanyView()

  const year = params.year ? Number(params.year) : new Date().getFullYear()
  const projectId = params.project || null

  const [data, projects, exchangeRate] = await Promise.all([
    getCashFlow(year, projectId, isAlex),
    getProjectsForFilter(),
    getLatestExchangeRate(),
  ])

  return (
    <CashFlowWrapper
      initialData={data}
      projects={projects}
      isAlex={isAlex}
      year={year}
      projectId={projectId}
      exchangeRate={exchangeRate}
    />
  )
}
