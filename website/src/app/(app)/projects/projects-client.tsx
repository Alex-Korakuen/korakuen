'use client'

import { useMemo, useState } from 'react'
import {
  formatCurrency,
  formatDate,
  formatPaymentStatus,
  statusBadgeClass,
  formatProjectStatus,
  projectStatusBadgeClass,
  formatProjectType,
  formatCategory,
} from '@/lib/formatters'
import type {
  ProjectListItem,
  ProjectDetailData,
  ProjectStatusFilter,
  BudgetVsActualRow,
  Currency,
} from '@/lib/types'

type Props = {
  projects: ProjectListItem[]
  detail: ProjectDetailData | null
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function ProjectsClient({ projects, detail, selectedId, onSelect }: Props) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all')

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
      <h1 className="text-2xl font-semibold text-zinc-800">Projects</h1>
      <p className="mt-1 text-sm text-zinc-500">Browse and view project details</p>

      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        {/* Left panel — project list */}
        <div
          className={`w-full shrink-0 md:w-[320px] ${
            selectedId ? 'hidden md:block' : ''
          }`}
        >
          {/* Status filter */}
          <div className="mb-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProjectStatusFilter)}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
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
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${projectStatusBadgeClass(
                            p.status
                          )}`}
                        >
                          {formatProjectStatus(p.status)}
                        </span>
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
            />
          )}
        </div>
      </div>
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
}: {
  detail: ProjectDetailData
  hasBudget: boolean
  budgetRows: BudgetVsActualRow[]
  contractValue: number | null
  contractCurrency: Currency
  totalActual: number
  totalBudgeted: number | null
}) {
  const { project, clientName, assignedEntities, spendingByEntity, arInvoices } = detail

  return (
    <div className="space-y-6">
      {/* 1. Project Header */}
      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <h2 className="text-lg font-semibold text-zinc-800">
            {project.project_code} — {project.name}
          </h2>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${projectStatusBadgeClass(
              project.status
            )}`}
          >
            {formatProjectStatus(project.status)}
          </span>
          <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {formatProjectType(project.project_type)}
          </span>
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

      {/* 2. Assigned Entities */}
      <div className="rounded-lg border border-zinc-200">
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="text-sm font-medium text-zinc-700">Assigned Entities</h3>
        </div>
        {assignedEntities.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">
            No entities assigned
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Entity Name</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {assignedEntities.map((ae, i) => (
                <tr key={`${ae.entityId}-${i}`} className="transition-colors hover:bg-blue-50">
                  <td className="px-4 py-2">
                    <a
                      href={`/entities?selected=${ae.entityId}`}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {ae.entityName}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{ae.roleName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 3. Spending by Entity */}
      <div className="rounded-lg border border-zinc-200">
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="text-sm font-medium text-zinc-700">Spending by Entity</h3>
        </div>
        {spendingByEntity.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">
            No costs recorded
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Entity Name</th>
                  <th className="px-4 py-2 text-right font-medium">Total Spent</th>
                  <th className="px-4 py-2 text-right font-medium"># Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {spendingByEntity.map((se, i) => (
                  <tr key={`${se.entityId ?? 'none'}-${se.currency}-${i}`} className="transition-colors hover:bg-blue-50">
                    <td className="px-4 py-2 font-medium text-zinc-800">{se.entityName}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                      {formatCurrency(se.totalSpent, se.currency as Currency)}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600">{se.invoiceCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(() => {
                  const byCurrency: Record<string, { total: number; count: number }> = {};
                  for (const se of spendingByEntity) {
                    const c = se.currency;
                    if (!byCurrency[c]) byCurrency[c] = { total: 0, count: 0 };
                    byCurrency[c].total += se.totalSpent;
                    byCurrency[c].count += se.invoiceCount;
                  }
                  const currencies = Object.keys(byCurrency).sort();
                  return currencies.map((c, i) => (
                    <tr key={c} className={`${i === 0 ? 'border-t border-zinc-200' : ''} bg-zinc-50`}>
                      <td className="px-4 py-2 text-sm font-medium text-zinc-700">
                        {currencies.length > 1 ? `Total ${c}` : 'Total'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                        {formatCurrency(byCurrency[c].total, c as Currency)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-zinc-700">
                        {byCurrency[c].count}
                      </td>
                    </tr>
                  ));
                })()}
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 4. Costs & Budget */}
      <div className="rounded-lg border border-zinc-200">
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="text-sm font-medium text-zinc-700">Costs &amp; Budget</h3>
        </div>
        {budgetRows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">
            No cost data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Category</th>
                  {hasBudget && (
                    <th className="px-4 py-2 text-right font-medium">Budgeted</th>
                  )}
                  <th className="px-4 py-2 text-right font-medium">Actual</th>
                  {hasBudget && (
                    <th className="px-4 py-2 text-right font-medium">% Used</th>
                  )}
                  {contractValue !== null && (
                    <th className="px-4 py-2 text-right font-medium">% of Contract</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {budgetRows.map((b, i) => {
                  const actual = b.actual_amount ?? 0
                  const pctUsed = b.pct_used ?? 0
                  const pctOfContract =
                    contractValue !== null && contractValue > 0
                      ? (actual / contractValue) * 100
                      : null

                  return (
                    <tr key={`${b.category}-${i}`}>
                      <td className="px-4 py-2 font-medium text-zinc-800">
                        {formatCategory(b.category)}
                      </td>
                      {hasBudget && (
                        <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                          {b.budgeted_amount !== null
                            ? formatCurrency(b.budgeted_amount, contractCurrency)
                            : '--'}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-700">
                        {formatCurrency(actual, contractCurrency)}
                      </td>
                      {hasBudget && (
                        <td
                          className={`whitespace-nowrap px-4 py-2 text-right font-mono font-medium ${pctUsedColor(
                            pctUsed,
                            b.budgeted_amount
                          )}`}
                        >
                          {b.budgeted_amount !== null && b.budgeted_amount > 0
                            ? `${pctUsed.toFixed(1)}%`
                            : '--'}
                        </td>
                      )}
                      {contractValue !== null && (
                        <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-zinc-600">
                          {pctOfContract !== null ? `${pctOfContract.toFixed(1)}%` : '--'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50">
                  <td className="px-4 py-2 font-medium text-zinc-700">Total</td>
                  {hasBudget && (
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                      {totalBudgeted !== null
                        ? formatCurrency(totalBudgeted, contractCurrency)
                        : '--'}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-800">
                    {formatCurrency(totalActual, contractCurrency)}
                  </td>
                  {hasBudget && (
                    <td
                      className={`whitespace-nowrap px-4 py-2 text-right font-mono font-semibold ${
                        totalBudgeted !== null && totalBudgeted > 0
                          ? pctUsedColor((totalActual / totalBudgeted) * 100, totalBudgeted)
                          : 'text-zinc-700'
                      }`}
                    >
                      {totalBudgeted !== null && totalBudgeted > 0
                        ? `${((totalActual / totalBudgeted) * 100).toFixed(1)}%`
                        : '--'}
                    </td>
                  )}
                  {contractValue !== null && (
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono font-semibold text-zinc-700">
                      {contractValue > 0
                        ? `${((totalActual / contractValue) * 100).toFixed(1)}%`
                        : '--'}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 5. AR Invoices */}
      <div className="rounded-lg border border-zinc-200">
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
          <h3 className="text-sm font-medium text-zinc-700">AR Invoices</h3>
        </div>
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
                  <th className="px-4 py-2 text-left font-medium">Status</th>
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
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                          ar.payment_status
                        )}`}
                      >
                        {formatPaymentStatus(ar.payment_status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Notes */}
      {project.notes && (
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-700">Notes</h3>
          <p className="whitespace-pre-wrap text-sm text-zinc-600">{project.notes}</p>
        </div>
      )}
    </div>
  )
}

// --- Helpers ---

function pctUsedColor(pct: number, budgeted: number | null): string {
  if (budgeted === null || budgeted === 0) return 'text-zinc-600'
  if (pct > 100) return 'text-red-600'
  if (pct > 90) return 'text-amber-600'
  return 'text-green-600'
}
