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
import { SectionCard } from '@/components/ui/section-card'
import { NotesDisplay } from '@/components/ui/notes-display'
import { inputCompactClass, btnEditIcon, btnDangerIcon, iconPencil, iconTrash } from '@/lib/styles'
import { DeleteConfirmation } from '@/components/ui/delete-confirmation'
import { LockIcon } from '@/components/ui/lock-icon'
import type { EntityDetailData, EntityLedgerGroup } from '@/lib/types'

const TransactionModal = dynamic(() => import('../entities-transaction-modal').then(m => ({ default: m.TransactionModal })))

type Props = {
  detail: EntityDetailData
  availableTags: { id: string; name: string }[]
}

// --- Chevron icon ---
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}
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
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Entities
        </Link>
        <div className="h-4 w-px bg-edge" />
        <span className="text-sm text-muted truncate">
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
            aria-label="Edit entity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d={iconPencil} />
            </svg>
          </button>
          <button
            onClick={() => { setError(null); setMode('delete') }}
            className={`${btnDangerIcon}`}
            title="Deactivate entity"
            aria-label="Deactivate entity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d={iconTrash} clipRule="evenodd" />
            </svg>
          </button>
        </HeaderPortal>
      )}

      <div className="space-y-5">
        {/* ===== View Mode Metadata — no duplicate title, shown in header breadcrumb ===== */}
        {mode === 'view' && (
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
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
          <div className="rounded-[10px] border border-edge p-4 space-y-4">
            <h3 className="text-sm font-semibold text-ink">Edit Entity</h3>

            {/* Locked fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="block text-[11px] font-medium text-faint mb-1">Type <LockIcon /></span>
                <StatusBadge label={formatEntityType(entity.entity_type)} variant="zinc" />
              </div>
              <div>
                <span className="block text-[11px] font-medium text-faint mb-1">Doc Type <LockIcon /></span>
                <span className="text-sm text-muted">{entity.document_type}</span>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-faint mb-1">Doc Number <LockIcon /></span>
                <span className="text-sm font-mono text-muted">{entity.document_number}</span>
              </div>
            </div>

            <div className="border-t border-edge" />

            {/* Editable fields */}
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">Legal Name</label>
              <input type="text" value={editLegalName} onChange={(e) => setEditLegalName(e.target.value)} className={`${inputCompactClass} w-full bg-white`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">City</label>
                <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} className={`${inputCompactClass} w-full bg-white`} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">Region</label>
                <input type="text" value={editRegion} onChange={(e) => setEditRegion(e.target.value)} className={`${inputCompactClass} w-full bg-white`} placeholder="Department" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">Notes</label>
              <textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className={`${inputCompactClass} w-full bg-white resize-none`} placeholder="Optional notes..." />
            </div>

            {error && <p className="text-xs font-medium text-negative">{error}</p>}

            <div className="flex items-center justify-between border-t border-edge pt-3">
              <button onClick={() => setMode('view')} disabled={isPending} className="rounded-md border border-edge-strong px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isPending || !editLegalName.trim()} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* ===== Delete Confirmation ===== */}
        {mode === 'delete' && (
          <div className="space-y-4">
            <div className="opacity-40 pointer-events-none">
              <h2 className="text-lg font-semibold text-ink">{entity.legal_name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <StatusBadge label={formatEntityType(entity.entity_type)} variant="zinc" />
                {entity.document_number && (
                  <span>{entity.document_type}: {entity.document_number}</span>
                )}
              </div>
            </div>

            <DeleteConfirmation
              title="Deactivate this entity?"
              message={<>
                {entity.legal_name} has{' '}
                <strong>{invoiceCount} linked invoice{invoiceCount !== 1 ? 's' : ''}</strong>
                {projectCount > 0 && <> across {projectCount} project{projectCount !== 1 ? 's' : ''}</>}.
                The entity will be hidden from search and dropdowns but all financial history is preserved.
              </>}
              isPending={isPending}
              error={error}
              onCancel={() => setMode('view')}
              onConfirm={handleDeactivate}
            />
          </div>
        )}

        {/* ===== Summary Cards ===== */}
        {mode === 'view' && (summaries.totalPayable > 0 || summaries.totalReceivable > 0) && (
          <div className="grid grid-cols-2 gap-4">
            <SectionCard className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Payable (Outstanding)</p>
              <p className={`mt-1 text-2xl font-semibold font-mono ${summaries.outPayable > 0 ? 'text-negative' : 'text-edge-strong'}`}>
                {summaries.outPayable > 0 ? formatCurrency(summaries.outPayable, summaries.currency) : '—'}
              </p>
              <p className="mt-1 text-xs text-faint">
                {formatCurrency(summaries.totalPayable, summaries.currency)} total across {detail.payablesByProject.length} project{detail.payablesByProject.length !== 1 ? 's' : ''}
              </p>
            </SectionCard>
            <SectionCard className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Receivable (Outstanding)</p>
              <p className={`mt-1 text-2xl font-semibold font-mono ${summaries.outReceivable > 0 ? 'text-positive' : 'text-edge-strong'}`}>
                {summaries.outReceivable > 0 ? formatCurrency(summaries.outReceivable, summaries.currency) : '—'}
              </p>
              <p className="mt-1 text-xs text-faint">
                {summaries.totalReceivable > 0
                  ? `${formatCurrency(summaries.totalReceivable, summaries.currency)} total across ${detail.receivablesByProject.length} project${detail.receivablesByProject.length !== 1 ? 's' : ''}`
                  : 'No receivable invoices'}
              </p>
            </SectionCard>
          </div>
        )}

        {/* ===== Payables Section ===== */}
        {mode !== 'delete' && (
          <SectionCard className="overflow-hidden">
            <button
              onClick={() => setPayablesOpen(!payablesOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                Payables by Project
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {detail.payablesByProject.length}
                </span>
              </h3>
              <ChevronIcon open={payablesOpen} />
            </button>
            {payablesOpen && (
              <div className="border-t border-edge">
                <LedgerTable
                  groups={detail.payablesByProject}
                  onRowClick={setModalGroup}
                  emptyMessage="No payables recorded"
                />
              </div>
            )}
          </SectionCard>
        )}

        {/* ===== Receivables Section ===== */}
        {mode !== 'delete' && (
          <SectionCard className="overflow-hidden">
            <button
              onClick={() => setReceivablesOpen(!receivablesOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                Receivables by Project
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {detail.receivablesByProject.length}
                </span>
              </h3>
              <ChevronIcon open={receivablesOpen} />
            </button>
            {receivablesOpen && (
              <div className="border-t border-edge">
                <LedgerTable
                  groups={detail.receivablesByProject}
                  onRowClick={setModalGroup}
                  emptyMessage="No receivables recorded"
                />
              </div>
            )}
          </SectionCard>
        )}

        {/* ===== Contacts Section ===== */}
        {mode !== 'delete' && (
          <SectionCard className="overflow-hidden">
            <button
              onClick={() => setContactsOpen(!contactsOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                Contacts
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {detail.contacts.length}
                </span>
              </h3>
              <ChevronIcon open={contactsOpen} />
            </button>
            {contactsOpen && (
              <div className="border-t border-edge">
                <EntityContactsForm entityId={entity.id} contacts={detail.contacts} />
              </div>
            )}
          </SectionCard>
        )}

        {/* ===== Notes ===== */}
        {mode === 'view' && entity.notes && (
          <SectionCard className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">Notes</h3>
            <NotesDisplay notes={entity.notes} />
          </SectionCard>
        )}
      </div>

      {/* Transaction detail modal */}
      <TransactionModal group={modalGroup} onClose={() => setModalGroup(null)} />
    </div>
  )
}
