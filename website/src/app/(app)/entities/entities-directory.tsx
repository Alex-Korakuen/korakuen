'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { formatCurrency, formatEntityType } from '@/lib/formatters'
import { SearchInput } from '@/components/ui/search-input'
import { FilterSelect } from '@/components/ui/filter-select'
import { Pagination } from '@/components/ui/pagination'
import { HeaderPortal } from '@/components/ui/header-portal'
import { useUrlFilters } from '@/lib/use-url-filters'
import { FK } from '@/lib/filter-keys'
import { btnPrimary, tableHead, tableRowHover, selectClass } from '@/lib/styles'
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
  const { setFilter } = useUrlFilters()
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

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <SearchInput
            placeholder="Search by name or document..."
            defaultValue={currentFilters.search}
          />
        </div>
        <FilterSelect
          label="Type"
          value={currentFilters.entityType}
          onChange={(v) => setFilter(FK.entityType, v)}
          options={[
            { value: 'company', label: 'Company' },
            { value: 'individual', label: 'Individual' },
          ]}
          placeholder="All Types"
        />
        <FilterSelect
          label="Tag"
          value={currentFilters.tagId}
          onChange={(v) => setFilter(FK.tagId, v)}
          options={filterOptions.tags.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="All Tags"
        />
        <FilterSelect
          label="City"
          value={currentFilters.city}
          onChange={(v) => setFilter(FK.city, v)}
          options={filterOptions.cities.map((c) => ({ value: c, label: c }))}
          placeholder="All Cities"
        />
        <FilterSelect
          label="Region"
          value={currentFilters.region}
          onChange={(v) => setFilter(FK.region, v)}
          options={filterOptions.regions.map((r) => ({ value: r, label: r }))}
          placeholder="All Regions"
        />
      </div>

      {/* Directory table */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        {entities.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-zinc-500">
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
              <tbody className="divide-y divide-zinc-100">
                {entities.map((entity) => {
                  const cur = entity.currency ?? 'PEN'
                  const hasFinancials = entity.totalPayable > 0 || entity.totalReceivable > 0

                  return (
                    <tr key={entity.id} className={tableRowHover}>
                      <td className="px-4 py-2.5 text-center">
                        <Link
                          href={`/entities/${entity.id}`}
                          className="block"
                        >
                          <span className="font-medium text-zinc-800">
                            {entity.legal_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                          entity.entity_type === 'company'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {formatEntityType(entity.entity_type)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-xs text-zinc-500">
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
                            <span className="text-[10px] text-zinc-400">+{entity.tags.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-xs">
                        {hasFinancials && entity.outstandingPayable > 0 ? (
                          <span className="text-red-600">{formatCurrency(entity.outstandingPayable, cur)}</span>
                        ) : hasFinancials ? (
                          <span className="text-zinc-300">—</span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-xs">
                        {hasFinancials && entity.outstandingReceivable > 0 ? (
                          <span className="text-green-600">{formatCurrency(entity.outstandingReceivable, cur)}</span>
                        ) : (
                          <span className="text-zinc-300">—</span>
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
      </div>

      <CreateEntityModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
