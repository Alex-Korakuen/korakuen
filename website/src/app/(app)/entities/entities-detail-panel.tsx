'use client'

import { useState, useTransition } from 'react'
import { formatCurrency, formatDate, formatEntityType } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { TabBar } from '@/components/ui/tab-bar'
import { EntityTagsDropdown } from './entity-tags-dropdown'
import { EntityContactsForm } from './entity-contacts-form'
import { updateEntity, deactivateEntity } from '@/lib/actions'
import { inputCompactClass } from '@/lib/styles'
import { useRouter } from 'next/navigation'
import type { Tab } from '@/components/ui/tab-bar'
import type { EntityDetailData, EntityLedgerGroup } from '@/lib/types'

type Props = {
  detail: EntityDetailData
  availableTags: { id: string; name: string }[]
  onLedgerClick: (group: EntityLedgerGroup) => void
  onDeactivated: () => void
  hidden: boolean
}

// --- Lock icon ---
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="inline-block text-zinc-300 ml-1">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
  )
}

function LedgerTable({ groups, onRowClick, emptyMessage }: {
  groups: EntityLedgerGroup[]
  onRowClick: (group: EntityLedgerGroup) => void
  emptyMessage: string
}) {
  if (groups.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-zinc-500">{emptyMessage}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Project</th>
            <th className="px-4 py-2 text-right font-medium">Invoice Total</th>
            <th className="px-4 py-2 text-right font-medium">Outstanding</th>
            <th className="px-4 py-2 text-right font-medium">Last Date</th>
            <th className="px-4 py-2 text-right font-medium">Currency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {groups.map((group) => (
            <tr
              key={`${group.projectId}|${group.currency}`}
              onClick={() => onRowClick(group)}
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
                {formatCurrency(group.invoiceTotal, group.currency)}
              </td>
              <td className={`px-4 py-2 text-right font-mono font-medium ${
                group.outstanding > 0 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {group.outstanding === 0 ? 'Paid' : formatCurrency(group.outstanding, group.currency)}
              </td>
              <td className="px-4 py-2 text-right text-zinc-600">
                {group.lastDate ? formatDate(group.lastDate) : '—'}
              </td>
              <td className="px-4 py-2 text-right text-zinc-600">{group.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EntitiesDetailPanel({ detail, availableTags, onLedgerClick, onDeactivated, hidden }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const [isPending, startTransition] = useTransition()

  // Edit form state
  const [editLegalName, setEditLegalName] = useState('')
  const [editCommonName, setEditCommonName] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editRegion, setEditRegion] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    setEditLegalName(detail.entity.legal_name)
    setEditCommonName(detail.entity.common_name ?? '')
    setEditCity(detail.entity.city ?? '')
    setEditRegion(detail.entity.region ?? '')
    setEditNotes(detail.entity.notes ?? '')
    setError(null)
    setMode('edit')
  }

  function handleSave() {
    if (!editLegalName.trim()) {
      setError('Legal name is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateEntity(detail.entity.id, {
        legal_name: editLegalName.trim(),
        common_name: editCommonName.trim() || undefined,
        city: editCity.trim() || undefined,
        region: editRegion.trim() || undefined,
        notes: editNotes.trim() || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setMode('view')
        router.refresh()
      }
    })
  }

  function handleDeactivate() {
    setError(null)
    startTransition(async () => {
      const result = await deactivateEntity(detail.entity.id)
      if (result.error) {
        setError(result.error)
      } else {
        onDeactivated()
        router.refresh()
      }
    })
  }

  const invoiceCount = detail.payablesByProject.reduce((sum, g) => sum + g.transactions.length, 0)
    + detail.receivablesByProject.reduce((sum, g) => sum + g.transactions.length, 0)
  const projectCount = new Set([
    ...detail.payablesByProject.map(g => g.projectId),
    ...detail.receivablesByProject.map(g => g.projectId),
  ]).size

  const tabs: Tab[] = [
    {
      key: 'contacts',
      label: 'Contacts',
      content: <EntityContactsForm entityId={detail.entity.id} contacts={detail.contacts} />,
    },
    {
      key: 'payables',
      label: 'Payables',
      content: (
        <LedgerTable
          groups={detail.payablesByProject}
          onRowClick={onLedgerClick}
          emptyMessage="No payables recorded"
        />
      ),
    },
    {
      key: 'receivables',
      label: 'Receivables',
      content: (
        <LedgerTable
          groups={detail.receivablesByProject}
          onRowClick={onLedgerClick}
          emptyMessage="No receivables recorded"
        />
      ),
    },
  ]

  return (
    <div className={`min-w-0 flex-1 ${hidden ? 'hidden md:block' : ''}`}>
      <div className="space-y-4">
        {/* Entity Header — View Mode */}
        {mode === 'view' && (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-zinc-800">
                  {detail.entity.legal_name}
                </h2>
                {detail.entity.common_name &&
                  detail.entity.common_name !== detail.entity.legal_name && (
                    <p className="mt-0.5 text-sm text-zinc-500">{detail.entity.common_name}</p>
                  )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={startEdit}
                  className="rounded border border-zinc-200 p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                  title="Edit entity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                  </svg>
                </button>
                <button
                  onClick={() => { setError(null); setMode('delete') }}
                  className="rounded border border-red-200 p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Deactivate entity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Type, document, location — single line */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <StatusBadge label={formatEntityType(detail.entity.entity_type)} variant="zinc" />
              {detail.entity.document_number && (
                <span>
                  {detail.entity.document_type}: {detail.entity.document_number}
                </span>
              )}
              {(detail.entity.city || detail.entity.region) && (
                <span>
                  {[detail.entity.city, detail.entity.region].filter(Boolean).join(', ')}
                </span>
              )}
            </div>

            {/* Tags */}
            <EntityTagsDropdown
              entityId={detail.entity.id}
              currentTags={detail.tags}
              availableTags={availableTags}
            />
          </div>
        )}

        {/* Entity Header — Edit Mode */}
        {mode === 'edit' && (
          <div className="rounded-lg border border-zinc-200 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700">Edit Entity</h3>

            {/* Locked fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="block text-[11px] font-medium text-zinc-400 mb-1">Type <LockIcon /></span>
                <StatusBadge label={formatEntityType(detail.entity.entity_type)} variant="zinc" />
              </div>
              <div>
                <span className="block text-[11px] font-medium text-zinc-400 mb-1">Doc Type <LockIcon /></span>
                <span className="text-sm text-zinc-500">{detail.entity.document_type}</span>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-zinc-400 mb-1">Doc Number <LockIcon /></span>
                <span className="text-sm font-mono text-zinc-500">{detail.entity.document_number}</span>
              </div>
            </div>

            <div className="border-t border-zinc-200" />

            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Legal Name</label>
                <input
                  type="text"
                  value={editLegalName}
                  onChange={(e) => setEditLegalName(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Common Name</label>
                <input
                  type="text"
                  value={editCommonName}
                  onChange={(e) => setEditCommonName(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                  placeholder="Short or trade name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">City</label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Region</label>
                <input
                  type="text"
                  value={editRegion}
                  onChange={(e) => setEditRegion(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                  placeholder="Department"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">Notes</label>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className={`${inputCompactClass} w-full bg-white resize-none`}
                placeholder="Optional notes..."
              />
            </div>

            {error && <p className="text-xs font-medium text-red-600">{error}</p>}

            <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
              <button
                onClick={() => setMode('view')}
                disabled={isPending}
                className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !editLegalName.trim()}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Entity Header — Delete Mode */}
        {mode === 'delete' && (
          <div className="space-y-4">
            <div className="opacity-40 pointer-events-none">
              <h2 className="text-xl font-semibold text-zinc-800">{detail.entity.legal_name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <StatusBadge label={formatEntityType(detail.entity.entity_type)} variant="zinc" />
                {detail.entity.document_number && (
                  <span>{detail.entity.document_type}: {detail.entity.document_number}</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border-2 border-red-200 bg-red-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 rounded-full bg-red-100 p-1.5">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-red-500">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800">Deactivate this entity?</h4>
                  <p className="text-sm text-red-700 mt-1">
                    {detail.entity.common_name || detail.entity.legal_name} has{' '}
                    <strong>{invoiceCount} linked invoice{invoiceCount !== 1 ? 's' : ''}</strong>
                    {projectCount > 0 && <> across {projectCount} project{projectCount !== 1 ? 's' : ''}</>}.
                    The entity will be hidden from search and dropdowns but all financial history is preserved.
                  </p>
                  <p className="text-xs text-red-500 mt-2">This action can be reversed by an administrator.</p>

                  {error && <p className="text-xs font-medium text-red-800 mt-2">{error}</p>}

                  <div className="flex items-center justify-end gap-3 mt-4">
                    <button
                      onClick={() => setMode('view')}
                      disabled={isPending}
                      className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeactivate}
                      disabled={isPending}
                      className="rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {isPending ? 'Deactivating...' : 'Yes, deactivate'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabbed sections — always visible */}
        {mode !== 'delete' && (
          <div className="rounded-lg border border-zinc-200 bg-white">
            <TabBar tabs={tabs} defaultTab="contacts" />
          </div>
        )}
      </div>
    </div>
  )
}
