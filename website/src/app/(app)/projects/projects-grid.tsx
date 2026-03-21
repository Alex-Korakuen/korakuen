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
  if (pct > 100) return 'text-negative'
  if (pct > 90) return 'text-caution'
  return 'text-positive'
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
        <div className="px-8 py-16 text-center text-faint">
          No projects found
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(p => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group rounded-[10px] border border-edge bg-white p-5 transition-all hover:border-edge-strong"
            >
              {/* Top: code + status */}
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-faint">
                  {p.project_code}
                </span>
                <StatusBadge
                  label={formatProjectStatus(p.status)}
                  variant={projectStatusBadgeVariant(p.status)}
                />
              </div>

              {/* Name */}
              <h3 className="mb-4 text-sm font-semibold leading-snug text-ink">
                {p.name}
              </h3>

              {/* Metrics */}
              <div className="space-y-3">
                {/* Contract value */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Contract</span>
                  <span className="font-mono font-semibold text-ink">
                    {p.contract_value !== null
                      ? formatCurrency(p.contract_value, p.contract_currency)
                      : <span className="font-sans font-normal text-faint">Not set</span>}
                  </span>
                </div>

                {/* Budget bar */}
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">Budget</span>
                  {p.budget_pct !== null ? (
                    <>
                      <div className="flex-1">
                        <div className="h-1.5 rounded-full bg-edge">
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
                    <span className="text-faint">—</span>
                  )}
                </div>
              </div>

            </Link>
          ))}
        </div>
      )}

      <CreateProjectModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
