'use client'

import { useSelectRouter } from '@/lib/use-select-router'
import { ProjectsClient } from './projects-client'
import type { ProjectListItem, ProjectDetailData } from '@/lib/types'
import type { PartnerCompanyOption, CategoryOption } from '@/lib/queries'

type Props = {
  projects: ProjectListItem[]
  detail: ProjectDetailData | null
  selectedId: string | null
  partnerCompanies: PartnerCompanyOption[]
  categories: CategoryOption[]
}

export function ProjectsWrapper({ projects, detail, selectedId, partnerCompanies, categories }: Props) {
  const handleSelect = useSelectRouter('/projects')

  return (
    <ProjectsClient
      projects={projects}
      detail={detail}
      selectedId={selectedId}
      onSelect={handleSelect}
      partnerCompanies={partnerCompanies}
      categories={categories}
    />
  )
}
