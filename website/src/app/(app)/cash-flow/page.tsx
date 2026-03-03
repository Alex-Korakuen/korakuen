import { isCompanyView } from '@/lib/auth'
import { getCashFlow, getProjectsForFilter } from '@/lib/queries'
import type { Currency } from '@/lib/types'
import { CashFlowWrapper } from './cash-flow-wrapper'

type Props = {
  searchParams: Promise<{ year?: string; project?: string; currency?: string }>
}

export default async function CashFlowPage({ searchParams }: Props) {
  const params = await searchParams
  const isAlex = await isCompanyView()

  const year = params.year ? Number(params.year) : new Date().getFullYear()
  const projectId = params.project || null
  const currency = (params.currency === 'USD' ? 'USD' : 'PEN') as Currency

  const [data, projects] = await Promise.all([
    getCashFlow(year, projectId, isAlex, currency),
    getProjectsForFilter(),
  ])

  return (
    <CashFlowWrapper
      initialData={data}
      projects={projects}
      isAlex={isAlex}
      year={year}
      projectId={projectId}
      currency={currency}
    />
  )
}
