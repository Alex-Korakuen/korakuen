import {
  getInvoicesPage,
  getProjectsForFilter,
  getProjectCategories,
  getPartners,
} from '@/lib/queries'
import { parsePaginationParams } from '@/lib/pagination'
import { FK, str } from '@/lib/filter-keys'
import { getMonthDateRange } from '@/lib/formatters'
import type { InvoiceDirection } from '@/lib/types'
import { InvoicesClient } from './invoices-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'due_date', dir: 'desc' })

  const month = str(params, FK.month)
  const { dateFrom, dateTo } = month ? getMonthDateRange(month) : { dateFrom: undefined, dateTo: undefined }

  const filters = {
    direction: str(params, FK.direction) as InvoiceDirection | undefined,
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
