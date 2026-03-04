import { getEntitiesList, getEntityDetail, getEntitiesFilterOptions } from '@/lib/queries'
import { EntitiesWrapper } from './entities-wrapper'

type Props = {
  searchParams: Promise<{ selected?: string }>
}

export default async function EntitiesPage({ searchParams }: Props) {
  const params = await searchParams
  const selectedId = params.selected || null

  const [entities, filterOptions, detail] = await Promise.all([
    getEntitiesList(),
    getEntitiesFilterOptions(),
    selectedId ? getEntityDetail(selectedId) : Promise.resolve(null),
  ])

  return (
    <EntitiesWrapper
      entities={entities}
      filterOptions={filterOptions}
      detail={detail}
      selectedId={selectedId}
    />
  )
}
