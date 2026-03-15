import { getEntitiesList, getEntityDetail, getEntitiesFilterOptions } from '@/lib/queries'
import { parsePaginationParams } from '@/lib/pagination'
import { FK, str } from '@/lib/filter-keys'
import { EntitiesWrapper } from './entities-wrapper'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function EntitiesPage({ searchParams }: Props) {
  const params = await searchParams
  const selectedId = str(params, FK.selected) ?? null
  const { page } = parsePaginationParams(params, { sort: 'legal_name' })

  const filters = {
    search: str(params, FK.search),
    entityType: str(params, FK.entityType),
    tagId: str(params, FK.tagId),
    city: str(params, FK.city),
    region: str(params, FK.region),
    page,
  }

  const [result, filterOptions, detail] = await Promise.all([
    getEntitiesList(filters),
    getEntitiesFilterOptions(),
    selectedId ? getEntityDetail(selectedId) : Promise.resolve(null),
  ])

  return (
    <EntitiesWrapper
      entities={result.data}
      totalCount={result.totalCount}
      page={result.page}
      pageSize={result.pageSize}
      filterOptions={filterOptions}
      detail={detail}
      selectedId={selectedId}
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
