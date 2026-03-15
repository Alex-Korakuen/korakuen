import {
  getInvoicesPage,
  getProjectsForFilter,
  getLatestExchangeRate,
} from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { parsePaginationParams } from '@/lib/pagination'
import { FK, str } from '@/lib/filter-keys'
import { InvoicesClient } from './invoices-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'due_date', dir: 'desc' })

  const filters = {
    direction: str(params, FK.direction) as 'payable' | 'receivable' | undefined,
    type: str(params, FK.type) as 'commercial' | 'loan' | undefined,
    status: str(params, FK.status) as 'pending' | 'partial' | 'paid' | 'overdue' | undefined,
    projectId: str(params, FK.project),
    entity: str(params, FK.entity),
    bucket: str(params, FK.bucket),
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
