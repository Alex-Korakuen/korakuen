import { getProjectsList, getSettlementDashboard } from '@/lib/queries'
import { SettlementClient } from './settlement-client'

export default async function SettlementPage() {
  const projects = await getProjectsList()

  // Default: all active projects
  const activeProjects = projects.filter(p => p.status === 'active')
  const defaultIds = activeProjects.map(p => p.id)

  const data = await getSettlementDashboard(defaultIds)

  return (
    <SettlementClient
      projects={projects}
      initialData={data}
      initialProjectIds={defaultIds}
    />
  )
}
