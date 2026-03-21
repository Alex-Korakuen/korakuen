'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  formatCurrency,
  formatDate,
  formatProjectStatus,
  projectStatusBadgeVariant,
  formatProjectType,
} from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { HeaderPortal } from '@/components/ui/header-portal'
import { HeaderTitlePortal } from '@/components/ui/header-title-portal'
import { ProjectPartnerSettlement } from '../project-partner-settlement'
import { ProjectBudgetForm } from '../project-budget-form'
import { updateProject } from '@/lib/actions'
import { inputCompactClass, btnEditIcon, iconPencil } from '@/lib/styles'

import { LockIcon } from '@/components/ui/lock-icon'
import type { ProjectDetailData, ProjectEntitySummary, PartnerCompanyOption, CategoryOption } from '@/lib/types'

type Props = {
  detail: ProjectDetailData
  partnerCompanies: PartnerCompanyOption[]
  categories: CategoryOption[]
}

// --- Paginated Entities Section ---
const ENTITIES_PAGE_SIZE = 5

function EntitiesPaginated({ entities }: { entities: ProjectEntitySummary[] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search.trim()) return entities
    const q = search.toLowerCase()
    return entities.filter(e =>
      e.entityName.toLowerCase().includes(q) ||
      e.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [entities, search])

  // Reset to page 1 when search changes
  const totalPages = Math.max(1, Math.ceil(filtered.length / ENTITIES_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * ENTITIES_PAGE_SIZE
  const pageItems = filtered.slice(start, start + ENTITIES_PAGE_SIZE)

  // Currency totals for ALL filtered items (not just current page)
  const currencyTotals = useMemo(() => {
    const byCurrency: Record<string, { total: number; count: number }> = {}
    for (const e of filtered) {
      if (e.totalSpent === null) continue
      const c = e.currency
      if (!byCurrency[c]) byCurrency[c] = { total: 0, count: 0 }
      byCurrency[c].total += e.totalSpent
      byCurrency[c].count += e.invoiceCount ?? 0
    }
    return byCurrency
  }, [filtered])

  return (
    <>
      {/* Header + Search */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 className="text-sm font-semibold text-ink">Entities & Suppliers</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search entities..."
          className="max-w-xs rounded border border-edge px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-faint">
          {search ? 'No entities match your search' : 'No costs recorded'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-edge">
                <th className="px-4 py-2 text-left font-medium">Entity Name</th>
                <th className="px-4 py-2 text-left font-medium">Tags</th>
                <th className="px-4 py-2 text-right font-medium">Total Spent</th>
                <th className="px-4 py-2 text-right font-medium"># Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {pageItems.map((e, i) => (
                <tr key={`${e.entityId ?? 'none'}-${e.currency}-${i}`} className="transition-colors hover:bg-accent-bg">
                  <td className="px-4 py-2">
                    {e.entityId ? (
                      <a
                        href={`/entities/${e.entityId}`}
                        className="font-medium text-accent hover:text-accent-hover hover:underline"
                      >
                        {e.entityName}
                      </a>
                    ) : (
                      <span className="font-medium text-ink">{e.entityName}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted">
                    {e.tags.length > 0 ? e.tags.join(', ') : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-ink">
                    {e.totalSpent !== null ? formatCurrency(e.totalSpent, e.currency) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-muted">
                    {e.invoiceCount ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals footer */}
            <tfoot>
              {Object.keys(currencyTotals).sort().map((c, i) => (
                <tr key={c} className={`${i === 0 ? 'border-t border-edge' : ''} bg-panel/50`}>
                  <td className="px-4 py-2 text-sm font-medium text-ink">
                    {Object.keys(currencyTotals).length > 1 ? `Total ${c}` : 'Total'}
                  </td>
                  <td className="px-4 py-2" />
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-ink">
                    {formatCurrency(currencyTotals[c].total, c)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-ink">
                    {currencyTotals[c].count}
                  </td>
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > ENTITIES_PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-edge px-4 py-2">
          <span className="text-xs text-muted">
            {start + 1}–{Math.min(start + ENTITIES_PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded border border-edge-strong px-2.5 py-1 text-sm text-ink hover:bg-surface disabled:text-edge-strong disabled:cursor-default"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`rounded border px-2.5 py-1 text-sm ${
                  p === safePage
                    ? 'border-accent bg-accent-bg font-medium text-accent'
                    : 'border-edge-strong bg-white text-ink hover:bg-surface'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded border border-edge-strong px-2.5 py-1 text-sm text-ink hover:bg-surface disabled:text-edge-strong disabled:cursor-default"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// --- Main Detail View ---

export function ProjectDetailView({ detail, partnerCompanies, categories }: Props) {
  const { project, clientName, entities, partners, partnerSettlements } = detail
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [isPending, startTransition] = useTransition()

  const contractValue = project.contract_value ?? null
  const contractCurrency = project.contract_currency ?? 'PEN'

  // Inline add form state (lifted from child components)
  const [showPartnerForm, setShowPartnerForm] = useState(false)

  const assignedPartnerIds = new Set(partners.map(p => p.partnerCompanyId))
  const addPartnerDisabled = partnerCompanies.every(pc => assignedPartnerIds.has(pc.id))

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editContractValue, setEditContractValue] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editExpectedEnd, setEditExpectedEnd] = useState('')
  const [editActualEnd, setEditActualEnd] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    setEditName(project.name)
    setEditStatus(project.status)
    setEditContractValue(project.contract_value?.toString() ?? '')
    setEditStartDate(project.start_date ?? '')
    setEditExpectedEnd(project.expected_end_date ?? '')
    setEditActualEnd(project.actual_end_date ?? '')
    setEditLocation(project.location ?? '')
    setEditNotes(project.notes ?? '')
    setError(null)
    setMode('edit')
  }

  function handleSave() {
    if (!editName.trim()) {
      setError('Project name is required')
      return
    }
    setError(null)
    const parsedValue = editContractValue ? parseFloat(editContractValue) : undefined
    if (editContractValue && (isNaN(parsedValue!) || parsedValue! <= 0)) {
      setError('Contract value must be a positive number')
      return
    }

    startTransition(async () => {
      const result = await updateProject(project.id, {
        name: editName.trim(),
        status: editStatus,
        contract_value: parsedValue,
        start_date: editStartDate || undefined,
        expected_end_date: editExpectedEnd || undefined,
        actual_end_date: editActualEnd || undefined,
        location: editLocation.trim() || undefined,
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

  return (
    <div>
      {/* Left side of header: breadcrumb + badges */}
      <HeaderTitlePortal>
        <Link
          href="/projects"
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Projects
        </Link>
        <div className="h-4 w-px bg-edge" />
        <span className="text-sm text-muted truncate">
          {project.project_code} — {project.name}
        </span>
        <StatusBadge label={formatProjectStatus(project.status)} variant={projectStatusBadgeVariant(project.status)} />
        <StatusBadge label={formatProjectType(project.project_type)} variant="zinc" />
      </HeaderTitlePortal>

      {/* Right side of header: edit button */}
      {mode === 'view' && (
        <HeaderPortal>
          <button
            onClick={startEdit}
            className={`${btnEditIcon}`}
            title="Edit project"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d={iconPencil} />
            </svg>
          </button>
        </HeaderPortal>
      )}

      {/* View mode: dashboard */}
      {mode === 'view' && (
        <div className="space-y-6">
          {/* Metadata row — first element, no duplicate title */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {clientName && (
              <div>
                <span className="text-xs text-muted">Client</span>
                <p className="text-ink">{clientName}</p>
              </div>
            )}
            {contractValue !== null && (
              <div>
                <span className="text-xs text-muted">Contract Value</span>
                <p className="font-mono font-medium text-ink">
                  {formatCurrency(contractValue, contractCurrency)}
                </p>
              </div>
            )}
            {project.start_date && (
              <div>
                <span className="text-xs text-muted">Start Date</span>
                <p className="text-ink">{formatDate(project.start_date)}</p>
              </div>
            )}
            {project.expected_end_date && (
              <div>
                <span className="text-xs text-muted">Expected End</span>
                <p className="text-ink">{formatDate(project.expected_end_date)}</p>
              </div>
            )}
            {project.actual_end_date && (
              <div>
                <span className="text-xs text-muted">Actual End</span>
                <p className="text-ink">{formatDate(project.actual_end_date)}</p>
              </div>
            )}
            {project.location && (
              <div>
                <span className="text-xs text-muted">Location</span>
                <p className="text-ink">{project.location}</p>
              </div>
            )}
          </div>

          <div className="border-t border-edge" />

          {/* Dashboard grid: Partners + Budget side by side */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Partners & Settlement — flex-col so total pins to bottom */}
            <div className="flex flex-col rounded-[10px] border border-edge bg-white">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-ink">Partners & Settlement</h3>
                <button
                  onClick={() => setShowPartnerForm(true)}
                  disabled={addPartnerDisabled || showPartnerForm}
                  className="text-xs font-medium text-accent hover:text-accent-hover disabled:text-faint"
                >
                  + Add partner
                </button>
              </div>
              <ProjectPartnerSettlement
                projectId={project.id}
                partners={partners}
                settlements={partnerSettlements}
                partnerCompanies={partnerCompanies}
                showForm={showPartnerForm}
                onHideForm={() => setShowPartnerForm(false)}
              />
            </div>

            {/* Costs & Budget */}
            <div className="rounded-[10px] border border-edge bg-white">
              <div className="px-4 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-ink">Costs & Budget</h3>
              </div>
              <ProjectBudgetForm
                projectId={project.id}
                budgetRows={detail.budget}
                contractValue={contractValue}
                contractCurrency={contractCurrency}
                categories={categories}
                actualCostsByCategory={detail.actualCostsByCategory}
              />
            </div>
          </div>

          {/* Entities — full width */}
          <div className="rounded-[10px] border border-edge bg-white">
            <EntitiesPaginated entities={entities} />
          </div>

          {/* Notes */}
          {project.notes && (
            <div className="rounded-[10px] border border-edge bg-white">
              <div className="px-4 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-ink">Notes</h3>
              </div>
              <div className="px-4 pb-4">
                <p className="whitespace-pre-wrap text-sm text-muted">{project.notes}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {mode === 'edit' && (
        <div>
          <div className="rounded-[10px] border border-edge p-4 space-y-4">
            <h3 className="text-sm font-semibold text-ink">Edit Project — {project.project_code}</h3>

            {/* Locked fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="block text-[11px] font-medium text-faint mb-1">Code <LockIcon /></span>
                <span className="text-sm font-mono font-semibold text-muted">{project.project_code}</span>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-faint mb-1">Type <LockIcon /></span>
                <StatusBadge label={formatProjectType(project.project_type)} variant="zinc" />
              </div>
              <div>
                <span className="block text-[11px] font-medium text-faint mb-1">Currency <LockIcon /></span>
                <span className="text-sm text-muted">{contractCurrency}</span>
              </div>
            </div>

            <div className="border-t border-edge" />

            {/* Editable fields */}
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">Project Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={`${inputCompactClass} w-full bg-white`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                >
                  <option value="prospect">Prospect</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">Contract Value</label>
                <input
                  type="number"
                  value={editContractValue}
                  onChange={(e) => setEditContractValue(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white font-mono text-right`}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">Start Date</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">Expected End Date</label>
                <input
                  type="date"
                  value={editExpectedEnd}
                  onChange={(e) => setEditExpectedEnd(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">Actual End Date</label>
                <input
                  type="date"
                  value={editActualEnd}
                  onChange={(e) => setEditActualEnd(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                />
                <span className="text-[10px] text-faint mt-0.5 block">Set when project completes</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">Location</label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className={`${inputCompactClass} w-full bg-white`}
                placeholder="City, region"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">Notes</label>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className={`${inputCompactClass} w-full bg-white resize-none`}
                placeholder="Optional notes..."
              />
            </div>

            {error && <p className="text-xs font-medium text-negative">{error}</p>}

            <div className="flex items-center justify-between border-t border-edge pt-3">
              <button
                onClick={() => setMode('view')}
                disabled={isPending}
                className="rounded-md border border-edge-strong px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !editName.trim()}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
