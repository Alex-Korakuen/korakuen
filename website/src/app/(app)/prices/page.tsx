import { getPriceHistory, getPriceFilterOptions } from '@/lib/queries'
import { parsePaginationParams } from '@/lib/pagination'
import { FK, str } from '@/lib/filter-keys'
import { PricesClient } from './prices-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PricesPage({ searchParams }: Props) {
  const params = await searchParams
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'date', dir: 'desc' })

  const filters = {
    search: str(params, FK.search),
    category: str(params, FK.category),
    entityId: str(params, FK.entity),
    projectId: str(params, FK.project),
    tagId: str(params, FK.tag),
    dateFrom: str(params, FK.dateFrom),
    dateTo: str(params, FK.dateTo),
    sort,
    dir,
    page,
  }

  const [result, filterOptions] = await Promise.all([
    getPriceHistory(filters),
    getPriceFilterOptions(),
  ])

  return (
    <PricesClient
      data={result.data}
      totalCount={result.totalCount}
      page={result.page}
      pageSize={result.pageSize}
      filterOptions={filterOptions}
      currentFilters={{
        search: filters.search ?? '',
        category: filters.category ?? '',
        entityId: filters.entityId ?? '',
        projectId: filters.projectId ?? '',
        tagId: filters.tagId ?? '',
        dateFrom: filters.dateFrom ?? '',
        dateTo: filters.dateTo ?? '',
      }}
    />
  )
}
