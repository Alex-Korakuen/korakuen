'use client'

import { useState, useTransition } from 'react'
import {
  formatCurrency,
  formatDate,
  formatProjectStatus,
  projectStatusBadgeVariant,
  formatProjectType,
} from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/status-badge'
import { TabBar } from '@/components/ui/tab-bar'
import { ProjectPartnerSettlement } from './project-partner-settlement'
import { ProjectBudgetForm } from './project-budget-form'
import { ProjectEntitiesSection } from './project-entities-section'
import { updateProject } from '@/lib/actions'
import { inputCompactClass } from '@/lib/styles'
import { useRouter } from 'next/navigation'

import type { Tab } from '@/components/ui/tab-bar'
import type { ProjectDetailData } from '@/lib/types'
import type { PartnerCompanyOption, CategoryOption } from '@/lib/queries'

type Props = {
  detail: ProjectDetailData
  contractValue: number | null
  contractCurrency: string
  partnerCompanies: PartnerCompanyOption[]
  categories: CategoryOption[]
}

// --- Lock icon ---
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="inline-block text-zinc-300 ml-1">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
  )
}

export function ProjectDetail({
  detail,
  contractValue,
  contractCurrency,
  partnerCompanies,
  categories,
}: Props) {
  const { project, clientName, entities, partners, partnerSettlements } = detail
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [isPending, startTransition] = useTransition()

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

  const tabs: Tab[] = [
    {
      key: 'partners',
      label: 'Partners',
      content: (
        <ProjectPartnerSettlement
          projectId={project.id}
          partners={partners}
          settlements={partnerSettlements}
          partnerCompanies={partnerCompanies}
        />
      ),
    },
    {
      key: 'entities',
      label: 'Entities',
      content: <ProjectEntitiesSection entities={entities} />,
    },
    {
      key: 'budget',
      label: 'Costs & Budget',
      content: (
        <ProjectBudgetForm
          projectId={project.id}
          budgetRows={detail.budget}
          contractValue={contractValue}
          contractCurrency={contractCurrency}
          categories={categories}
        />
      ),
    },
    ...(project.notes && mode === 'view'
      ? [
          {
            key: 'notes',
            label: 'Notes',
            content: (
              <div className="p-4">
                <p className="whitespace-pre-wrap text-sm text-zinc-600">{project.notes}</p>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      {/* Project Header — View Mode */}
      {mode === 'view' && (
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-start gap-2">
              <h2 className="text-lg font-semibold text-zinc-800">
                {project.project_code} — {project.name}
              </h2>
              <StatusBadge label={formatProjectStatus(project.status)} variant={projectStatusBadgeVariant(project.status)} />
              <StatusBadge label={formatProjectType(project.project_type)} variant="zinc" />
            </div>
            <button
              onClick={startEdit}
              className="rounded border border-zinc-200 p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 shrink-0"
              title="Edit project"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
            </button>
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
            {project.actual_end_date && (
              <div>
                <span className="text-xs text-zinc-500">Actual End Date</span>
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
      )}

      {/* Project Header — Edit Mode */}
      {mode === 'edit' && (
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
      )}

      {/* Tabbed sections */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        <TabBar tabs={tabs} defaultTab="partners" />
      </div>
    </div>
  )
}
