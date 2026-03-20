'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  formatCurrency,
  formatProjectStatus,
  projectStatusBadgeVariant,
} from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { HeaderPortal } from '@/components/ui/header-portal'
import { btnPrimary, selectClass } from '@/lib/styles'

const CreateProjectModal = dynamic(() => import('./create-project-modal').then(m => ({ default: m.CreateProjectModal })))

import type { ProjectCardItem, ProjectStatusFilter } from '@/lib/types'

type Props = {
  projects: ProjectCardItem[]
}

function budgetBarColor(pct: number): string {
  if (pct > 100) return 'bg-red-500'
  if (pct > 90) return 'bg-amber-500'
  return 'bg-green-500'
}

function budgetPctColor(pct: number): string {
  if (pct > 100) return 'text-red-600'
  if (pct > 90) return 'text-amber-600'
  return 'text-green-600'
}

export function ProjectsGrid({ projects }: Props) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return projects
    return projects.filter(p => p.status === statusFilter)
  }, [projects, statusFilter])

  return (
    <>
      <HeaderPortal>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProjectStatusFilter)}
          className={selectClass}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={() => setShowCreate(true)}
          className={`${btnPrimary}`}
        >
          + New Project
        </button>
      </HeaderPortal>

      {filtered.length === 0 ? (
        <div className="px-8 py-16 text-center text-zinc-400">
          No projects found
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(p => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-md"
            >
              {/* Top: code + status */}
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-zinc-400">
                  {p.project_code}
                </span>
                <StatusBadge
                  label={formatProjectStatus(p.status)}
                  variant={projectStatusBadgeVariant(p.status)}
                />
              </div>

              {/* Name */}
              <h3 className="mb-4 text-sm font-semibold leading-snug text-zinc-800 group-hover:text-zinc-900">
                {p.name}
              </h3>

              {/* Metrics */}
              <div className="space-y-3">
                {/* Contract value */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Contract</span>
                  <span className="font-mono font-semibold text-zinc-800">
                    {p.contract_value !== null
                      ? formatCurrency(p.contract_value, p.contract_currency)
                      : <span className="font-sans font-normal text-zinc-400">Not set</span>}
                  </span>
                </div>

                {/* Budget bar */}
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-500">Budget</span>
                  {p.budget_pct !== null ? (
                    <>
                      <div className="flex-1">
                        <div className="h-1.5 rounded-full bg-zinc-100">
                          <div
                            className={`h-1.5 rounded-full ${budgetBarColor(p.budget_pct)}`}
                            style={{ width: `${Math.min(p.budget_pct, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className={`min-w-[3rem] text-right font-mono text-xs font-semibold ${budgetPctColor(p.budget_pct)}`}>
                        {p.budget_pct.toFixed(0)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </div>
              </div>

              {/* Footer: partners + settlement */}
              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                <span className="text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-700">{p.partner_count}</span> partners
                </span>
                {p.is_settled === true && (
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                    Settled
                  </span>
                )}
                {p.is_settled === false && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                    Unsettled
                  </span>
                )}
                {p.is_settled === null && (
                  <span className="rounded-full bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400">
                    No data
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateProjectModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
