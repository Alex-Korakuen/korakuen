import {
  getArOutstanding,
  getProjectsForFilter,
  getClientsForFilter,
  getPartnerCompaniesForFilter,
  getLatestExchangeRate,
} from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { parsePaginationParams } from '@/lib/pagination'
import { ArOutstandingClient } from './ar-outstanding-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ArOutstandingPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'due_date' })

  const filters = {
    projectId: typeof params.project === 'string' ? params.project : undefined,
    client: typeof params.client === 'string' ? params.client : undefined,
    partnerCompanyId: typeof params.partner === 'string' ? params.partner : undefined,
    currency: typeof params.currency === 'string' ? params.currency : undefined,
    bucket: typeof params.bucket === 'string' ? params.bucket : undefined,
    sort,
    dir,
    page,
  }

  const [exchangeRate, projects, clients, partners] = await Promise.all([
    getLatestExchangeRate(),
    getProjectsForFilter(),
    getClientsForFilter(),
    getPartnerCompaniesForFilter(),
  ])

  const result = await getArOutstanding(partnerIds, filters, exchangeRate?.mid_rate ?? null)

  return (
    <ArOutstandingClient
      data={result.paginated.data}
      totalCount={result.paginated.totalCount}
      page={result.paginated.page}
      pageSize={result.paginated.pageSize}
      bucketCounts={result.bucketCounts}
      totals={result.totals}
      projects={projects}
      clients={clients}
      partners={partners}
      currentFilters={{
        projectId: filters.projectId ?? '',
        client: filters.client ?? '',
        partnerCompanyId: filters.partnerCompanyId ?? '',
        currency: filters.currency ?? '',
        bucket: filters.bucket ?? 'all',
      }}
    />
  )
}
