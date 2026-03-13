'use client'

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

export function ProjectDetail({
  detail,
  contractValue,
  contractCurrency,
  partnerCompanies,
  categories,
}: Props) {
  const { project, clientName, entities, partners, partnerSettlements } = detail

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
    ...(project.notes
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

      {/* Tabbed sections */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        <TabBar tabs={tabs} defaultTab="partners" />
      </div>
    </div>
  )
}
