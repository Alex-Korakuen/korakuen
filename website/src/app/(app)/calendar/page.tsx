import { getObligationCalendar, getProjectsForFilter, getLatestExchangeRate } from '@/lib/queries'
import { getPartnerFilter } from '@/lib/partner-filter-server'
import { FK, str } from '@/lib/filter-keys'
import { CalendarClient } from './calendar-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams
  const partnerIds = await getPartnerFilter()

  const filters = {
    direction: str(params, FK.direction) as 'payable' | 'receivable' | undefined,
    projectId: str(params, FK.project),
    supplier: str(params, FK.entity),
    type: str(params, FK.type),
    currency: str(params, FK.currency),
    search: str(params, FK.search),
    bucket: str(params, FK.bucket),
  }

  const [exchangeRate, projects] = await Promise.all([
    getLatestExchangeRate(),
    getProjectsForFilter(),
  ])

  const result = await getObligationCalendar(partnerIds, filters, exchangeRate?.mid_rate ?? null)

  return (
    <CalendarClient
      data={result.rows}
      projects={projects}
      uniqueEntities={result.uniqueSuppliers}
      currentFilters={{
        type: filters.type ?? '',
        projectId: filters.projectId ?? '',
        entity: filters.supplier ?? '',
        currency: filters.currency ?? '',
        search: filters.search ?? '',
      }}
    />
  )
}
