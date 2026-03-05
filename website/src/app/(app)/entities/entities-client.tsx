'use client'

import { useMemo, useState } from 'react'
import { EntitiesListPanel } from './entities-list-panel'
import { EntitiesDetailPanel } from './entities-detail-panel'
import { TransactionModal } from './entities-transaction-modal'
import type {
  EntityListItem,
  EntityDetailData,
  EntitiesFilterOptions,
  EntityFilters,
  ProjectTransactionGroup,
} from '@/lib/types'

type Props = {
  entities: EntityListItem[]
  filterOptions: EntitiesFilterOptions
  detail: EntityDetailData | null
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function EntitiesClient({
  entities,
  filterOptions,
  detail,
  selectedId,
  onSelect,
}: Props) {
  const [filters, setFilters] = useState<EntityFilters>({
    search: '',
    entityType: '',
    tagId: '',
    city: '',
    region: '',
  })

  const [modalGroup, setModalGroup] = useState<ProjectTransactionGroup | null>(null)

  // Build tag id -> name lookup for filtering
  const tagNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of filterOptions.tags) {
      map.set(t.id, t.name)
    }
    return map
  }, [filterOptions.tags])

  // Client-side filtering
  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase()
    const selectedTagName = filters.tagId ? tagNameById.get(filters.tagId) : null

    return entities.filter((e) => {
      if (search) {
        const inLegal = e.legal_name.toLowerCase().includes(search)
        const inCommon = e.common_name?.toLowerCase().includes(search) ?? false
        const inDoc = e.document_number?.toLowerCase().includes(search) ?? false
        if (!inLegal && !inCommon && !inDoc) return false
      }
      if (filters.entityType && e.entity_type !== filters.entityType) return false
      if (selectedTagName && !e.tags.includes(selectedTagName)) return false
      if (filters.city && e.city !== filters.city) return false
      if (filters.region && e.region !== filters.region) return false
      return true
    })
  }, [entities, filters, tagNameById])

  // --- Mobile: show detail or list ---
  const showDetailMobile = selectedId && detail

  return (
    <div>
      {/* Mobile: Back button when viewing detail */}
      {showDetailMobile && (
        <button
          onClick={() => onSelect(null)}
          className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 md:hidden"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      )}

      <div className="flex gap-6">
        <EntitiesListPanel
          entities={entities}
          filtered={filtered}
          filterOptions={filterOptions}
          filters={filters}
          setFilters={setFilters}
          selectedId={selectedId}
          onSelect={onSelect}
          hidden={!!showDetailMobile}
        />

        {/* Right panel — entity detail */}
        {!selectedId || !detail ? (
          <div className={`min-w-0 flex-1 ${showDetailMobile ? '' : 'hidden md:block'}`}>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
              <p className="text-zinc-500">Select an entity to view details</p>
            </div>
          </div>
        ) : (
          <EntitiesDetailPanel
            detail={detail}
            onTransactionClick={setModalGroup}
            hidden={!showDetailMobile}
          />
        )}
      </div>

      {/* Transaction detail modal */}
      <TransactionModal group={modalGroup} onClose={() => setModalGroup(null)} />
    </div>
  )
}
