import { getProjectsList, getProjectDetail } from '@/lib/queries'
import { ProjectsWrapper } from './projects-wrapper'

type Props = {
  searchParams: Promise<{ selected?: string }>
}

export default async function ProjectsPage({ searchParams }: Props) {
  const params = await searchParams
  const selectedId = params.selected || null

  const projects = await getProjectsList()

  // Only fetch detail data if a project is selected
  const detail = selectedId ? await getProjectDetail(selectedId) : null

  return (
    <ProjectsWrapper
      projects={projects}
      detail={detail}
      selectedId={selectedId}
    />
  )
}
