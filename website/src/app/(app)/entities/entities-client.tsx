'use client'

import { useMemo, useState } from 'react'
import { formatCurrency, formatDate, formatEntityType } from '@/lib/formatters'
import type {
  EntityListItem,
  EntityDetailData,
  EntitiesFilterOptions,
  EntityFilters,
  Currency,
  ProjectTransactionGroup,
} from '@/lib/types'

type Props = {
  entities: EntityListItem[]
  filterOptions: EntitiesFilterOptions
  detail: EntityDetailData | null
  selectedId: string | null
  onSelect: (id: string | null) => void
}

// Stable tag colors — hash tag name to one of several muted hues
const TAG_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
]

function tagColor(tagName: string): string {
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
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
      // Search filter — matches legal_name, common_name, or document_number
      if (search) {
        const inLegal = e.legal_name.toLowerCase().includes(search)
        const inCommon = e.common_name?.toLowerCase().includes(search) ?? false
        const inDoc = e.document_number?.toLowerCase().includes(search) ?? false
        if (!inLegal && !inCommon && !inDoc) return false
      }

      // Entity type filter
      if (filters.entityType && e.entity_type !== filters.entityType) return false

      // Tag filter — match by tag name (since entity list stores tag names, not ids)
      if (selectedTagName && !e.tags.includes(selectedTagName)) return false

      // City filter
      if (filters.city && e.city !== filters.city) return false

      // Region filter
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
        {/* Left panel — entity list */}
        <div className={`w-full shrink-0 md:w-[320px] ${showDetailMobile ? 'hidden md:block' : ''}`}>
          {/* Search */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search entities..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 placeholder-zinc-400"
            />
          </div>

          {/* Filter row */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <select
              value={filters.entityType}
              onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
            >
              <option value="">All Types</option>
              <option value="company">Company</option>
              <option value="individual">Individual</option>
            </select>

            <select
              value={filters.tagId}
              onChange={(e) => setFilters((f) => ({ ...f, tagId: e.target.value }))}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
            >
              <option value="">All Tags</option>
              {filterOptions.tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
            >
              <option value="">All Cities</option>
              {filterOptions.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filters.region}
              onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
            >
              <option value="">All Regions</option>
              {filterOptions.regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Entity list */}
          <div className="rounded-lg border border-zinc-200">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                No entities match filters
              </div>
            ) : (
              <div className="max-h-[calc(100vh-260px)] divide-y divide-zinc-100 overflow-y-auto">
                {filtered.map((entity) => (
                  <button
                    key={entity.id}
                    onClick={() => onSelect(entity.id)}
                    className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-blue-50 ${
                      selectedId === entity.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-800">
                          {entity.common_name || entity.legal_name}
                        </p>
                        {entity.common_name && entity.common_name !== entity.legal_name && (
                          <p className="truncate text-xs text-zinc-500">{entity.legal_name}</p>
                        )}
                      </div>
                      {entity.document_number && (
                        <span className="shrink-0 text-xs font-mono text-zinc-400">
                          {entity.document_number}
                        </span>
                      )}
                    </div>
                    {entity.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entity.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tagColor(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-2 text-xs text-zinc-400">
            {filtered.length} of {entities.length} entities
          </p>
        </div>

        {/* Right panel — entity detail */}
        <div className={`min-w-0 flex-1 ${showDetailMobile ? '' : 'hidden md:block'}`}>
          {!selectedId || !detail ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
              <p className="text-zinc-500">Select an entity to view details</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Entity Header */}
              <div>
                <h2 className="text-xl font-semibold text-zinc-800">
                  {detail.entity.legal_name}
                </h2>
                {detail.entity.common_name &&
                  detail.entity.common_name !== detail.entity.legal_name && (
                    <p className="mt-0.5 text-sm text-zinc-500">{detail.entity.common_name}</p>
                  )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {/* Entity type badge */}
                  <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {formatEntityType(detail.entity.entity_type)}
                  </span>

                  {/* Document */}
                  {detail.entity.document_number && (
                    <span className="text-xs text-zinc-500">
                      {detail.entity.document_type}: {detail.entity.document_number}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {detail.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {detail.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Location */}
                {(detail.entity.city || detail.entity.region) && (
                  <p className="mt-2 text-xs text-zinc-500">
                    {[detail.entity.city, detail.entity.region].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              {/* Contacts */}
              <div className="rounded-lg border border-zinc-200">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <h3 className="text-sm font-medium text-zinc-700">Contacts</h3>
                </div>
                {detail.contacts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-zinc-500">No contacts</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-xs text-zinc-500">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Name</th>
                          <th className="px-4 py-2 text-left font-medium">Role</th>
                          <th className="px-4 py-2 text-left font-medium">Phone</th>
                          <th className="px-4 py-2 text-left font-medium">Email</th>
                          <th className="px-4 py-2 text-center font-medium">Primary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {detail.contacts.map((c) => (
                          <tr key={c.id} className="transition-colors hover:bg-blue-50">
                            <td className="px-4 py-2 text-zinc-800">{c.full_name}</td>
                            <td className="px-4 py-2 text-zinc-600">{c.role ?? '—'}</td>
                            <td className="px-4 py-2 text-zinc-600">{c.phone ?? '—'}</td>
                            <td className="px-4 py-2 text-zinc-600">{c.email ?? '—'}</td>
                            <td className="px-4 py-2 text-center">
                              {c.is_primary && (
                                <svg
                                  className="mx-auto h-4 w-4 text-amber-500"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Transaction History */}
              <div className="rounded-lg border border-zinc-200">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <h3 className="text-sm font-medium text-zinc-700">Transaction History</h3>
                </div>
                {detail.transactionsByProject.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-zinc-500">
                    No transactions recorded
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-xs text-zinc-500">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Project</th>
                          <th className="px-4 py-2 text-right font-medium">AP Total</th>
                          <th className="px-4 py-2 text-right font-medium">AR Total</th>
                          <th className="px-4 py-2 text-right font-medium">Net</th>
                          <th className="px-4 py-2 text-right font-medium">Last Date</th>
                          <th className="px-4 py-2 text-right font-medium">Currency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {detail.transactionsByProject.map((group) => {
                          const cur = group.currency as Currency
                          return (
                            <tr
                              key={`${group.projectId}|${group.currency}`}
                              onClick={() => setModalGroup(group)}
                              className="cursor-pointer transition-colors hover:bg-blue-50"
                            >
                              <td className="px-4 py-2">
                                <a
                                  href={`/projects?selected=${group.projectId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {group.projectCode}
                                </a>
                                <span className="ml-1.5 hidden text-zinc-500 lg:inline">— {group.projectName}</span>
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-zinc-700">
                                {group.apTotal > 0 ? formatCurrency(group.apTotal, cur) : '—'}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-zinc-700">
                                {group.arTotal > 0 ? formatCurrency(group.arTotal, cur) : '—'}
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-mono font-medium ${
                                  group.net > 0 ? 'text-green-600' : group.net < 0 ? 'text-red-600' : 'text-zinc-600'
                                }`}
                              >
                                {formatCurrency(group.net, cur)}
                              </td>
                              <td className="px-4 py-2 text-right text-zinc-600">
                                {group.lastDate ? formatDate(group.lastDate) : '—'}
                              </td>
                              <td className="px-4 py-2 text-right text-zinc-600">{group.currency}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction detail modal */}
      {modalGroup && (
        <TransactionModal group={modalGroup} onClose={() => setModalGroup(null)} />
      )}
    </div>
  )
}

// --- Transaction detail modal ---

function TransactionModal({
  group,
  onClose,
}: {
  group: ProjectTransactionGroup
  onClose: () => void
}) {
  const cur = group.currency as Currency

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="mx-4 max-h-[80vh] w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-800">
              {group.projectCode} — {group.projectName}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {group.transactions.length} transaction{group.transactions.length === 1 ? '' : 's'} · {group.currency}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Transaction list */}
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Title</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {group.transactions.map((tx) => (
                <tr key={tx.transaction_id} className="transition-colors hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-5 py-2 text-zinc-700">
                    {tx.date ? formatDate(tx.date) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        tx.transaction_type === 'cost'
                          ? 'bg-zinc-100 text-zinc-600'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {tx.transaction_type === 'cost' ? 'Cost' : 'AR Invoice'}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2 text-zinc-700">
                    {tx.title ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                    {tx.amount != null ? formatCurrency(tx.amount, cur) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
