import { getProjectsCardData, getPartners } from '@/lib/queries'
import { ProjectsGrid } from './projects-grid'

export default async function ProjectsPage() {
  const [projects, partners] = await Promise.all([
    getProjectsCardData(),
    getPartners(),
  ])
  return <ProjectsGrid projects={projects} partnerOptions={partners} />
}
