import { getProjectsList, getSettlementDashboard } from '@/lib/queries'
import { SettlementClient } from './settlement-client'

export default async function SettlementPage() {
  const projects = await getProjectsList()
  const allIds = projects.map(p => p.id)

  const data = await getSettlementDashboard(allIds)

  return (
    <SettlementClient
      projects={projects}
      initialData={data}
      initialProjectIds={allIds}
    />
  )
}
