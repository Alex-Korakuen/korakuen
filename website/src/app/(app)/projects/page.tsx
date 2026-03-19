import { getProjectsCardData } from '@/lib/queries'
import { ProjectsGrid } from './projects-grid'

export default async function ProjectsPage() {
  const projects = await getProjectsCardData()
  return <ProjectsGrid projects={projects} />
}
