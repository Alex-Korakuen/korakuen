import { getEntitiesList, getEntityDetail, getEntitiesFilterOptions } from '@/lib/queries'
import { parsePaginationParams } from '@/lib/pagination'
import { EntitiesWrapper } from './entities-wrapper'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function EntitiesPage({ searchParams }: Props) {
  const params = await searchParams
  const selectedId = typeof params.selected === 'string' ? params.selected : null
  const { page } = parsePaginationParams(params, { sort: 'legal_name' })

  const filters = {
    search: typeof params.search === 'string' ? params.search : undefined,
    entityType: typeof params.entityType === 'string' ? params.entityType : undefined,
    tagId: typeof params.tagId === 'string' ? params.tagId : undefined,
    city: typeof params.city === 'string' ? params.city : undefined,
    region: typeof params.region === 'string' ? params.region : undefined,
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
