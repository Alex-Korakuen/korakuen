import { getObligationCalendar, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { parsePaginationParams } from '@/lib/pagination'
import { CalendarClient } from './calendar-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'due_date' })

  const direction = typeof params.direction === 'string' ? params.direction as 'payable' | 'receivable' : undefined
  const filters = {
    direction,
    projectId: typeof params.project === 'string' ? params.project : undefined,
    supplier: typeof params.entity === 'string' ? params.entity : undefined,
    type: typeof params.type === 'string' ? params.type : undefined,
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

  const result = await getObligationCalendar(partnerIds, filters, exchangeRate?.mid_rate ?? null)

  return (
    <CalendarClient
      data={result.paginated.data}
      totalCount={result.paginated.totalCount}
      page={result.paginated.page}
      pageSize={result.paginated.pageSize}
      bucketCounts={result.bucketCounts}
      projects={projects}
      uniqueEntities={result.uniqueSuppliers}
      currentFilters={{
        direction: filters.direction ?? '',
        type: filters.type ?? '',
        projectId: filters.projectId ?? '',
        entity: filters.supplier ?? '',
        currency: filters.currency ?? '',
        search: filters.search ?? '',
        bucket: filters.bucket ?? 'all',
      }}
    />
  )
}
