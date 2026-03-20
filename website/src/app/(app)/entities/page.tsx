import { getEntitiesDirectory, getEntitiesFilterOptions } from '@/lib/queries'
import { parsePaginationParams } from '@/lib/pagination'
import { FK, str } from '@/lib/filter-keys'
import { EntitiesDirectory } from './entities-directory'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function EntitiesPage({ searchParams }: Props) {
  const params = await searchParams
  const { page } = parsePaginationParams(params, { sort: 'legal_name' })

  const filters = {
    search: str(params, FK.search),
    entityType: str(params, FK.entityType),
    tagId: str(params, FK.tagId),
    city: str(params, FK.city),
    region: str(params, FK.region),
    page,
  }

  const [result, filterOptions] = await Promise.all([
    getEntitiesDirectory(filters),
    getEntitiesFilterOptions(),
  ])

  return (
    <EntitiesDirectory
      entities={result.data}
      totalCount={result.totalCount}
      page={result.page}
      pageSize={result.pageSize}
      filterOptions={filterOptions}
      currentFilters={{
        search: filters.search ?? '',
        entityType: filters.entityType ?? '',
        tagId: filters.tagId ?? '',
        city: filters.city ?? '',
        region: filters.region ?? '',
      }}
    />
  )
}
