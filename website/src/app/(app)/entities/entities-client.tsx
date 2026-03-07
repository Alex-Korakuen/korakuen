'use client'

import { useState } from 'react'
import { EntitiesListPanel } from './entities-list-panel'
import { EntitiesDetailPanel } from './entities-detail-panel'
import { TransactionModal } from './entities-transaction-modal'
import type {
  EntityListItem,
  EntityDetailData,
  EntitiesFilterOptions,
  ProjectTransactionGroup,
} from '@/lib/types'

type Props = {
  entities: EntityListItem[]
  totalCount: number
  page: number
  pageSize: number
  filterOptions: EntitiesFilterOptions
  detail: EntityDetailData | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  currentFilters: {
    search: string
    entityType: string
    tagId: string
    city: string
    region: string
  }
}

export function EntitiesClient({
  entities,
  totalCount,
  page,
  pageSize,
  filterOptions,
  detail,
  selectedId,
  onSelect,
  currentFilters,
}: Props) {
  const [modalGroup, setModalGroup] = useState<ProjectTransactionGroup | null>(null)

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
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          filterOptions={filterOptions}
          currentFilters={currentFilters}
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
