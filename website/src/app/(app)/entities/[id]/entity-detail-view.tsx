'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
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
import { updateEntityField, deactivateEntity } from '@/lib/actions'
import { SectionCard } from '@/components/ui/section-card'
import { InlineEdit } from '@/components/ui/inline-edit'
import { btnDangerIcon, iconTrash } from '@/lib/styles'
import { DeleteConfirmation } from '@/components/ui/delete-confirmation'
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
  const [mode, setMode] = useState<'view' | 'delete'>('view')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [modalGroup, setModalGroup] = useState<EntityLedgerGroup | null>(null)

  // Collapsible section state
  const [payablesOpen, setPayablesOpen] = useState(true)
  const [receivablesOpen, setReceivablesOpen] = useState(detail.receivablesByProject.length > 0)
  const [contactsOpen, setContactsOpen] = useState(true)

  const { entity } = detail

  // Inline edit save handler — curried by field name
  const saveField = useCallback(
    (field: 'legal_name' | 'city' | 'region' | 'notes') =>
      (value: string | number | null) =>
        updateEntityField(entity.id, field, value as string | null),
    [entity.id],
  )

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

      {/* Header right: deactivate button only */}
      {mode === 'view' && (
        <HeaderPortal>
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
        {/* ===== Metadata with Inline Editing ===== */}
        {mode === 'view' && (
          <div>
            {/* Locked fields + editable name on one line */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <StatusBadge label={formatEntityType(entity.entity_type)} variant="zinc" />
              {entity.document_number && (
                <span>{entity.document_type}: {entity.document_number}</span>
              )}
            </div>

            {/* Editable fields */}
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              <InlineEdit
                label="Legal Name"
                inputType="text"
                value={entity.legal_name}
                onSave={saveField('legal_name')}
                className="col-span-2"
              />
              <InlineEdit
                label="City"
                inputType="text"
                value={entity.city}
                placeholder="--"
                onSave={saveField('city')}
              />
              <InlineEdit
                label="Region"
                inputType="text"
                value={entity.region}
                placeholder="--"
                onSave={saveField('region')}
              />
            </div>

            <div className="mt-2">
              <InlineEdit
                label="Notes"
                inputType="textarea"
                value={entity.notes}
                placeholder="No notes"
                onSave={saveField('notes')}
              />
            </div>

            <EntityTagsDropdown
              entityId={entity.id}
              currentTags={detail.tags}
              availableTags={availableTags}
            />
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
      </div>

      {/* Transaction detail modal */}
      <TransactionModal group={modalGroup} onClose={() => setModalGroup(null)} />
    </div>
  )
}
