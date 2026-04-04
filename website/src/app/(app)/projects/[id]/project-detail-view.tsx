'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  formatCurrency,
  formatDate,
  formatProjectStatus,
  projectStatusBadgeVariant,
  formatProjectType,
  formatPercentage,
} from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { HeaderPortal } from '@/components/ui/header-portal'
import { HeaderTitlePortal } from '@/components/ui/header-title-portal'
import { NotesDisplay } from '@/components/ui/notes-display'
import { ProjectBudgetForm } from '../project-budget-form'
import { updateProjectField, setProjectPartners } from '@/lib/actions'

import { SectionCard } from '@/components/ui/section-card'
import { InlineEdit } from '@/components/ui/inline-edit'
import { COMPANY_IDENTIFIER, DEFAULT_CURRENCY } from '@/lib/constants'
import { tableHead, tableRowHover } from '@/lib/styles'
import {
  PartnerAllocationEditor,
  isPartnerAllocationValid,
  type PartnerEntry,
} from '@/components/ui/partner-allocation-editor'
import { EmptyState } from '@/components/ui/empty-state'
import { LocalPagination } from '@/components/ui/local-pagination'
import { DetailBreadcrumb } from '@/components/ui/detail-breadcrumb'
import { useAuth } from '@/lib/auth-context'
import type { ProjectDetailData, ProjectEntitySummary, PartnerOption, CategoryOption } from '@/lib/types'

type Props = {
  detail: ProjectDetailData
  partnerOptions: PartnerOption[]
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

  // Totals for ALL filtered items (not just current page)
  const totals = useMemo(() => {
    let pen = 0, usd = 0, count = 0
    for (const e of filtered) {
      pen += e.penSpent
      usd += e.usdSpent
      count += e.invoiceCount
    }
    return { pen, usd, count }
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
        <EmptyState message={search ? 'No entities match your search' : 'No costs recorded'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={tableHead}>
              <tr>
                <th className="px-4 py-2 text-left font-medium">Entity Name</th>
                <th className="px-4 py-2 text-left font-medium">Tags</th>
                <th className="px-4 py-2 text-right font-medium">PEN Spent</th>
                <th className="px-4 py-2 text-right font-medium">USD Spent</th>
                <th className="px-4 py-2 text-right font-medium"># Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {pageItems.map((e, i) => (
                <tr key={`${e.entityId ?? 'none'}-${i}`} className={tableRowHover}>
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
                    {e.penSpent ? formatCurrency(e.penSpent, 'PEN') : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-ink">
                    {e.usdSpent ? formatCurrency(e.usdSpent, 'USD') : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-muted">
                    {e.invoiceCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <LocalPagination
        page={safePage}
        totalCount={filtered.length}
        pageSize={ENTITIES_PAGE_SIZE}
        onPageChange={setPage}
      />

      {/* Totals — always at bottom */}
      {filtered.length > 0 && (
        <table className="mt-auto w-full border-t border-edge text-sm">
          <tbody>
            <tr className="bg-panel/50">
              <td className="px-4 py-2 font-medium text-ink">Total</td>
              <td className="px-4 py-2" />
              <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-ink">
                {totals.pen ? formatCurrency(totals.pen, 'PEN') : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-ink">
                {totals.usd ? formatCurrency(totals.usd, 'USD') : '—'}
              </td>
              <td className="px-4 py-2 text-right font-medium text-ink">
                {totals.count}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </>
  )
}

// --- Partners Row (inline-editable) ---

function PartnersRow({ partners, projectId, partnerOptions }: {
  partners: ProjectDetailData['partners']
  projectId: string
  partnerOptions: PartnerOption[]
}) {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [editing, setEditing] = useState(false)
  const [entries, setEntries] = useState<PartnerEntry[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const total = entries.reduce((s, e) => s + (parseFloat(e.profitSharePct) || 0), 0)

  function startEdit() {
    setEntries(partners.map(p => ({
      partnerId: p.partnerId,
      profitSharePct: String(p.profitSharePct),
    })))
    setError(null)
    setEditing(true)
  }

  function handleSave() {
    const parsed = entries.map(e => ({
      partnerId: e.partnerId,
      profitSharePct: parseFloat(e.profitSharePct) || 0,
    }))
    setError(null)
    startTransition(async () => {
      const result = await setProjectPartners(projectId, parsed)
      if (result.error) {
        setError(result.error)
      } else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  if (editing) {
    return (
      <div className="border-t border-edge px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Partners</span>
          {entries.length > 0 && (
            <span className={`text-[11px] font-medium ${Math.abs(total - 100) < 0.01 ? 'text-positive' : 'text-negative'}`}>
              Total: {formatPercentage(total)}
            </span>
          )}
        </div>
        <PartnerAllocationEditor
          value={entries}
          onChange={setEntries}
          partnerOptions={partnerOptions}
          size="sm"
          showTotal={false}
        />
        {error && <p className="text-xs font-medium text-negative">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(false)}
            disabled={isPending}
            className="rounded border border-edge-strong px-3 py-1 text-xs font-medium text-muted hover:bg-surface"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || entries.length === 0 || !isPartnerAllocationValid(entries)}
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  if (partners.length === 0) {
    if (!isAdmin) return null
    return (
      <div className="flex items-center gap-3 border-t border-edge px-4 py-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Partners</span>
        <button
          onClick={startEdit}
          className="text-xs font-medium text-accent hover:text-accent-hover"
        >
          + Add partners
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 border-t border-edge px-4 py-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Partners</span>
      <div className="flex flex-wrap items-center gap-2">
        {partners.map((p) => {
          const isYou = p.partnerName.toLowerCase().includes(COMPANY_IDENTIFIER)
          const chipClass = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            isYou
              ? 'border-positive/30 bg-positive-bg text-positive'
              : 'border-edge bg-surface text-ink'
          }${isAdmin ? ` cursor-pointer ${isYou ? 'hover:border-positive/50' : 'hover:border-edge-strong hover:bg-panel'}` : ''}`
          const inner = (
            <>
              {p.partnerName}
              <span className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
                isYou ? 'bg-positive-bg text-positive' : 'bg-panel text-muted'
              }`}>
                {formatPercentage(p.profitSharePct)}
              </span>
            </>
          )
          return isAdmin ? (
            <button key={p.id} onClick={startEdit} className={chipClass}>{inner}</button>
          ) : (
            <span key={p.id} className={chipClass}>{inner}</span>
          )
        })}
      </div>
      <Link
        href="/settlement"
        className="ml-auto text-xs font-medium text-accent hover:text-accent-hover"
      >
        View settlement →
      </Link>
    </div>
  )
}

// --- Status options for select ---
const STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// --- Main Detail View ---

export function ProjectDetailView({ detail, partnerOptions, categories }: Props) {
  const { project, clientName, entities, partners } = detail

  const contractValue = project.contract_value ?? null
  const contractCurrency = project.contract_currency ?? DEFAULT_CURRENCY

  const saveField = useCallback(
    (field: string) =>
      (value: string | number | null) =>
        updateProjectField(project.id, field, value),
    [project.id],
  )

  return (
    <div>
      {/* Left side of header: breadcrumb + badges */}
      <HeaderTitlePortal>
        <DetailBreadcrumb
          backHref="/projects"
          backLabel="Projects"
          title={`${project.project_code} — ${project.name}`}
        >
          <StatusBadge label={formatProjectStatus(project.status)} variant={projectStatusBadgeVariant(project.status)} />
          <StatusBadge label={formatProjectType(project.project_type)} variant="zinc" />
        </DetailBreadcrumb>
      </HeaderTitlePortal>

      <div className="space-y-6">
        {/* Metadata card with inline editing */}
        <SectionCard>
          <div className="grid grid-cols-2 divide-x divide-edge sm:grid-cols-3 lg:grid-cols-5">
            <div className="p-4">
              <InlineEdit
                label="Name"
                inputType="text"
                value={project.name}
                onSave={saveField('name')}
              />
            </div>
            <div className="p-4">
              <InlineEdit
                label="Status"
                inputType="select"
                options={STATUS_OPTIONS}
                value={project.status}
                displayValue={formatProjectStatus(project.status)}
                onSave={saveField('status')}
              />
            </div>
            <div className="p-4">
              <InlineEdit
                label="Contract Value"
                inputType="number"
                value={contractValue}
                displayValue={contractValue !== null ? formatCurrency(contractValue, contractCurrency) : null}
                onSave={saveField('contract_value')}
                align="right"
                mono
                step="0.01"
                min="0"
              />
            </div>
            <div className="p-4">
              <InlineEdit
                label="Start Date"
                inputType="date"
                value={project.start_date}
                displayValue={project.start_date ? formatDate(project.start_date) : null}
                onSave={saveField('start_date')}
              />
            </div>
            <div className="p-4">
              <InlineEdit
                label="Expected End"
                inputType="date"
                value={project.expected_end_date}
                displayValue={project.expected_end_date ? formatDate(project.expected_end_date) : null}
                onSave={saveField('expected_end_date')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-edge border-t border-edge sm:grid-cols-3 lg:grid-cols-5">
            <div className="p-4">
              <InlineEdit
                label="Location"
                inputType="text"
                value={project.location}
                placeholder="—"
                onSave={saveField('location')}
              />
            </div>
            <div className="p-4">
              <InlineEdit
                label="Actual End"
                inputType="date"
                value={project.actual_end_date}
                displayValue={project.actual_end_date ? formatDate(project.actual_end_date) : null}
                onSave={saveField('actual_end_date')}
              />
            </div>
            <div className="p-4">
              <InlineEdit
                label="Project Code"
                inputType="text"
                value={project.project_code}
                locked
                mono
              />
            </div>
            <div className="p-4">
              <InlineEdit
                label="Type"
                inputType="text"
                value={formatProjectType(project.project_type)}
                locked
              />
            </div>
            <div className="p-4">
              <InlineEdit
                label="Currency"
                inputType="text"
                value={contractCurrency}
                locked
              />
            </div>
          </div>

          {/* Partners row */}
          <PartnersRow partners={partners} projectId={project.id} partnerOptions={partnerOptions} />
        </SectionCard>

        {/* Dashboard grid: Budget + Entities side by side */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Costs & Budget */}
          <SectionCard>
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-ink">Costs & Budget</h3>
            </div>
            <ProjectBudgetForm
              projectId={project.id}
              budgetRows={detail.budget}
              contractValue={contractValue}
              categories={categories}
              actualCostsByCategory={detail.actualCostsByCategory}
            />
          </SectionCard>

          {/* Entities & Suppliers */}
          <SectionCard className="flex flex-col">
            <EntitiesPaginated entities={entities} />
          </SectionCard>
        </div>

        {/* Notes */}
        <SectionCard>
          <div className="px-4 pt-4 pb-2">
            <InlineEdit
              label="Notes"
              inputType="textarea"
              value={project.notes}
              placeholder="No notes"
              onSave={saveField('notes')}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
