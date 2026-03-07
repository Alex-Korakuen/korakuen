import { getPriceHistory, getPriceFilterOptions } from '@/lib/queries'
import { parsePaginationParams } from '@/lib/pagination'
import { PricesClient } from './prices-client'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PricesPage({ searchParams }: Props) {
  const params = await searchParams
  const { page, sort, dir } = parsePaginationParams(params, { sort: 'date', dir: 'desc' })

  const filters = {
    search: typeof params.search === 'string' ? params.search : undefined,
    category: typeof params.category === 'string' ? params.category : undefined,
    entityId: typeof params.entity === 'string' ? params.entity : undefined,
    projectId: typeof params.project === 'string' ? params.project : undefined,
    tagId: typeof params.tag === 'string' ? params.tag : undefined,
    dateFrom: typeof params.dateFrom === 'string' ? params.dateFrom : undefined,
    dateTo: typeof params.dateTo === 'string' ? params.dateTo : undefined,
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
