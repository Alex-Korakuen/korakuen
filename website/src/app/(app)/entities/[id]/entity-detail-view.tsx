'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { formatCurrency, formatEntityType } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { HeaderPortal } from '@/components/ui/header-portal'
import { HeaderTitlePortal } from '@/components/ui/header-title-portal'
import { EntityTagsDropdown } from '../entity-tags-dropdown'
import { EntityContactsForm } from '../entity-contacts-form'
import { LedgerTable } from '../ledger-table'
import { updateEntity, deactivateEntity } from '@/lib/actions'
import { inputCompactClass, btnEditIcon, btnDangerIcon } from '@/lib/styles'
import type { EntityDetailData, EntityLedgerGroup } from '@/lib/types'

const TransactionModal = dynamic(() => import('../entities-transaction-modal').then(m => ({ default: m.TransactionModal })))

type Props = {
  detail: EntityDetailData
  availableTags: { id: string; name: string }[]
}

// --- Lock icon ---
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="inline-block text-zinc-300 ml-1">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
  )
}

// --- Chevron icon ---
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="4 6 8 10 12 6" />
    </svg>
  )
}

export function EntityDetailView({ detail, availableTags }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const [isPending, startTransition] = useTransition()
  const [modalGroup, setModalGroup] = useState<EntityLedgerGroup | null>(null)

  // Collapsible section state
  const [payablesOpen, setPayablesOpen] = useState(true)
  const [receivablesOpen, setReceivablesOpen] = useState(detail.receivablesByProject.length > 0)
  const [contactsOpen, setContactsOpen] = useState(true)

  // Edit form state
  const [editLegalName, setEditLegalName] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editRegion, setEditRegion] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { entity } = detail

  function startEdit() {
    setEditLegalName(entity.legal_name)
    setEditCity(entity.city ?? '')
    setEditRegion(entity.region ?? '')
    setEditNotes(entity.notes ?? '')
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
      const result = await updateEntity(entity.id, {
        legal_name: editLegalName.trim(),
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
      const result = await deactivateEntity(entity.id)
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/entities')
      }
    })
  }

  const invoiceCount = detail.payablesByProject.reduce((sum, g) => sum + g.transactions.length, 0)
    + detail.receivablesByProject.reduce((sum, g) => sum + g.transactions.length, 0)
  const projectCount = new Set([
    ...detail.payablesByProject.map(g => g.projectId),
    ...detail.receivablesByProject.map(g => g.projectId),
  ]).size

  // Compute financial summaries from existing data
  const summaries = useMemo(() => {
    let outPayable = 0, totalPayable = 0, outReceivable = 0, totalReceivable = 0
    let currency = 'PEN'
    for (const g of detail.payablesByProject) {
      outPayable += g.outstanding
      totalPayable += g.invoiceTotal
      currency = g.currency
    }
    for (const g of detail.receivablesByProject) {
      outReceivable += g.outstanding
      totalReceivable += g.invoiceTotal
      currency = g.currency
    }
    return { outPayable, totalPayable, outReceivable, totalReceivable, currency }
  }, [detail.payablesByProject, detail.receivablesByProject])

  return (
    <div>
      {/* Header left: breadcrumb */}
      <HeaderTitlePortal>
        <Link
          href="/entities"
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Entities
        </Link>
        <div className="h-4 w-px bg-zinc-200" />
        <span className="text-sm text-zinc-600 truncate">
          {entity.legal_name}
        </span>
      </HeaderTitlePortal>

      {/* Header right: edit + deactivate buttons */}
      {mode === 'view' && (
        <HeaderPortal>
          <button
            onClick={startEdit}
            className={`${btnEditIcon}`}
            title="Edit entity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
            </svg>
          </button>
          <button
            onClick={() => { setError(null); setMode('delete') }}
            className={`${btnDangerIcon}`}
            title="Deactivate entity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
          </button>
        </HeaderPortal>
      )}

      <div className="space-y-5 p-6">
        {/* ===== View Mode Metadata — no duplicate title, shown in header breadcrumb ===== */}
        {mode === 'view' && (
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <StatusBadge label={formatEntityType(entity.entity_type)} variant="zinc" />
              {entity.document_number && (
                <span>{entity.document_type}: {entity.document_number}</span>
              )}
              {(entity.city || entity.region) && (
                <span>{[entity.city, entity.region].filter(Boolean).join(', ')}</span>
              )}
            </div>
            <EntityTagsDropdown
              entityId={entity.id}
              currentTags={detail.tags}
              availableTags={availableTags}
            />
          </div>
        )}

        {/* ===== Edit Mode ===== */}
        {mode === 'edit' && (
          <div className="rounded-lg border border-zinc-200 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700">Edit Entity</h3>

            {/* Locked fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="block text-[11px] font-medium text-zinc-400 mb-1">Type <LockIcon /></span>
                <StatusBadge label={formatEntityType(entity.entity_type)} variant="zinc" />
              </div>
              <div>
                <span className="block text-[11px] font-medium text-zinc-400 mb-1">Doc Type <LockIcon /></span>
                <span className="text-sm text-zinc-500">{entity.document_type}</span>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-zinc-400 mb-1">Doc Number <LockIcon /></span>
                <span className="text-sm font-mono text-zinc-500">{entity.document_number}</span>
              </div>
            </div>

            <div className="border-t border-zinc-200" />

            {/* Editable fields */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">Legal Name</label>
              <input type="text" value={editLegalName} onChange={(e) => setEditLegalName(e.target.value)} className={`${inputCompactClass} w-full bg-white`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">City</label>
                <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} className={`${inputCompactClass} w-full bg-white`} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Region</label>
                <input type="text" value={editRegion} onChange={(e) => setEditRegion(e.target.value)} className={`${inputCompactClass} w-full bg-white`} placeholder="Department" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">Notes</label>
              <textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className={`${inputCompactClass} w-full bg-white resize-none`} placeholder="Optional notes..." />
            </div>

            {error && <p className="text-xs font-medium text-red-600">{error}</p>}

            <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
              <button onClick={() => setMode('view')} disabled={isPending} className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isPending || !editLegalName.trim()} className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* ===== Delete Confirmation ===== */}
        {mode === 'delete' && (
          <div className="space-y-4">
            <div className="opacity-40 pointer-events-none">
              <h2 className="text-lg font-semibold text-zinc-800">{entity.legal_name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <StatusBadge label={formatEntityType(entity.entity_type)} variant="zinc" />
                {entity.document_number && (
                  <span>{entity.document_type}: {entity.document_number}</span>
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
                    {entity.legal_name} has{' '}
                    <strong>{invoiceCount} linked invoice{invoiceCount !== 1 ? 's' : ''}</strong>
                    {projectCount > 0 && <> across {projectCount} project{projectCount !== 1 ? 's' : ''}</>}.
                    The entity will be hidden from search and dropdowns but all financial history is preserved.
                  </p>
                  <p className="text-xs text-red-500 mt-2">This action can be reversed by an administrator.</p>

                  {error && <p className="text-xs font-medium text-red-800 mt-2">{error}</p>}

                  <div className="flex items-center justify-end gap-3 mt-4">
                    <button onClick={() => setMode('view')} disabled={isPending} className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50">
                      Cancel
                    </button>
                    <button onClick={handleDeactivate} disabled={isPending} className="rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">
                      {isPending ? 'Deactivating...' : 'Yes, deactivate'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Summary Cards ===== */}
        {mode === 'view' && (summaries.totalPayable > 0 || summaries.totalReceivable > 0) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Payable (Outstanding)</p>
              <p className={`mt-1 text-2xl font-semibold font-mono ${summaries.outPayable > 0 ? 'text-red-600' : 'text-zinc-300'}`}>
                {summaries.outPayable > 0 ? formatCurrency(summaries.outPayable, summaries.currency) : '—'}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {formatCurrency(summaries.totalPayable, summaries.currency)} total across {detail.payablesByProject.length} project{detail.payablesByProject.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Receivable (Outstanding)</p>
              <p className={`mt-1 text-2xl font-semibold font-mono ${summaries.outReceivable > 0 ? 'text-green-600' : 'text-zinc-300'}`}>
                {summaries.outReceivable > 0 ? formatCurrency(summaries.outReceivable, summaries.currency) : '—'}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {summaries.totalReceivable > 0
                  ? `${formatCurrency(summaries.totalReceivable, summaries.currency)} total across ${detail.receivablesByProject.length} project${detail.receivablesByProject.length !== 1 ? 's' : ''}`
                  : 'No receivable invoices'}
              </p>
            </div>
          </div>
        )}

        {/* ===== Payables Section ===== */}
        {mode !== 'delete' && (
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <button
              onClick={() => setPayablesOpen(!payablesOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                Payables by Project
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                  {detail.payablesByProject.length}
                </span>
              </h3>
              <ChevronIcon open={payablesOpen} />
            </button>
            {payablesOpen && (
              <div className="border-t border-zinc-200">
                <LedgerTable
                  groups={detail.payablesByProject}
                  onRowClick={setModalGroup}
                  emptyMessage="No payables recorded"
                />
              </div>
            )}
          </div>
        )}

        {/* ===== Receivables Section ===== */}
        {mode !== 'delete' && (
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <button
              onClick={() => setReceivablesOpen(!receivablesOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                Receivables by Project
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                  {detail.receivablesByProject.length}
                </span>
              </h3>
              <ChevronIcon open={receivablesOpen} />
            </button>
            {receivablesOpen && (
              <div className="border-t border-zinc-200">
                <LedgerTable
                  groups={detail.receivablesByProject}
                  onRowClick={setModalGroup}
                  emptyMessage="No receivables recorded"
                />
              </div>
            )}
          </div>
        )}

        {/* ===== Contacts Section ===== */}
        {mode !== 'delete' && (
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <button
              onClick={() => setContactsOpen(!contactsOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                Contacts
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                  {detail.contacts.length}
                </span>
              </h3>
              <ChevronIcon open={contactsOpen} />
            </button>
            {contactsOpen && (
              <div className="border-t border-zinc-200">
                <EntityContactsForm entityId={entity.id} contacts={detail.contacts} />
              </div>
            )}
          </div>
        )}

        {/* ===== Notes ===== */}
        {mode === 'view' && entity.notes && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-700">Notes</h3>
            <p className="whitespace-pre-wrap text-sm text-zinc-600">{entity.notes}</p>
          </div>
        )}
      </div>

      {/* Transaction detail modal */}
      <TransactionModal group={modalGroup} onClose={() => setModalGroup(null)} />
    </div>
  )
}
