import {
  getInvoicesPage,
  getProjectsForFilter,
  getProjectCategories,
  getPartners,
} from '@/lib/queries'
import { parsePaginationParams } from '@/lib/pagination'
import { FK, str } from '@/lib/filter-keys'
import { InvoicesClient } from './invoices-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'due_date', dir: 'desc' })

  const filters = {
    direction: str(params, FK.direction) as 'payable' | 'receivable' | undefined,
    type: str(params, FK.type) as 'commercial' | 'loan' | undefined,
    status: str(params, FK.status) as 'pending' | 'partial' | 'paid' | 'overdue' | undefined,
    projectId: str(params, FK.project),
    entity: str(params, FK.entity),

    search: str(params, FK.search),
    sort,
    dir,
    page,
  }

  const [projects, categories, partners] = await Promise.all([
    getProjectsForFilter(),
    getProjectCategories(),
    getPartners(),
  ])

  const result = await getInvoicesPage(filters)

  return (
    <InvoicesClient
      data={result.paginated.data}
      totalCount={result.paginated.totalCount}
      page={result.paginated.page}
      pageSize={result.paginated.pageSize}
      projects={projects}
      uniqueEntities={result.uniqueEntities}
      categories={categories}
      partners={partners}
      currentFilters={{
        direction: filters.direction ?? '',
        type: filters.type ?? '',
        status: filters.status ?? '',
        projectId: filters.projectId ?? '',
        entity: filters.entity ?? '',
        search: filters.search ?? '',
      }}
    />
  )
}
