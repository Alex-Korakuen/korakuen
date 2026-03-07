import { getApCalendar, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { parsePaginationParams } from '@/lib/pagination'
import { ApCalendarClient } from './ap-calendar-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ApCalendarPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'due_date' })

  const filters = {
    projectId: typeof params.project === 'string' ? params.project : undefined,
    supplier: typeof params.supplier === 'string' ? params.supplier : undefined,
    currency: typeof params.currency === 'string' ? params.currency : undefined,
    search: typeof params.search === 'string' ? params.search : undefined,
    bucket: typeof params.bucket === 'string' ? params.bucket : undefined,
    sort,
    dir,
    page,
  }

  const [exchangeRate, projects] = await Promise.all([
    getLatestExchangeRate(),
    getProjectsForFilter(),
  ])

  const result = await getApCalendar(partnerIds, filters, exchangeRate?.mid_rate ?? null)

  return (
    <ApCalendarClient
      data={result.paginated.data}
      totalCount={result.paginated.totalCount}
      page={result.paginated.page}
      pageSize={result.paginated.pageSize}
      bucketCounts={result.bucketCounts}
      projects={projects}
      uniqueSuppliers={result.uniqueSuppliers}
      currentFilters={{
        projectId: filters.projectId ?? '',
        supplier: filters.supplier ?? '',
        currency: filters.currency ?? '',
        search: filters.search ?? '',
        bucket: filters.bucket ?? 'all',
      }}
    />
  )
}
