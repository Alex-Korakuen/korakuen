'use client'

import { useMemo, useState } from 'react'
import {
  formatProjectStatus,
  projectStatusBadgeVariant,
} from '@/lib/formatters'
import { MobileBackButton } from '@/components/ui/mobile-back-button'
import { StatusBadge } from '@/components/ui/status-badge'
import { CreateProjectModal } from './create-project-modal'
import { ProjectDetail } from './project-detail'

import type {
  ProjectListItem,
  ProjectDetailData,
  ProjectStatusFilter,
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

  const contractValue = detail?.project.contract_value ?? null
  const contractCurrency = (detail?.project.contract_currency ?? 'PEN') as Currency

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
              +
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
            <MobileBackButton onClick={() => onSelect(null)} />
          )}

          {!selectedId || !detail ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-12 text-center">
              <p className="text-zinc-500">Select a project to view details</p>
            </div>
          ) : (
            <ProjectDetail
              detail={detail}
              contractValue={contractValue}
              contractCurrency={contractCurrency}
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
