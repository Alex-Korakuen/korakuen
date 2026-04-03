import { getObligationCalendar, getProjectsForFilter, getProjectCategories } from '@/lib/queries'
import { FK, str } from '@/lib/filter-keys'
import { CalendarClient } from './calendar-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams

  const filters = {
    direction: str(params, FK.direction) as 'payable' | 'receivable' | undefined,
    projectId: str(params, FK.project),
    supplier: str(params, FK.entity),
    type: str(params, FK.type),
    currency: str(params, FK.currency),
    search: str(params, FK.search),
    bucket: str(params, FK.bucket),
  }

  const [projects, categories, result] = await Promise.all([
    getProjectsForFilter(),
    getProjectCategories(),
    getObligationCalendar(filters),
  ])

  // Serialize Map to plain object for client component
  const partnerNames = Object.fromEntries(result.partnerNameMap)

  return (
    <CalendarClient
      data={result.rows}
      projects={projects}
      uniqueEntities={result.uniqueSuppliers}
      partnerNames={partnerNames}
      categories={categories}
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
