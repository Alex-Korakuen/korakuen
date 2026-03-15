import { getObligationCalendar, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { parsePaginationParams } from '@/lib/pagination'
import { FK, str } from '@/lib/filter-keys'
import { CalendarClient } from './calendar-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'due_date' })

  const filters = {
    direction: str(params, FK.direction) as 'payable' | 'receivable' | undefined,
    projectId: str(params, FK.project),
    supplier: str(params, FK.entity),
    type: str(params, FK.type),
    currency: str(params, FK.currency),
    search: str(params, FK.search),
    bucket: str(params, FK.bucket),
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
