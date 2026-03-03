import {
  getArOutstanding,
  getRetencionDashboard,
  getArDetracciones,
  getProjectsForFilter,
  getClientsForFilter,
  getPartnerCompaniesForFilter,
} from '@/lib/queries'
import { ArOutstandingClient } from './ar-outstanding-client'

export default async function ArOutstandingPage() {
  const [data, retenciones, detracciones, projects, clients, partners] = await Promise.all([
    getArOutstanding(),
    getRetencionDashboard(),
    getArDetracciones(),
    getProjectsForFilter(),
    getClientsForFilter(),
    getPartnerCompaniesForFilter(),
  ])

  return (
    <ArOutstandingClient
      data={data}
      retenciones={retenciones}
      detracciones={detracciones}
      projects={projects}
      clients={clients}
      partners={partners}
    />
  )
}
