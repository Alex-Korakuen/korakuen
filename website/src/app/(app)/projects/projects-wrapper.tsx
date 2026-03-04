'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { ProjectsClient } from './projects-client'
import type { ProjectListItem, ProjectDetailData } from '@/lib/types'

type Props = {
  projects: ProjectListItem[]
  detail: ProjectDetailData | null
  selectedId: string | null
}

export function ProjectsWrapper({ projects, detail, selectedId }: Props) {
  const router = useRouter()

  const handleSelect = useCallback(
    (id: string | null) => {
      if (id) {
        router.push(`/projects?selected=${id}`)
      } else {
        router.push('/projects')
      }
    },
    [router]
  )

  return (
    <ProjectsClient
      projects={projects}
      detail={detail}
      selectedId={selectedId}
      onSelect={handleSelect}
    />
  )
}
