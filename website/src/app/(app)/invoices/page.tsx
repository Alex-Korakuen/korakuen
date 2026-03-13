import {
  getInvoicesPage,
  getProjectsForFilter,
  getLatestExchangeRate,
} from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { parsePaginationParams } from '@/lib/pagination'
import { InvoicesClient } from './invoices-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'due_date', dir: 'desc' })

  const filters = {
    direction: typeof params.direction === 'string' ? params.direction as 'payable' | 'receivable' : undefined,
    type: typeof params.type === 'string' ? params.type as 'commercial' | 'loan' : undefined,
    status: typeof params.status === 'string' ? params.status as 'pending' | 'partial' | 'paid' | 'overdue' : undefined,
    projectId: typeof params.project === 'string' ? params.project : undefined,
    entity: typeof params.entity === 'string' ? params.entity : undefined,
    bucket: typeof params.bucket === 'string' ? params.bucket : undefined,
    sort,
    dir,
    page,
  }

  const [exchangeRate, projects] = await Promise.all([
    getLatestExchangeRate(),
    getProjectsForFilter(),
  ])

  const result = await getInvoicesPage(partnerIds, filters, exchangeRate?.mid_rate ?? null)

  return (
    <InvoicesClient
      data={result.paginated.data}
      totalCount={result.paginated.totalCount}
      page={result.paginated.page}
      pageSize={result.paginated.pageSize}
      payableBuckets={result.payableBuckets}
      receivableBuckets={result.receivableBuckets}
      summary={result.summary}
      projects={projects}
      uniqueEntities={result.uniqueEntities}
      currentFilters={{
        direction: filters.direction ?? '',
        type: filters.type ?? '',
        status: filters.status ?? '',
        projectId: filters.projectId ?? '',
        entity: filters.entity ?? '',
        bucket: filters.bucket ?? 'all',
      }}
    />
  )
}
