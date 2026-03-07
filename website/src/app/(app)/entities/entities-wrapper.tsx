'use client'

import { useSelectRouter } from '@/lib/use-select-router'
import { EntitiesClient } from './entities-client'
import type { EntityListItem, EntityDetailData, EntitiesFilterOptions } from '@/lib/types'

type Props = {
  entities: EntityListItem[]
  totalCount: number
  page: number
  pageSize: number
  filterOptions: EntitiesFilterOptions
  detail: EntityDetailData | null
  selectedId: string | null
  currentFilters: {
    search: string
    entityType: string
    tagId: string
    city: string
    region: string
  }
}

export function EntitiesWrapper({
  entities,
  totalCount,
  page,
  pageSize,
  filterOptions,
  detail,
  selectedId,
  currentFilters,
}: Props) {
  const handleSelect = useSelectRouter('/entities')

  return (
    <EntitiesClient
      entities={entities}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      filterOptions={filterOptions}
      detail={detail}
      selectedId={selectedId}
      onSelect={handleSelect}
      currentFilters={currentFilters}
    />
  )
}
