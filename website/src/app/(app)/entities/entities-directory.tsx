'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { formatCurrency, formatEntityType } from '@/lib/formatters'
import { FilterBar } from '@/components/ui/filter-bar'
import { Pagination } from '@/components/ui/pagination'
import { HeaderPortal } from '@/components/ui/header-portal'
import { FK } from '@/lib/filter-keys'
import { SectionCard } from '@/components/ui/section-card'
import { btnPrimary, tableHead, tableRowHover } from '@/lib/styles'
import { tagColor } from './helpers'
import type { EntityDirectoryItem, EntitiesFilterOptions } from '@/lib/types'

const CreateEntityModal = dynamic(() => import('./create-entity-modal').then(m => ({ default: m.CreateEntityModal })))

type Props = {
  entities: EntityDirectoryItem[]
  totalCount: number
  page: number
  pageSize: number
  filterOptions: EntitiesFilterOptions
  currentFilters: {
    search: string
    entityType: string
    tagId: string
    city: string
    region: string
  }
}

export function EntitiesDirectory({
  entities,
  totalCount,
  page,
  pageSize,
  filterOptions,
  currentFilters,
}: Props) {
  const [showCreate, setShowCreate] = useState(false)

  return (
    <>
      <HeaderPortal>
        <button
          onClick={() => setShowCreate(true)}
          className={`${btnPrimary}`}
        >
          + New Entity
        </button>
      </HeaderPortal>

      <FilterBar
        currentFilters={currentFilters}
        className="mb-4 flex flex-wrap items-end gap-3"
        filters={[
          { type: 'search', placeholder: 'Search by name or document...', width: 'w-64' },
          { type: 'select', key: FK.entityType, label: 'Type', options: [{ value: 'company', label: 'Company' }, { value: 'individual', label: 'Individual' }], placeholder: 'All Types' },
          { type: 'select', key: FK.tagId, label: 'Tag', options: filterOptions.tags.map(t => ({ value: t.id, label: t.name })), placeholder: 'All Tags' },
          { type: 'select', key: FK.city, label: 'City', options: filterOptions.cities.map(c => ({ value: c, label: c })), placeholder: 'All Cities' },
          { type: 'select', key: FK.region, label: 'Region', options: filterOptions.regions.map(r => ({ value: r, label: r })), placeholder: 'All Regions' },
        ]}
      />

      {/* Directory table */}
      <SectionCard>
        {entities.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-faint">
            No entities match filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={tableHead}>
                <tr>
                  <th className="px-4 py-2.5 text-center font-medium">Name</th>
                  <th className="px-4 py-2.5 text-center font-medium">Type</th>
                  <th className="px-4 py-2.5 text-center font-medium">Document</th>
                  <th className="px-4 py-2.5 text-center font-medium">Tags</th>
                  <th className="px-4 py-2.5 text-center font-medium">Payable</th>
                  <th className="px-4 py-2.5 text-center font-medium">Receivable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {entities.map((entity) => {
                  const cur = entity.currency
                  const hasFinancials = entity.totalPayable > 0 || entity.totalReceivable > 0

                  return (
                    <tr key={entity.id} className={tableRowHover}>
                      <td className="px-4 py-2.5 text-center">
                        <Link
                          href={`/entities/${entity.id}`}
                          className="block"
                        >
                          <span className="font-medium text-ink">
                            {entity.legal_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                          entity.entity_type === 'company'
                            ? 'bg-info-bg text-info'
                            : 'bg-surface text-muted'
                        }`}>
                          {formatEntityType(entity.entity_type)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-xs text-muted">
                        {entity.document_number || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {entity.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tagColor(tag)}`}
                            >
                              {tag}
                            </span>
                          ))}
                          {entity.tags.length > 3 && (
                            <span className="text-[10px] text-faint">+{entity.tags.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-xs">
                        {hasFinancials && entity.outstandingPayable > 0 ? (
                          <span className="text-negative">{formatCurrency(entity.outstandingPayable, cur)}</span>
                        ) : (
                          <span className="text-edge-strong">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-xs">
                        {hasFinancials && entity.outstandingReceivable > 0 ? (
                          <span className="text-positive">{formatCurrency(entity.outstandingReceivable, cur)}</span>
                        ) : (
                          <span className="text-edge-strong">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalCount={totalCount} pageSize={pageSize} />
      </SectionCard>

      <CreateEntityModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
