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

  // Derive dateFrom/dateTo from month param
  const month = str(params, FK.month)
  let dateFrom: string | undefined
  let dateTo: string | undefined
  if (month) {
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    dateFrom = `${month}-01`
    dateTo = `${month}-${String(lastDay).padStart(2, '0')}`
  }

  const filters = {
    direction: str(params, FK.direction) as 'payable' | 'receivable' | undefined,
    type: str(params, FK.type) as 'commercial' | 'loan' | undefined,
    status: str(params, FK.status) as 'pending' | 'partial' | 'paid' | 'overdue' | undefined,
    projectId: str(params, FK.project),
    partnerId: str(params, FK.partner),
    category: str(params, FK.category),
    entity: str(params, FK.entity),
    dateFrom,
    dateTo,
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
      uniqueCategories={result.uniqueCategories}
      categories={categories}
      partners={partners}
      currentFilters={{
        month: month ?? '',
        partnerId: filters.partnerId ?? '',
        projectId: filters.projectId ?? '',
        category: filters.category ?? '',
        entity: filters.entity ?? '',
        direction: filters.direction ?? '',
        type: filters.type ?? '',
        status: filters.status ?? '',
      }}
    />
  )
}
