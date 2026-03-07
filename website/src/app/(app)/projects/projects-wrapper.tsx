'use client'

import { useSelectRouter } from '@/lib/use-select-router'
import { ProjectsClient } from './projects-client'
import type { ProjectListItem, ProjectDetailData } from '@/lib/types'

type Props = {
  projects: ProjectListItem[]
  detail: ProjectDetailData | null
  selectedId: string | null
}

export function ProjectsWrapper({ projects, detail, selectedId }: Props) {
  const handleSelect = useSelectRouter('/projects')

  return (
    <ProjectsClient
      projects={projects}
      detail={detail}
      selectedId={selectedId}
      onSelect={handleSelect}
    />
  )
}
