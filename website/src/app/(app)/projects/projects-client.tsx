'use client'

import { useMemo, useState } from 'react'
import {
  formatCurrency,
  formatDate,
  formatProjectStatus,
  projectStatusBadgeVariant,
  formatProjectType,
} from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { SectionCard } from '@/components/ui/section-card'
import { CreateProjectModal } from './create-project-modal'
import { ProjectPartnersForm } from './project-partners-form'
import { ProjectEntitiesForm } from './project-entities-form'
import { ProjectBudgetForm } from './project-budget-form'

import type {
  ProjectListItem,
  ProjectDetailData,
  ProjectStatusFilter,
  BudgetVsActualRow,
  Currency,
} from '@/lib/types'
import type { PartnerCompanyOption, CategoryOption } from '@/lib/queries'

type Props = {
  projects: ProjectListItem[]
  detail: ProjectDetailData | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  partnerCompanies: PartnerCompanyOption[]
  categories: CategoryOption[]
  tags: { id: string; name: string }[]
}

export function ProjectsClient({ projects, detail, selectedId, onSelect, partnerCompanies, categories, tags }: Props) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all')
  const [showCreateProject, setShowCreateProject] = useState(false)

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'all') return projects
    return projects.filter((p) => p.status === statusFilter)
  }, [projects, statusFilter])

  const hasBudget = useMemo(() => {
    if (!detail) return false
    return detail.budget.some((b) => b.budgeted_amount !== null && b.budgeted_amount > 0)
  }, [detail])

  // Compute actual totals by category from budget view rows
  const budgetRows = detail?.budget ?? []
  const contractValue = detail?.project.contract_value ?? null
  const contractCurrency = (detail?.project.contract_currency ?? 'PEN') as Currency

  // Total actual across all categories
  const totalActual = budgetRows.reduce((sum, b) => sum + (b.actual_amount ?? 0), 0)
  const totalBudgeted = hasBudget
    ? budgetRows.reduce((sum, b) => sum + (b.budgeted_amount ?? 0), 0)
    : null

  return (
    <div>
      <div className="mt-0 flex flex-col gap-6 md:flex-row">
        {/* Left panel — project list */}
        <div
          className={`w-full shrink-0 md:w-[400px] ${
            selectedId ? 'hidden md:block' : ''
          }`}
        >
          {/* Status filter + Create button */}
          <div className="mb-3 flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProjectStatusFilter)}
              className="flex-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={() => setShowCreateProject(true)}
              className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              + Create
            </button>
          </div>

          {/* Project table */}
          <div className="rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Code</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-zinc-400">
                      No projects found
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => onSelect(p.id)}
                      className={`cursor-pointer transition-colors hover:bg-blue-50 ${
                        selectedId === p.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-800">
                        {p.project_code}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">{p.name}</td>
                      <td className="px-3 py-2">
                        <StatusBadge label={formatProjectStatus(p.status)} variant={projectStatusBadgeVariant(p.status)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right panel — detail */}
        <div className={`min-w-0 flex-1 ${!selectedId ? 'hidden md:block' : ''}`}>
          {/* Mobile back button */}
          {selectedId && (
            <button
              onClick={() => onSelect(null)}
              className="mb-4 text-sm text-blue-600 hover:text-blue-800 md:hidden"
            >
              &larr; Back
            </button>
          )}

          {!selectedId || !detail ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-12 text-center">
              <p className="text-zinc-500">Select a project to view details</p>
            </div>
          ) : (
            <ProjectDetail
              detail={detail}
              hasBudget={hasBudget}
              budgetRows={budgetRows}
              contractValue={contractValue}
              contractCurrency={contractCurrency}
              totalActual={totalActual}
              totalBudgeted={totalBudgeted}
              partnerCompanies={partnerCompanies}
              categories={categories}
              tags={tags}
            />
          )}
        </div>
      </div>

      {/* Create project modal */}
      <CreateProjectModal isOpen={showCreateProject} onClose={() => setShowCreateProject(false)} />
    </div>
  )
}

// --- Detail sub-component ---

function ProjectDetail({
  detail,
  hasBudget,
  budgetRows,
  contractValue,
  contractCurrency,
  totalActual,
  totalBudgeted,
  partnerCompanies,
  categories,
  tags,
}: {
  detail: ProjectDetailData
  hasBudget: boolean
  budgetRows: BudgetVsActualRow[]
  contractValue: number | null
  contractCurrency: Currency
  totalActual: number
  totalBudgeted: number | null
  partnerCompanies: PartnerCompanyOption[]
  categories: CategoryOption[]
  tags: { id: string; name: string }[]
}) {
  const { project, clientName, entities, arInvoices, partners, assignedEntities } = detail

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <h2 className="text-lg font-semibold text-zinc-800">
            {project.project_code} — {project.name}
          </h2>
          <StatusBadge label={formatProjectStatus(project.status)} variant={projectStatusBadgeVariant(project.status)} />
          <StatusBadge label={formatProjectType(project.project_type)} variant="zinc" />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
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
              <span className="text-xs text-zinc-500">Expected End Date</span>
              <p className="text-zinc-700">{formatDate(project.expected_end_date)}</p>
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

      <ProjectPartnersForm
        projectId={project.id}
        partners={partners}
        partnerCompanies={partnerCompanies}
      />
      <ProjectEntitiesForm
        projectId={project.id}
        assignedEntities={assignedEntities}
        tags={tags}
      />
      <ProjectEntitiesSection entities={entities} />
      <ProjectBudgetForm
        projectId={project.id}
        budgetRows={budgetRows}
        hasBudget={hasBudget}
        contractValue={contractValue}
        contractCurrency={contractCurrency}
        totalActual={totalActual}
        totalBudgeted={totalBudgeted}
        categories={categories}
      />
      <ProjectArSection arInvoices={arInvoices} />

      {project.notes && (
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-700">Notes</h3>
          <p className="whitespace-pre-wrap text-sm text-zinc-600">{project.notes}</p>
        </div>
      )}
    </div>
  )
}

// --- Section components ---

function ProjectEntitiesSection({ entities }: { entities: ProjectDetailData['entities'] }) {
  return (
    <SectionCard title="Entities">
      {entities.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-zinc-400">
          No entities assigned or costs recorded
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Entity Name</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-right font-medium">Total Spent</th>
                <th className="px-4 py-2 text-right font-medium"># Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {entities.map((e, i) => (
                <tr key={`${e.entityId ?? 'none'}-${e.currency}-${i}`} className="transition-colors hover:bg-blue-50">
                  <td className="px-4 py-2">
                    {e.entityId ? (
                      <a
                        href={`/entities?selected=${e.entityId}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {e.entityName}
                      </a>
                    ) : (
                      <span className="font-medium text-zinc-800">{e.entityName}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{e.roleName ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                    {e.totalSpent !== null ? formatCurrency(e.totalSpent, e.currency as Currency) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {e.invoiceCount ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {(() => {
                const byCurrency: Record<string, { total: number; count: number }> = {}
                for (const e of entities) {
                  if (e.totalSpent === null) continue
                  const c = e.currency
                  if (!byCurrency[c]) byCurrency[c] = { total: 0, count: 0 }
                  byCurrency[c].total += e.totalSpent
                  byCurrency[c].count += e.invoiceCount ?? 0
                }
                const currencies = Object.keys(byCurrency).sort()
                if (currencies.length === 0) return null
                return currencies.map((c, i) => (
                  <tr key={c} className={`${i === 0 ? 'border-t border-zinc-200' : ''} bg-zinc-50`}>
                    <td className="px-4 py-2 text-sm font-medium text-zinc-700">
                      {currencies.length > 1 ? `Total ${c}` : 'Total'}
                    </td>
                    <td className="px-4 py-2" />
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                      {formatCurrency(byCurrency[c].total, c as Currency)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-zinc-700">
                      {byCurrency[c].count}
                    </td>
                  </tr>
                ))
              })()}
            </tfoot>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

function ProjectArSection({ arInvoices }: { arInvoices: ProjectDetailData['arInvoices'] }) {
  return (
    <SectionCard title="AR Invoices">
      {arInvoices.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-zinc-400">
          No AR invoices
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Invoice #</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Gross Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {arInvoices.map((ar) => (
                <tr key={ar.id} className="transition-colors hover:bg-blue-50">
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-zinc-800">
                    {ar.invoice_number ?? '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-600">
                    {ar.invoice_date ? formatDate(ar.invoice_date) : '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                    {formatCurrency(ar.gross_total, ar.currency as Currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

