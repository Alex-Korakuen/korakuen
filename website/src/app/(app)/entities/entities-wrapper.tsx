'use client'

import { useSelectRouter } from '@/lib/use-select-router'
import { EntitiesClient } from './entities-client'
import type { EntityListItem, EntityDetailData, EntitiesFilterOptions } from '@/lib/types'

type Props = {
  entities: EntityListItem[]
  filterOptions: EntitiesFilterOptions
  detail: EntityDetailData | null
  selectedId: string | null
}

export function EntitiesWrapper({ entities, filterOptions, detail, selectedId }: Props) {
  const handleSelect = useSelectRouter('/entities')

  return (
    <EntitiesClient
      entities={entities}
      filterOptions={filterOptions}
      detail={detail}
      selectedId={selectedId}
      onSelect={handleSelect}
    />
  )
}
