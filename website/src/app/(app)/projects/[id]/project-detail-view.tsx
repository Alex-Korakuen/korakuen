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
import { inputCompactClass, btnEditIcon } from '@/lib/styles'

import type { ProjectDetailData, ProjectEntitySummary } from '@/lib/types'
import type { PartnerCompanyOption, CategoryOption } from '@/lib/queries'

type Props = {
  detail: ProjectDetailData
  partnerCompanies: PartnerCompanyOption[]
  categories: CategoryOption[]
}

// --- Lock icon (reused from old project-detail.tsx) ---
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="inline-block text-zinc-300 ml-1">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
  )
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
      {/* Search */}
      <div className="border-b border-zinc-200 px-4 py-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search entities..."
          className="w-full max-w-xs rounded border border-zinc-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-zinc-400">
          {search ? 'No entities match your search' : 'No costs recorded'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Entity Name</th>
                <th className="px-4 py-2 text-left font-medium">Tags</th>
                <th className="px-4 py-2 text-right font-medium">Total Spent</th>
                <th className="px-4 py-2 text-right font-medium"># Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {pageItems.map((e, i) => (
                <tr key={`${e.entityId ?? 'none'}-${e.currency}-${i}`} className="transition-colors hover:bg-blue-50">
                  <td className="px-4 py-2">
                    {e.entityId ? (
                      <a
                        href={`/entities/${e.entityId}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {e.entityName}
                      </a>
                    ) : (
                      <span className="font-medium text-zinc-800">{e.entityName}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {e.tags.length > 0 ? e.tags.join(', ') : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                    {e.totalSpent !== null ? formatCurrency(e.totalSpent, e.currency) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {e.invoiceCount ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals footer */}
            <tfoot>
              {Object.keys(currencyTotals).sort().map((c, i) => (
                <tr key={c} className={`${i === 0 ? 'border-t border-zinc-200' : ''} bg-zinc-50`}>
                  <td className="px-4 py-2 text-sm font-medium text-zinc-700">
                    {Object.keys(currencyTotals).length > 1 ? `Total ${c}` : 'Total'}
                  </td>
                  <td className="px-4 py-2" />
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                    {formatCurrency(currencyTotals[c].total, c)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-zinc-700">
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
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2">
          <span className="text-xs text-zinc-500">
            {start + 1}–{Math.min(start + ENTITIES_PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded border border-zinc-300 px-2.5 py-1 text-sm text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-300 disabled:cursor-default"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`rounded border px-2.5 py-1 text-sm ${
                  p === safePage
                    ? 'border-blue-500 bg-blue-50 font-medium text-blue-700'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded border border-zinc-300 px-2.5 py-1 text-sm text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-300 disabled:cursor-default"
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
      {/* Left side of header: breadcrumb */}
      <HeaderTitlePortal>
        <Link
          href="/projects"
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Projects
        </Link>
        <div className="h-4 w-px bg-zinc-200" />
        <span className="text-sm text-zinc-600 truncate">
          {project.project_code} — {project.name}
        </span>
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
              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
            </svg>
          </button>
        </HeaderPortal>
      )}

      {/* View mode: header + dashboard */}
      {mode === 'view' && (
        <div className="space-y-6 p-6">
          {/* Header card */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-800">{project.name}</h2>
              <StatusBadge label={formatProjectStatus(project.status)} variant={projectStatusBadgeVariant(project.status)} />
              <StatusBadge label={formatProjectType(project.project_type)} variant="zinc" />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {clientName && (
                <div>
                  <span className="text-xs text-zinc-500">Client</span>
                  <p className="text-zinc-700">{clientName}</p>
                </div>
              )}
              {contractValue !== null && (
                <div>
                  <span className="text-xs text-zinc-500">Contract Value</span>
                  <p className="font-mono font-medium text-zinc-800">
                    {formatCurrency(contractValue, contractCurrency)}
                  </p>
                </div>
              )}
              {project.start_date && (
                <div>
                  <span className="text-xs text-zinc-500">Start Date</span>
                  <p className="text-zinc-700">{formatDate(project.start_date)}</p>
                </div>
              )}
              {project.expected_end_date && (
                <div>
                  <span className="text-xs text-zinc-500">Expected End</span>
                  <p className="text-zinc-700">{formatDate(project.expected_end_date)}</p>
                </div>
              )}
              {project.actual_end_date && (
                <div>
                  <span className="text-xs text-zinc-500">Actual End</span>
                  <p className="text-zinc-700">{formatDate(project.actual_end_date)}</p>
                </div>
              )}
              {project.location && (
                <div>
                  <span className="text-xs text-zinc-500">Location</span>
                  <p className="text-zinc-700">{project.location}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-200" />

          {/* Dashboard grid: Partners + Budget side by side */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Partners & Settlement */}
            <div className="rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-zinc-600">Partners & Settlement</h3>
              </div>
              <ProjectPartnerSettlement
                projectId={project.id}
                partners={partners}
                settlements={partnerSettlements}
                partnerCompanies={partnerCompanies}
              />
            </div>

            {/* Costs & Budget */}
            <div className="rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-zinc-600">Costs & Budget</h3>
              </div>
              <ProjectBudgetForm
                projectId={project.id}
                budgetRows={detail.budget}
                contractValue={contractValue}
                contractCurrency={contractCurrency}
                categories={categories}
              />
            </div>
          </div>

          {/* Entities — full width */}
          <div className="rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-zinc-600">Entities & Suppliers</h3>
            </div>
            <EntitiesPaginated entities={entities} />
          </div>

          {/* Notes */}
          {project.notes && (
            <div className="rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-zinc-600">Notes</h3>
              </div>
              <div className="p-4">
                <p className="whitespace-pre-wrap text-sm text-zinc-600">{project.notes}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {mode === 'edit' && (
        <div className="p-6">
          <div className="rounded-lg border border-zinc-200 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700">Edit Project — {project.project_code}</h3>

            {/* Locked fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="block text-[11px] font-medium text-zinc-400 mb-1">Code <LockIcon /></span>
                <span className="text-sm font-mono font-semibold text-zinc-500">{project.project_code}</span>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-zinc-400 mb-1">Type <LockIcon /></span>
                <StatusBadge label={formatProjectType(project.project_type)} variant="zinc" />
              </div>
              <div>
                <span className="block text-[11px] font-medium text-zinc-400 mb-1">Currency <LockIcon /></span>
                <span className="text-sm text-zinc-500">{contractCurrency}</span>
              </div>
            </div>

            <div className="border-t border-zinc-200" />

            {/* Editable fields */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">Project Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={`${inputCompactClass} w-full bg-white`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Status</label>
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
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Contract Value</label>
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
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Expected End Date</label>
                <input
                  type="date"
                  value={editExpectedEnd}
                  onChange={(e) => setEditExpectedEnd(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Actual End Date</label>
                <input
                  type="date"
                  value={editActualEnd}
                  onChange={(e) => setEditActualEnd(e.target.value)}
                  className={`${inputCompactClass} w-full bg-white`}
                />
                <span className="text-[10px] text-zinc-400 mt-0.5 block">Set when project completes</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">Location</label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className={`${inputCompactClass} w-full bg-white`}
                placeholder="City, region"
              />
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
                disabled={isPending || !editName.trim()}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
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
