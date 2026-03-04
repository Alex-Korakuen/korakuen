'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { EntitiesClient } from './entities-client'
import type { EntityListItem, EntityDetailData, EntitiesFilterOptions } from '@/lib/types'

type Props = {
  entities: EntityListItem[]
  filterOptions: EntitiesFilterOptions
  detail: EntityDetailData | null
  selectedId: string | null
}

export function EntitiesWrapper({ entities, filterOptions, detail, selectedId }: Props) {
  const router = useRouter()

  const handleSelect = useCallback(
    (id: string | null) => {
      if (id) {
        router.push(`/entities?selected=${id}`)
      } else {
        router.push('/entities')
      }
    },
    [router]
  )

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
